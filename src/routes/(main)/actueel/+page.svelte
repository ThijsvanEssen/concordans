<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import Periode from '$lib/components/ui/Periode.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { uniqueBy } from '$lib/util/unique';
	import { volg, volgt } from '$lib/onderwerpen/onderwerpen';
	// Actueel: what happened in the Kamer and the government, newest first, per day. Every
	// filter and the line opened are in the URL, so a view can be shared; the same view is an
	// Atom feed. Beside it, the day of the newest event: how current the data is.
	import { isEscape } from '$lib/actions/keys';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { ApiError, api, unwrap } from '$lib/api/client';
	import { untrack } from 'svelte';
	import { API_BASE_URL } from '$lib/api/base-url';
	import type { Schema } from '$lib/api/types';
	import type { paths } from '$lib/api/generated/openapi-types';
	import { partyColor } from '$lib/utils/party-color.svelte';
	import IndexFacets, {
		activeFilters,
		type FacetGroup
	} from '$lib/components/explore/index/IndexFacets.svelte';
	// Filters v2 (Thijs, 10 Oct: "ziet er goed uit"; ux-voorstel/filters/v2): the field and
	// Periode on one line above the list, the facets with their counts on the left, a chosen
	// option in bold where it is chosen and nowhere else; on a phone behind Verfijnen (N).
	import {
		getCabinets,
		getMinistries,
		getPartyColors,
		type Cabinet,
		type Ministry
	} from '$lib/components/explore/index/government';
	import FeedDay from '$lib/components/actueel/FeedDay.svelte';
	import {
		CLOSE_VOTE,
		FEED_KINDS,
		KIND_LABEL,
		atomParams,
		dagVoor,
		daysOf,
		doorzochtVanaf,
		feedStand,
		kindFromParam,
		normalizeItem,
		shortDate,
		standLine,
		type DaySummary,
		type FeedItem,
		type FeedKind
	} from '$lib/components/actueel/feed';

	const today = new Date().toISOString().slice(0, 10);
	/** The days one summary spans at most, as the API allows. */
	const SUMMARY_DAYS_MAX = 31;

	// ── The URL ─────────────────────────────────────────────────────────────
	const params = $derived(page.url.searchParams);
	// A link from before API 0.48 names a kind the old way (`motie`): read as the TK word.
	const kinds = $derived([
		...new Set((params.get('soort') ?? '').split(',').flatMap((v) => kindFromParam(v) ?? []))
	]);
	const since = $derived(params.get('van') ?? '');
	const until = $derived(params.get('tot') ?? '');
	const cabinet = $derived(params.get('kabinet') ?? '');
	const ministry = $derived(params.get('ministerie') ?? '');
	const dossier = $derived(params.get('dossier') ?? '');
	const member = $derived(params.get('persoon') ?? '');
	const faction = $derived(params.get('fractie') ?? '');
	const q = $derived(params.get('q') ?? '');
	// Which Kamer (API 0.59): the Tweede with its papers, votes and toezeggingen, or the
	// Eerste with the votes that decided a bill. Publications belong to neither.
	const chamber = $derived(((v) => (v === 'TK' || v === 'EK' ? v : ''))(params.get('kamer')));
	// An inwerkingtreding can lie ahead; without asking, the feed ends today.
	const ahead = $derived(params.get('komend') === '1');
	const openId = $derived(params.get('open'));

	const FILTERS = [
		'soort',
		'van',
		'tot',
		'kabinet',
		'ministerie',
		'dossier',
		'persoon',
		'fractie',
		'q',
		'kamer',
		'komend'
	];

	/** A filter is a step in the history; the search text and the line opened replace it. */
	function patchUrl(patch: Record<string, string | null>, replaceState = false) {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(patch)) {
			if (v === null || v === '') url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		if (!('open' in patch)) url.searchParams.delete('open');
		goto(url.pathname + url.search.replaceAll('%2F', '/').replaceAll('%2C', ','), {
			replaceState,
			keepFocus: true,
			noScroll: true
		});
	}
	const filterHref = (patch: Record<string, string>) => {
		const url = new URL(page.url);
		url.searchParams.delete('open');
		for (const [k, v] of Object.entries(patch)) url.searchParams.set(k, v);
		return url.pathname + url.search;
	};
	const toggleOpen = (id: string) => patchUrl({ open: openId === id ? null : id }, true);
	const clearFilters = () => patchUrl(Object.fromEntries(FILTERS.map((f) => [f, null])));

	function toggleKind(kind: FeedKind) {
		const next = kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind];
		patchUrl({ soort: next.join(',') || null });
	}

	// The search text goes into the URL when the typing pauses.
	let qDraft = $state<string | null>(null);
	let qTimer: ReturnType<typeof setTimeout> | undefined;
	function typeQuery(v: string) {
		qDraft = v;
		clearTimeout(qTimer);
		qTimer = setTimeout(() => patchUrl({ q: v || null }, true), v ? 300 : 0);
	}
	$effect(() => {
		if (qDraft === q) qDraft = null;
	});

	// Following the words searched: new matches on /onderwerpen, kept in this browser.
	let gevolgd = $derived(volgt(q));
	function volgQ() {
		volg([q]);
		gevolgd = volgt(q);
	}

	// ── The feed ────────────────────────────────────────────────────────────
	type Query = NonNullable<paths['/api/feed']['get']['parameters']['query']>;
	const query = $derived<Query>({
		kind: kinds.join(',') || undefined,
		since: since || undefined,
		// Only a day in the past: with `until` the API counts apart and took 100+ s (prod,
		// 9 Oct), without it 0.25 s. What lies ahead is left out here instead (`shown`).
		until: until && until < today ? until : undefined,
		cabinet: cabinet || undefined,
		ministry: (ministry || undefined) as Schema<'MinistryKey'> | undefined,
		dossier: dossier || undefined,
		member: member || undefined,
		faction: faction || undefined,
		// API 0.79.30 takes several q; one as before (Front-end #2 widens it).
		q: q ? [q] : undefined,
		chamber: chamber || undefined,
		limit: 100
	});

	let items = $state<FeedItem[]>([]);
	let cursor = $state<string | null>(null);
	let total = $state<number | null>(null);
	/** The counts are under way, or the API answered without them in time (`partial`). */
	let tellen = $state(false);
	let facets = $state<Schema<'FeedFacetsDTO'> | null>(null);
	let loading = $state(true);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);
	/** The API gave up on the words searched (30 s): a shorter period is quick. */
	let teLang = $state(false);
	/** As long as the API waits on a slow query. */
	const WACHT = 35_000;
	const dagenTerug = (n: number) =>
		new Date(Date.parse(today) - n * 86_400_000).toISOString().slice(0, 10);
	/** A shorter period to offer, when the one asked is longer. */
	const korter = $derived(
		[
			{ dagen: 91, label: 'De afgelopen 3 maanden' },
			{ dagen: 365, label: 'Het afgelopen jaar' }
		].filter((k) => !since || since < dagenTerug(k.dagen))
	);

	// The items first, the counts beside them in a request of their own: a slow or failed
	// count leaves the items standing, and the filters show their counts when they come.
	// Other words searched: the list of the words before goes at once, or it reads as the
	// answer to the new ones (FE1 audit, 9 Oct).
	let gezocht = untrack(() => q);
	$effect(() => {
		const q = query;
		const ac = new AbortController();
		loading = true;
		error = null;
		teLang = false;
		doorzocht = null;
		if ((q.q ?? []).join(' ') !== gezocht) {
			gezocht = (q.q ?? []).join(' ');
			items = [];
			cursor = null;
		}
		unwrap(
			api.GET('/api/feed', {
				params: { query: { ...q, facets: false } },
				signal: AbortSignal.any([ac.signal, AbortSignal.timeout(WACHT)])
			})
		)
			.then((r) => {
				items = r.items.map(normalizeItem);
				cursor = r.next_cursor ?? null;
				stand = feedStand(r.data_as_of) ?? stand;
				doorzocht = doorzochtVanaf(r);
			})
			.catch((e) => {
				if (ac.signal.aborted) return;
				// No list under filters it does not answer.
				items = [];
				cursor = null;
				teLang =
					(e instanceof ApiError && (e.status === 503 || e.status === 504)) ||
					(e instanceof DOMException && e.name === 'TimeoutError');
				error = teLang ? 'Zoeken duurt te lang.' : 'Actueel kon niet worden geladen.';
			})
			.finally(() => {
				if (!ac.signal.aborted) loading = false;
			});
		facets = null;
		total = null;
		tellen = true;
		// Without the counts in 3 s the API answers `partial` (0.79.14) and counts on: asked
		// once more after 30 s, or with the next filter. Then the filters stand without them.
		let opnieuw: ReturnType<typeof setTimeout> | undefined;
		const tel = (poging: number) =>
			unwrap(
				api.GET('/api/feed', {
					params: { query: { ...q, limit: 1, facets: true } },
					signal: ac.signal
				})
			)
				.then((r) => {
					if ((r as { partial?: boolean }).partial && !r.facets) {
						if (poging === 0) opnieuw = setTimeout(() => tel(1), 30_000);
						else tellen = false;
						return;
					}
					facets = r.facets ?? null;
					total = r.total ?? null;
					tellen = false;
				})
				.catch(() => {
					if (!ac.signal.aborted) tellen = false;
				});
		void tel(0);
		return () => {
			clearTimeout(opnieuw);
			ac.abort();
		};
	});

	// The API searches words for a while and then answers with what it found, from the day it
	// reached (0.79.28): further back is the same question up to the day before.
	let doorzocht = $state<string | null>(null);
	let verderLaden = $state(false);
	async function verderTerug() {
		if (!doorzocht || verderLaden) return;
		verderLaden = true;
		try {
			const r = await unwrap(
				api.GET('/api/feed', {
					params: { query: { ...query, until: dagVoor(doorzocht), facets: false } },
					signal: AbortSignal.timeout(WACHT)
				})
			);
			items = uniqueBy([...items, ...r.items.map(normalizeItem)], (i) => i.id);
			cursor = r.next_cursor ?? null;
			doorzocht = doorzochtVanaf(r);
		} catch {
			error = 'Verder terug zoeken lukte niet.';
		} finally {
			verderLaden = false;
		}
	}

	async function loadMore() {
		if (!cursor || loadingMore) return;
		loadingMore = true;
		try {
			const r = await unwrap(
				api.GET('/api/feed', { params: { query: { ...query, cursor, facets: false } } })
			);
			items = uniqueBy([...items, ...r.items.map(normalizeItem)], (i) => i.id);
			cursor = r.next_cursor ?? null;
		} catch {
			error = 'De volgende dagen konden niet worden geladen.';
		} finally {
			loadingMore = false;
		}
	}

	// Without a day asked, what lies ahead (an inwerkingtreding) waits for "komend".
	const tot = $derived(until && until < today ? until : today);
	const shown = $derived(ahead ? items : items.filter((i) => i.date <= tot));
	const days = $derived(daysOf(shown));

	// The whole of each day loaded, under the same filters: a day a page cuts off is
	// counted in full. Asked again when the filters change or more days come in.
	let summaries = $state<Map<string, DaySummary>>(new Map());
	const span = $derived.by(() => {
		const newest = days[0]?.date;
		const oldest = days.at(-1)?.date;
		if (!newest || !oldest) return null;
		const count = Math.round((Date.parse(newest) - Date.parse(oldest)) / 86_400_000) + 1;
		return { until: newest, days: Math.min(count, SUMMARY_DAYS_MAX) };
	});
	$effect(() => {
		const s = span;
		const { kind, cabinet, ministry, dossier, member, faction, q, chamber } = query;
		if (!s) return;
		const ac = new AbortController();
		unwrap(
			api.GET('/api/feed/summary', {
				params: {
					query: {
						...s,
						kind,
						cabinet,
						ministry,
						dossier,
						member,
						faction,
						q,
						chamber,
						margin: CLOSE_VOTE,
						limit: 1
					}
				},
				signal: ac.signal
			})
		)
			.then((r) => (summaries = new Map((r.days ?? []).map((d) => [d.date, d]))))
			.catch(() => {});
		return () => ac.abort();
	});

	// How current the data is, whatever the filters: from `data_as_of` of each response.
	let stand = $state<ReturnType<typeof feedStand>>(null);

	// ── Names for the filters ───────────────────────────────────────────────
	let cabinets = $state<Cabinet[]>([]);
	let ministries = $state<Ministry[]>([]);
	let colors = $state<Record<string, string>>({});
	let factionNames = $state<Record<string, string>>({});
	$effect(() => {
		getCabinets()
			.then((c) => (cabinets = c))
			.catch(() => {});
		getMinistries()
			.then((m) => (ministries = m))
			.catch(() => {});
		getPartyColors()
			.then((c) => (colors = c))
			.catch(() => {});
		unwrap(api.GET('/api/factions'))
			.then(
				(f) =>
					(factionNames = Object.fromEntries(
						f.map((x) => [x.key, x.abbreviation ?? x.name ?? x.key])
					))
			)
			.catch(() => {});
	});
	const colorOf = (short: string | null | undefined) =>
		short ? (colors[short] ?? partyColor(short)) : 'var(--rule-strong)';
	const ministryName = (key: string | null | undefined) =>
		(key && ministries.find((m) => m.key === key)?.name) || key || '';
	const cabinetName = (key: string) => cabinets.find((c) => c.key === key)?.name ?? key;
	const memberName = $derived(
		items.flatMap((i) => i.persons).find((p) => p.key === member)?.name ?? 'Gekozen persoon'
	);

	const facetMap = (list: { value?: string | null; count: number }[] | undefined) =>
		new Map((list ?? []).flatMap((f) => (f.value ? [[f.value, f.count] as const] : [])));

	const groups = $derived.by<FacetGroup[]>(() => {
		const kindCounts = facetMap(facets?.kind);
		// Every fraction, as on Kamerleden; the chosen one also when this view has none of it.
		const factionMap = facetMap(facets?.faction);
		if (faction && !factionMap.has(faction)) factionMap.set(faction, 0);
		const factionCounts = [...factionMap];
		return [
			{
				// First, as the concept has it. TODO(backend): a facet per chamber, to count them.
				id: 'kamer',
				label: 'Kamer',
				kind: 'list',
				options: (['TK', 'EK'] as const).map((c) => ({
					id: c,
					label: c === 'TK' ? 'Tweede Kamer' : 'Eerste Kamer',
					on: chamber === c,
					onClick: () => patchUrl({ kamer: chamber === c ? null : c })
				}))
			},
			{
				id: 'soort',
				label: 'Soort',
				kind: 'list',
				options: FEED_KINDS.map((k) => ({
					id: k,
					label: KIND_LABEL[k].one,
					// While counting, "…" beside each kind (IndexFacets `pending`).
					count: facets ? (kindCounts.get(k) ?? 0) : tellen ? 0 : undefined,
					on: kinds.includes(k),
					onClick: () => toggleKind(k)
				}))
			},
			{
				id: 'fractie',
				label: 'Fractie',
				kind: 'list',
				options: factionCounts.map(([key, count]) => {
					const short = factionNames[key] ?? key;
					return {
						id: key,
						label: short,
						count,
						swatch: colorOf(short),
						on: faction === key,
						onClick: () => patchUrl({ fractie: faction === key ? null : key })
					};
				})
			},
			{
				id: 'ministerie',
				label: 'Ministerie',
				kind: 'select',
				value: ministry,
				all: 'Alle ministeries',
				options: [...facetMap(facets?.ministry)].map(([key, count]) => ({
					value: key,
					label: ministryName(key),
					count
				})),
				onChange: (v) => patchUrl({ ministerie: v || null })
			},
			{
				id: 'kabinet',
				label: 'Kabinet',
				kind: 'select',
				value: cabinet,
				all: 'Alle kabinetten',
				options: [...facetMap(facets?.cabinet)].map(([key, count]) => ({
					value: key,
					label: cabinetName(key),
					count
				})),
				onChange: (v) => patchUrl({ kabinet: v || null })
			},
			{
				id: 'dossier',
				label: 'Dossier',
				kind: 'text',
				value: dossier,
				placeholder: 'Kamerstuknummer',
				onChange: (v) => patchUrl({ dossier: v || null })
			},
			...(member
				? [
						{
							id: 'persoon',
							label: 'Persoon',
							kind: 'list' as const,
							options: [
								{
									id: member,
									label: memberName,
									on: true,
									onClick: () => patchUrl({ persoon: null })
								}
							]
						}
					]
				: []),
			{
				id: 'komend',
				label: 'Weergave',
				kind: 'list',
				options: [
					{
						id: 'komend',
						label: 'Ook komende inwerkingtredingen',
						on: ahead,
						onClick: () => patchUrl({ komend: ahead ? null : '1' })
					}
				]
			}
		];
	});
	const chips = $derived(activeFilters(groups));
	let filtersOpen = $state(false);

	/**
	 * The same view as an Atom feed. Only the filters chosen: the page's own end of today is
	 * left out, or a subscribed feed would stop at the day it was subscribed.
	 */
	const atomHref = $derived.by(() => {
		const p = atomParams(query as Record<string, string | number | undefined>, until);
		return `${API_BASE_URL}/api/feed.atom${p.size ? `?${p}` : ''}`;
	});

	function onKey(e: KeyboardEvent) {
		if (isEscape(e) && openId) patchUrl({ open: null }, true);
	}
