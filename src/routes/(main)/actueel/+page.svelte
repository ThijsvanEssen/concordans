<script lang="ts">
	import { BOTH_CHAMBERS, CHAMBER_CHOICES } from '$lib/components/parliamentary/chamber';
	import { plural } from '$lib/text/words';
	import { lijstDoel } from '$lib/stores/sprong';
	import { fractieNaam } from '$lib/bron/menselijk';
	import { addDays, daysBetween, vandaag } from '$lib/text/datum';
	import { formatCount } from '$lib/text/getal';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import Bepaalregel from '$lib/components/ui/Bepaalregel.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { uniqueBy } from '$lib/util/unique';
	import {
		splitsTermen,
		volg,
		volgt,
		volgtWet,
		volgWet,
		type GevolgdeWet
	} from '$lib/onderwerpen/onderwerpen';
	import { getInstrumentDetail } from '$lib/api/instrument-cache';
	// Actueel: what happened in the Kamer and the government, newest first, per day. Every
	// filter and the line opened are in the URL, so a view can be shared; the same view is an
	// Atom feed. Beside it, the day of the newest event: how current the data is.
	import { isEscape } from '$lib/actions/keys';
	import { page } from '$app/state';
	import { navigate, withParams, type ParamPatch } from '$lib/util/address';
	import { ApiError, isTimeout } from '$lib/api/client';
	import { getFeed, getFeedSummary } from '$lib/api/feed';
	import { getFactions } from '$lib/api/factions';
	import { report } from '$lib/api/errors';
	import { tick, untrack } from 'svelte';
	import { focusFirstNew } from '$lib/actions/rijen';
	import type { Schema } from '$lib/api/types';
	import { partyColor } from '$lib/components/explore/party-color.svelte';
	import IndexFacets, {
		activeFilters,
		selectOptions,
		type FacetGroup
	} from '$lib/components/explore/index/IndexFacets.svelte';
	// Filters v2 (Thijs, 10 Oct: "ziet er goed uit"; ux-voorstel/filters/v2): the field and
	// Periode on one line above the list, the facets with their counts on the left, a chosen
	// option in bold where it is chosen and nowhere else; on a phone behind Verfijnen (N).
	import { type Cabinet } from '$lib/components/explore/index/government';
	import { getCabinets } from '$lib/api/government';
	import { ministryName } from '$lib/components/explore/index/ministries.svelte';
	import FeedDay from '$lib/components/actueel/FeedDay.svelte';
	import Doorzocht from '$lib/components/actueel/Doorzocht.svelte';
	import {
		COALITION,
		FEED_FILTER_PARAMS,
		feedQuery,
		readFilters,
		summaryQuery,
		type CoalitionWord,
		type FeedQuery
	} from '$lib/components/actueel/filters';
	import {
		CLOSE_VOTE,
		FEED_KINDS,
		KIND_LABEL,
		atomHref,
		daysOf,
		wholeDays,
		doorzochtVanaf,
		errorPlace,
		normalizeItem,
		summaryAsk,
		type DaySummary,
		type FeedItem,
		type FeedKind,
		type SummarySpan
	} from '$lib/components/actueel/feed';
	import { feedStand, standLine } from '$lib/text/stand';
	import { FEED_PAGE } from '$lib/api/first-pages';

	const today = vandaag();
	/** The days one summary spans at most, as the API allows. */
	const SUMMARY_DAYS_MAX = 31;

	/** Events per page of the feed (first-pages.json). */
	const PAGE_SIZE = FEED_PAGE;

	// ── The URL ─────────────────────────────────────────────────────────────
	// Every filter from its row in filters.ts; the line opened beside them.
	const filters = $derived(readFilters(page.url.searchParams));
	const {
		kinds,
		since,
		until,
		cabinet,
		ministry,
		dossier,
		member,
		faction,
		coalition,
		q,
		chamber,
		instrument,
		article,
		ahead
	} = $derived(filters);
	const openId = $derived(page.url.searchParams.get('open'));

	/** A filter is a step in the history and closes the open line; typing or opening replaces it. */
	function patchUrl(patch: ParamPatch, replaceState = false) {
		const clear = 'open' in patch ? [] : ['open'];
		navigate(withParams(page.url, patch, { clear }), { step: !replaceState });
	}
	const filterHref = (patch: ParamPatch) => withParams(page.url, patch, { clear: ['open'] });
	const toggleOpen = (id: string) => patchUrl({ open: openId === id ? null : id }, true);
	const clearFilters = () => patchUrl(Object.fromEntries(FEED_FILTER_PARAMS.map((f) => [f, null])));

	function toggleKind(kind: FeedKind) {
		const next = kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind];
		patchUrl({ soort: next.join(',') || null });
	}

	// The search text goes into the URL when the typing pauses; words apart by `;` or `,`,
	// as a followed topic has them, each a q of its own. The field keeps what was typed (its
	// spaces, its commas) until the address says other words: a filter cleared, a step back.
	const qText = $derived(q.join('; '));
	let qDraft = $state<string | null>(null);
	let qPending = false;
	let qTimer: ReturnType<typeof setTimeout> | undefined;
	function typeQuery(v: string) {
		qDraft = v;
		qPending = true;
		clearTimeout(qTimer);
		qTimer = setTimeout(
			() => {
				qPending = false;
				patchUrl({ q: splitsTermen(v) }, true);
			},
			v ? 300 : 0
		);
	}
	$effect(() => {
		const text = qText;
		untrack(() => {
			if (!qPending && qDraft !== null && splitsTermen(qDraft).join('; ') !== text) qDraft = null;
		});
	});

	// Following the words searched: new matches on /onderwerpen, kept in this browser.
	let gevolgd = $derived(q.some(volgt));
	function volgQ() {
		volg(q);
		gevolgd = q.some(volgt);
	}

	// The law chosen by its name, asked once; following it, or its article, as the words.
	let wetTitel = $state<{ bwb: string; titel: string } | null>(null);
	$effect(() => {
		const bwb = instrument;
		if (!bwb || wetTitel?.bwb === bwb) return;
		getInstrumentDetail(bwb)
			.then((d) => (wetTitel = { bwb, titel: d.title ?? bwb }))
			.catch((e) => {
				report('Actueel wet', e);
				wetTitel = { bwb, titel: bwb };
			});
	});
	const gevolgdeWet = $derived<GevolgdeWet | null>(
		instrument
			? {
					bwb: instrument,
					titel: wetTitel?.bwb === instrument ? wetTitel.titel : instrument,
					artikel: article || null
				}
			: null
	);
	let wetGevolgd = $derived(gevolgdeWet ? volgtWet(gevolgdeWet) : false);
	function volgDezeWet() {
		if (!gevolgdeWet) return;
		volgWet(gevolgdeWet);
		wetGevolgd = volgtWet(gevolgdeWet);
	}

	// ── The feed ────────────────────────────────────────────────────────────
	const query = $derived<FeedQuery>({ ...feedQuery(filters, today), limit: PAGE_SIZE });

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
	/** A shorter period to offer, when the one asked is longer. */
	const korter = $derived(
		[
			{ dagen: 91, label: 'De afgelopen 3 maanden' },
			{ dagen: 365, label: 'Het afgelopen jaar' }
		].filter((k) => !since || since < addDays(today, -k.dagen))
	);

	// The items first, the counts beside them in a request of their own: a slow or failed
	// count leaves the items standing, and the filters show their counts when they come.
	// Other words searched: the list of the words before goes at once, or it reads as the
	// answer to the new ones (FE1 audit, 9 Oct).
	let gezocht = untrack(() => q.join(' '));
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
		getFeed({ ...q, facets: false }, { signal: ac.signal })
			.then((r) => {
				items = r.items.map(normalizeItem);
				cursor = r.next_cursor ?? null;
				feedFilters = JSON.stringify(summaryQuery(q));
				stand = feedStand(r.data_as_of) ?? stand;
				doorzocht = doorzochtVanaf(r);
			})
			.catch((e) => {
				if (ac.signal.aborted) return;
				report('Actueel', e);
				// No list under filters it does not answer.
				items = [];
				cursor = null;
				teLang = (e instanceof ApiError && (e.status === 503 || e.status === 504)) || isTimeout(e);
				error = teLang ? 'Zoeken duurt te lang.' : 'Actueel kon niet worden geladen.';
			})
			.finally(() => {
				if (!ac.signal.aborted) loading = false;
			});
		facets = null;
		total = null;
		tellen = true;
		// Without the counts in 3 s the API answers `partial` (0.79.14) and counts on: asked
		// once more after 30 s past the browser's cache (which keeps the partial answer 60 s),
		// or with the next filter. Then the filters stand without them.
		let opnieuw: ReturnType<typeof setTimeout> | undefined;
		const tel = (poging: number): void => {
			getFeed(
				{ ...q, limit: 1, facets: true },
				{ signal: ac.signal, wait: 'short', fresh: poging > 0 }
			)
				.then((r) => {
					if (r.partial && !r.facets) {
						if (poging === 0) opnieuw = setTimeout(() => tel(1), 30_000);
						else tellen = false;
						return;
					}
					facets = r.facets ?? null;
					total = r.total ?? null;
					tellen = false;
				})
				.catch((e) => {
					// The list stands; the filters without their counts.
					report('Actueel tellingen', e);
					if (!ac.signal.aborted) tellen = false;
				});
		};
		tel(0);
		return () => {
			clearTimeout(opnieuw);
			ac.abort();
		};
	});

	// The API searches words (0.79.28) or a fractie (0.79.48, #581) for a while and then answers
	// with what it found, from the day it reached: further back is the same question up to the
	// day before. A next page can stop short too.
	let doorzocht = $state<string | null>(null);
	let verderLaden = $state(false);
	async function verderTerug() {
		if (!doorzocht || verderLaden) return;
		verderLaden = true;
		error = null;
		try {
			const r = await getFeed({ ...query, until: addDays(doorzocht, -1), facets: false });
			items = uniqueBy([...items, ...r.items.map(normalizeItem)], (i) => i.id);
			cursor = r.next_cursor ?? null;
			doorzocht = doorzochtVanaf(r);
		} catch (e) {
			report('Actueel verder terug', e);
			error = 'Verder terug zoeken lukte niet.';
		} finally {
			verderLaden = false;
		}
	}

	/** A row of the timeline, for the focus after Volgende dagen. */
	const ROW = '.regel';
	let daysEl = $state<HTMLElement | null>(null);

	async function loadMore() {
		if (!cursor || loadingMore) return;
		loadingMore = true;
		error = null;
		// The focus to the first row the page adds: the link gives way to "Laden…" (F3, as Bladeren).
		const before = daysEl?.querySelectorAll(ROW).length ?? 0;
		try {
			const r = await getFeed({ ...query, cursor, facets: false });
			items = uniqueBy([...items, ...r.items.map(normalizeItem)], (i) => i.id);
			cursor = r.next_cursor ?? null;
			doorzocht = doorzochtVanaf(r);
			await tick();
			if (daysEl) focusFirstNew(daysEl, ROW, before);
		} catch (e) {
			report('Actueel volgende dagen', e);
			error = 'De volgende dagen konden niet worden geladen.';
		} finally {
			loadingMore = false;
		}
	}

	// Without a day asked, what lies ahead (an inwerkingtreding) waits for "komend".
	const tot = $derived(until && until < today ? until : today);
	// A day a page cut off waits for the next page, so its rows do not fold under the reader.
	const shown = $derived(
		wholeDays(ahead ? items : items.filter((i) => i.date <= tot), !!cursor && !doorzocht)
	);
	const days = $derived(daysOf(shown));

	// The whole of each day loaded, under the same filters: a day a page cuts off is
	// counted in full. Asked once the feed has answered the filters shown (not with their
	// days before), the whole span for other filters, only the days added for a next page.
	let summaries = $state<Map<string, DaySummary>>(new Map());
	/** The filters of the days shown, as the summary takes them; set with the feed's answer. */
	let feedFilters = $state<string | null>(null);
	/** The days counted in `summaries`, and under which filters. */
	let counted: { filters: string; span: SummarySpan } | null = null;
	const span = $derived.by<SummarySpan | null>(() => {
		const newest = days[0]?.date;
		const oldest = days.at(-1)?.date;
		if (!newest || !oldest) return null;
		const count = Math.round(daysBetween(oldest, newest)) + 1;
		return { until: newest, days: Math.min(count, SUMMARY_DAYS_MAX) };
	});
	const summaryKey = $derived(
		span && feedFilters ? `${span.until}|${span.days}|${feedFilters}` : null
	);
	$effect(() => {
		if (!summaryKey) return;
		const [s, filters] = untrack(() => [span!, feedFilters!] as const);
		const had = counted?.filters === filters ? counted.span : null;
		const ask = summaryAsk(s, had);
		if (!ask) return;
		const ac = new AbortController();
		getFeedSummary({ ...ask, ...JSON.parse(filters), margin: CLOSE_VOTE, limit: 1 }, ac.signal)
			.then((r) => {
				const found = (r.days ?? []).map((d) => [d.date, d] as const);
				summaries = new Map(had ? [...summaries, ...found] : found);
				counted = { filters, span: s };
			})
			// A day stands without its whole count.
			.catch((e) => report('Actueel dagtellingen', e));
		return () => ac.abort();
	});

	// How current the data is, whatever the filters: from `data_as_of` of each response.
	let stand = $state<ReturnType<typeof feedStand>>(null);

	// ── Names for the filters ───────────────────────────────────────────────
	let cabinets = $state<Cabinet[]>([]);
	let factionNames = $state<Record<string, string>>({});
	$effect(() => {
		// A filter without its name shows its key.
		getCabinets()
			.then((c) => (cabinets = c))
			.catch((e) => report('Actueel kabinetten', e));
		getFactions()
			.then((f) => (factionNames = Object.fromEntries(f.map((x) => [x.key, fractieNaam(x)]))))
			.catch((e) => report('Actueel fracties', e));
	});
	const cabinetName = (key: string) => cabinets.find((c) => c.key === key)?.name ?? key;
	const memberName = $derived(
		items.flatMap((i) => i.persons).find((p) => p.key === member)?.name ?? 'Gekozen persoon'
	);

	const facetMap = (list: { value?: string | null; count: number }[] | undefined) =>
		new Map((list ?? []).flatMap((f) => (f.value ? [[f.value, f.count] as const] : [])));

	const coalitionCounts = $derived(facetMap(facets?.coalition));
	const groups = $derived.by<FacetGroup[]>(() => {
		const kindCounts = facetMap(facets?.kind);
		// Every fraction, as on Kamerleden; the chosen one also when this view has none of it.
		const factionMap = facetMap(facets?.faction);
		if (faction && !factionMap.has(faction)) factionMap.set(faction, 0);
		const factionCounts = [...factionMap];
		return [
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
						swatch: partyColor(short),
						on: faction === key,
						onClick: () => patchUrl({ fractie: faction === key ? null : key })
					};
				})
			},
			// Only where the votes of the view have a coalition (the Tweede Kamer, a cabinet in
			// office); a chosen value stays to be undone.
			...(coalitionCounts.size || coalition
				? [
						{
							id: 'coalitie',
							label: 'Coalitie',
							kind: 'list' as const,
							options: (Object.keys(COALITION) as CoalitionWord[]).map((k) => ({
								id: k,
								label: COALITION[k].label,
								count: coalitionCounts.get(COALITION[k].api) ?? 0,
								on: coalition === k,
								onClick: () => patchUrl({ coalitie: coalition === k ? null : k })
							}))
						}
					]
				: []),
			{
				id: 'ministerie',
				label: 'Ministerie',
				kind: 'select',
				value: ministry,
				all: 'Alle ministeries',
				options: selectOptions(facetMap(facets?.ministry), ministry, ministryName),
				onChange: (v) => patchUrl({ ministerie: v || null })
			},
			{
				id: 'kabinet',
				label: 'Kabinet',
				kind: 'select',
				value: cabinet,
				all: 'Alle kabinetten',
				options: selectOptions(facetMap(facets?.cabinet), cabinet, cabinetName),
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
			// The law followed through an address (`?wet=`): chosen, to undo.
			...(instrument
				? [
						{
							id: 'wet',
							label: 'Wet',
							kind: 'list' as const,
							options: [
								{
									id: instrument,
									label: gevolgdeWet ? wetNaamKort(gevolgdeWet) : instrument,
									on: true,
									onClick: () => patchUrl({ wet: null, artikel: null })
								}
							]
						}
					]
				: []),
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
	/** `Cyberbeveiligingswet`, `art. 3 Cyberbeveiligingswet`: the law chosen, as a filter names it. */
	function wetNaamKort(w: GevolgdeWet) {
		return w.artikel ? `art. ${w.artikel} ${w.titel}` : w.titel;
	}
	let filtersOpen = $state(false);

	/** The same view as an Atom feed: the filters chosen, so a subscribed feed keeps coming. */
	const atom = $derived(atomHref(query));

	function onKey(e: KeyboardEvent) {
		if (isEscape(e) && openId) patchUrl({ open: null }, true);
	}
</script>

<RouteKop />

<!-- Under the last day, in the text column of the timeline. -->
{#snippet volgende()}
	{#if loadingMore}<span class="stil">Laden…</span>{:else}<TekstLink onclick={loadMore}
			>Volgende dagen</TekstLink
		>{/if}
{/snippet}
{#snippet verder()}
	{#if doorzocht}
		<Doorzocht vanaf={doorzocht} loading={verderLaden} onVerder={verderTerug} />
	{/if}
{/snippet}
<svelte:window onkeydown={onKey} />

<div class="actueel blad blad__indeling">
	<header class="blad__kop">
		<div>
			<h1 class="blad__titel">Actueel</h1>
		</div>
		<div class="acties">
			<a class="btn is-groot" href={atom} rel="alternate" type="application/atom+xml">Atom-feed</a>
			{#if q.length}
				{#if gevolgd}
					<a class="btn is-groot" href="/onderwerpen">Gevolgd als onderwerp</a>
				{:else}
					<button
						type="button"
						class="btn is-groot"
						title="Volg deze woorden onder Gevolgd"
						onclick={volgQ}>Volg als onderwerp</button
					>
				{/if}
			{/if}
			{#if gevolgdeWet}
				{#if wetGevolgd}
					<a class="btn is-groot" href="/onderwerpen"
						>{article ? 'Artikel gevolgd' : 'Wet gevolgd'}</a
					>
				{:else}
					<button
						type="button"
						class="btn is-groot"
						title="Volg {wetNaamKort(gevolgdeWet)} onder Gevolgd"
						onclick={volgDezeWet}>{article ? 'Volg dit artikel' : 'Volg deze wet'}</button
					>
				{/if}
			{/if}
		</div>
	</header>

	<!-- The one line above the list: the page's field and the period, nothing else. -->
	<div class="regel">
		<Bepaalregel
			zoek={{
				waarde: qDraft ?? qText,
				placeholder: 'Zoek in titels en dossiertitels',
				naam: 'Zoek in Actueel',
				onInput: typeQuery
			}}
			periode={{
				van: since,
				tot: until,
				onChange: (van, tot) => patchUrl({ van: van || null, tot: tot || null })
			}}
			kamer={{
				waarde: chamber || BOTH_CHAMBERS,
				opties: CHAMBER_CHOICES,
				onKies: (v) => patchUrl({ kamer: v === BOTH_CHAMBERS ? null : v })
			}}
		/>
	</div>

	<aside class="filters blad__facetten" aria-label="Verfijnen">
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

	<!-- A div: the page has one main, AppShell's. -->
	<div class="feed" aria-busy={loading} use:lijstDoel>
		<div class="head">
			{#if total !== null}
				<p class="count">
					{formatCount(total)}
					<span class="noun">{plural(total, 'gebeurtenis', 'gebeurtenissen')}</span>
				</p>
			{:else if tellen}
				<p class="count"><span class="noun">tellen…</span></p>
			{/if}
		</div>

		{#if loading && !items.length}
			<p class="status stil">Laden…</p>
		{:else if errorPlace(error, items.length) === 'instead'}
			<div class="status status--error stil">
				<p>{error}</p>
				{#if teLang && korter.length}
					<p class="korter">
						{#each korter as k (k.dagen)}
							<button
								type="button"
								class="btn is-groot"
								onclick={() => patchUrl({ van: addDays(today, -k.dagen) })}>{k.label}</button
							>
						{/each}
					</p>
				{/if}
			</div>
		{:else if !items.length}
			<div class="empty">
				<p>Geen gebeurtenissen{chips.length ? ' met deze filters' : ''}.</p>
				<!-- Here how far the data goes says why nothing shows; elsewhere it is the footer's. -->
				{#if stand}<p class="stand">{standLine(stand)}</p>{/if}
				{@render verder()}
			</div>
		{:else}
			<div class="days" class:days--stale={loading} bind:this={daysEl}>
				{#each days as day, n (day.date)}
					<FeedDay
						{day}
						{today}
						{openId}
						onToggle={toggleOpen}
						{filterHref}
						summary={summaries.get(day.date)}
						termen={q}
						wet={gevolgdeWet}
						meer={n === days.length - 1 && cursor && !doorzocht ? volgende : undefined}
					/>
				{/each}
			</div>
			{#if errorPlace(error, items.length) === 'below'}
				<p class="stil" role="alert">{error}</p>
			{/if}
			{@render verder()}
		{/if}
	</div>
</div>

<style>
	/* The frame and grid of Bladeren (lib/styles/frame.css). */
	.regel {
		grid-column: 1 / -1;
	}
	.stand {
		margin: var(--s-1) 0 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.acties {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	/* The field and the period on one line, without rules around it. */
	.regel {
		margin-bottom: var(--s-5);
	}
	.wis {
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
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

	.days--stale {
		opacity: 0.6;
	}
	.status,
	.empty {
		margin: var(--s-5) 0;
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
	.empty p {
		margin: 0 0 var(--s-1);
	}

	@media (max-width: 768px) {
		.regel {
			margin-bottom: var(--s-3);
		}
		.filters {
			position: static;
			max-height: none;
			overflow: visible;
			margin-bottom: var(--s-4);
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