</script>

<RouteKop pad="/actueel" />

{#snippet verder()}
	{#if doorzocht}
		<p class="doorzocht">
			Doorzocht vanaf {shortDate(doorzocht)}.
			<button type="button" onclick={verderTerug} disabled={verderLaden}
				>{verderLaden ? 'Laden…' : 'Zoek verder terug'}</button
			>
		</p>
	{/if}
{/snippet}
<svelte:window onkeydown={onKey} />

<div class="actueel">
	<header class="kop">
		<div>
			<h1 class="title">Actueel</h1>
			{#if stand}<p class="stand">{standLine(stand)}</p>{/if}
		</div>
		<div class="acties">
			<a class="actie-knop" href={atomHref} rel="alternate" type="application/atom+xml">Atom-feed</a
			>
			{#if q}
				{#if gevolgd}
					<a class="actie-knop" href="/onderwerpen">Gevolgd als onderwerp</a>
				{:else}
					<button
						type="button"
						class="actie-knop"
						title="Volg deze woorden in Onderwerpen"
						onclick={volgQ}>Volg als onderwerp</button
					>
				{/if}
			{/if}
		</div>
	</header>

	<!-- The one line above the list: the page's field and the period, nothing else. -->
	<div class="regel">
		<label class="search">
			<span class="visually-hidden">Zoek in Actueel</span>
			<input
				type="search"
				placeholder="Zoek in titels en dossiertitels"
				value={qDraft ?? q}
				oninput={(e) => typeQuery(e.currentTarget.value)}
			/>
		</label>
		<div class="periode">
			<Periode
				van={since}
				tot={until}
				onChange={(van, tot) => patchUrl({ van: van || null, tot: tot || null })}
			/>
		</div>
	</div>

	<aside class="filters" aria-label="Verfijnen">
		<button
			type="button"
			class="verfijnen-knop"
			aria-expanded={filtersOpen}
			aria-controls="actueel-facetten"
			onclick={() => (filtersOpen = !filtersOpen)}
			>Verfijnen{chips.length ? ` (${chips.length})` : ''}</button
		>
		<div class="filters-body" id="actueel-facetten" class:filters-body--open={filtersOpen}>
			<IndexFacets {groups} pending={tellen} />
			{#if chips.length}
				<p class="wis"><TekstLink onclick={clearFilters}>Wis alle filters</TekstLink></p>
			{/if}
		</div>
	</aside>

	<main class="feed" aria-busy={loading}>
		<div class="head">
			{#if total !== null}
				<p class="count">
					{total.toLocaleString('nl-NL')}
					<span class="noun">{total === 1 ? 'gebeurtenis' : 'gebeurtenissen'}</span>
				</p>
			{:else if tellen}
				<p class="count"><span class="noun">tellen…</span></p>
			{/if}
		</div>

		{#if loading && !items.length}
			<p class="status">Laden…</p>
		{:else if error && !items.length}
			<div class="status status--error">
				<p>{error}</p>
				{#if teLang && korter.length}
					<p class="korter">
						{#each korter as k (k.dagen)}
							<button type="button" onclick={() => patchUrl({ van: dagenTerug(k.dagen) })}
								>{k.label}</button
							>
						{/each}
					</p>
				{/if}
			</div>
		{:else if !items.length}
			<div class="empty">
				<p>Geen gebeurtenissen{chips.length ? ' met deze filters' : ''}.</p>
				{#if stand}<p class="stand">{standLine(stand)}</p>{/if}
				{@render verder()}
			</div>
		{:else}
			<div class="days" class:days--stale={loading}>
				{#each days as day (day.date)}
					<FeedDay
						{day}
						{today}
						{openId}
						onToggle={toggleOpen}
						{colorOf}
						{ministryName}
						{filterHref}
						summary={summaries.get(day.date)}
					/>
				{/each}
			</div>
			{@render verder()}
			{#if cursor && !doorzocht}
				<div class="more">
					<button type="button" onclick={loadMore} disabled={loadingMore}
						>{loadingMore ? 'Laden…' : 'Meer laden'}</button
					>
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	.actueel {
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		column-gap: var(--s-7);
		max-width: 1320px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-8);
		--row-lead: 132px;
		--row-aside: 150px;
	}
	.kop,
	.regel {
		grid-column: 1 / -1;
	}
	.kop {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--s-3);
		margin-bottom: var(--s-4);
	}
	.title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 600;
	}
	.stand {
		margin: var(--s-1) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.acties {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	/* The page's actions beside its heading: Atom-feed, Volg als onderwerp. */
	.actie-knop {
		display: inline-flex;
		align-items: center;
		height: var(--veld-h);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink);
		text-decoration: none;
		cursor: pointer;
	}
	.actie-knop:hover {
		border-color: var(--ink);
	}
	/* The field and the period on one line, without rules around it. */
	.regel {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--s-2) var(--s-4);
		margin-bottom: var(--s-5);
	}
	.regel .search {
		flex: 1 1 320px;
		min-width: 0;
	}
	.regel .periode {
		flex: 0 1 380px;
		min-width: 0;
	}
	.filters {
		position: sticky;
		top: var(--s-4);
		align-self: start;
		max-height: calc(100vh - var(--s-6));
		overflow-y: auto;
	}
	.verfijnen-knop {
		display: none;
	}
	.wis {
		margin: var(--s-3) 0 0;
	}

	/* The count above the list, on the ink rule that opens it. */
	.head {
		display: flex;
		align-items: baseline;
		margin: 0 0 var(--s-3);
		padding-bottom: var(--s-2);
		border-bottom: 2px solid var(--ink);
	}
	.count {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 800;
	}
	.noun {
		margin-left: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 400;
		color: var(--ink-3);
	}
	.search input {
		width: 100%;
		box-sizing: border-box;
		height: var(--veld-h);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink);
	}
	.search input::placeholder {
		color: var(--ink-3);
	}

	.days--stale {
		opacity: 0.6;
	}
	.status,
	.empty {
		margin: var(--s-5) 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.status--error {
		color: var(--accent);
	}
	.status--error p {
		margin: 0 0 var(--s-2);
	}
	.korter {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.korter button {
		padding: var(--s-2) var(--s-4);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: transparent;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink);
		cursor: pointer;
	}
	.korter button:hover {
		background: var(--paper-2);
	}
	.empty p {
		margin: 0 0 var(--s-1);
	}
	.doorzocht {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2) var(--s-3);
		margin: var(--s-5) 0;
		color: var(--ink-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.doorzocht button {
		padding: var(--s-1) var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-family: var(--font-ui);
		cursor: pointer;
	}
	.more {
		display: flex;
		justify-content: center;
		padding: var(--s-5) 0;
	}
	.more button {
		padding: var(--s-2) var(--s-4);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: transparent;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink);
		cursor: pointer;
	}
	.more button:hover:not(:disabled) {
		background: var(--paper-2);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 767px) {
		.actueel {
			grid-template-columns: minmax(0, 1fr);
			padding: var(--s-4) var(--s-4) var(--s-7);
		}
		.kop {
			flex-direction: column;
		}
		.regel {
			margin-bottom: var(--s-3);
		}
		.regel .search,
		.regel .periode {
			flex: 1 1 100%;
		}
		.filters {
			position: static;
			max-height: none;
			overflow: visible;
			margin-bottom: var(--s-4);
		}
		/* The facets behind one quiet line: Verfijnen, with how many are chosen. */
		.verfijnen-knop {
			display: inline-block;
			padding: 0;
			border: 0;
			background: none;
			font-family: var(--font-ui);
			font-size: var(--t-ui);
			color: var(--ink);
			text-decoration: underline;
			text-decoration-color: var(--rule-strong);
			text-underline-offset: 4px;
			cursor: pointer;
		}
		.filters-body {
			display: none;
			padding-top: var(--s-3);
		}
		.filters-body--open {
			display: block;
		}
	}
</style>
