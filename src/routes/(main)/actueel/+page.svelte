<script lang="ts">
	// Actueel: what happened in the Kamer and the government, newest first, per day. Every
	// filter and the line opened are in the URL, so a view can be shared; the same view is an
	// Atom feed. Beside it, the day of the newest event: how current the data is.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api, unwrap } from '$lib/api/client';
	import { API_BASE_URL } from '$lib/api/base-url';
	import type { Schema } from '$lib/api/types';
	import type { paths } from '$lib/api/generated/openapi-types';
	import { partyColor } from '$lib/utils/party-color.svelte';
	import IndexFacets, {
		activeFilters,
		type FacetGroup
	} from '$lib/components/explore/index/IndexFacets.svelte';
	import {
		getCabinets,
		getMinistries,
		getPartyColors,
		type Cabinet,
		type Ministry
	} from '$lib/components/explore/index/government';
	import FeedEntry from '$lib/components/actueel/FeedEntry.svelte';
	import {
		FEED_KINDS,
		KIND_LABEL,
		countLine,
		dayLabel,
		daysOf,
		isFeedKind,
		normalizeItem,
		shortDate,
		type FeedItem,
		type FeedKind
	} from '$lib/components/actueel/feed';

	const today = new Date().toISOString().slice(0, 10);

	// ── The URL ─────────────────────────────────────────────────────────────
	const params = $derived(page.url.searchParams);
	const kinds = $derived((params.get('soort') ?? '').split(',').filter(isFeedKind));
	const since = $derived(params.get('van') ?? '');
	const until = $derived(params.get('tot') ?? '');
	const cabinet = $derived(params.get('kabinet') ?? '');
	const ministry = $derived(params.get('ministerie') ?? '');
	const dossier = $derived(params.get('dossier') ?? '');
	const member = $derived(params.get('persoon') ?? '');
	const faction = $derived(params.get('fractie') ?? '');
	const q = $derived(params.get('q') ?? '');
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

	// ── The feed ────────────────────────────────────────────────────────────
	type Query = NonNullable<paths['/api/feed']['get']['parameters']['query']>;
	const query = $derived<Query>({
		kind: kinds.join(',') || undefined,
		since: since || undefined,
		until: until || (ahead ? undefined : today),
		cabinet: cabinet || undefined,
		ministry: (ministry || undefined) as Schema<'MinistryKey'> | undefined,
		dossier: dossier || undefined,
		member: member || undefined,
		faction: faction || undefined,
		q: q || undefined,
		limit: 100
	});

	let items = $state<FeedItem[]>([]);
	let cursor = $state<string | null>(null);
	let total = $state<number | null>(null);
	let facets = $state<Schema<'FeedFacetsDTO'> | null>(null);
	let loading = $state(true);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		const q = query;
		const ac = new AbortController();
		loading = true;
		error = null;
		unwrap(api.GET('/api/feed', { params: { query: { ...q, facets: true } }, signal: ac.signal }))
			.then((r) => {
				items = r.items.map(normalizeItem);
				cursor = r.next_cursor ?? null;
				total = r.total ?? null;
				facets = r.facets ?? null;
			})
			.catch(() => {
				if (!ac.signal.aborted) error = 'Actueel kon niet worden geladen.';
			})
			.finally(() => {
				if (!ac.signal.aborted) loading = false;
			});
		return () => ac.abort();
	});

	async function loadMore() {
		if (!cursor || loadingMore) return;
		loadingMore = true;
		try {
			const r = await unwrap(
				api.GET('/api/feed', { params: { query: { ...query, cursor, facets: false } } })
			);
			items = [...items, ...r.items.map(normalizeItem)];
			cursor = r.next_cursor ?? null;
		} catch {
			error = 'Meer laden lukte niet.';
		} finally {
			loadingMore = false;
		}
	}

	const days = $derived(daysOf(items));

	// How current the data is: the day of the newest event, whatever the filters.
	let newest = $state<string | null>(null);
	$effect(() => {
		// TODO(backend): a date of the data itself; until then the newest event in it.
		unwrap(api.GET('/api/feed', { params: { query: { until: today, limit: 1, facets: false } } }))
			.then((r) => (newest = r.items[0]?.date ?? null))
			.catch(() => {});
	});

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
		const factionCounts = [...facetMap(facets?.faction)].slice(0, 16);
		return [
			{
				id: 'soort',
				label: 'Soort',
				kind: 'list',
				options: FEED_KINDS.map((k) => ({
					id: k,
					label: KIND_LABEL[k].one,
					count: facets ? (kindCounts.get(k) ?? 0) : undefined,
					on: kinds.includes(k),
					onClick: () => toggleKind(k)
				}))
			},
			{
				id: 'periode',
				label: 'Periode',
				kind: 'range',
				unit: 'date',
				from: since,
				to: until,
				onChange: (from, to) => patchUrl({ van: from || null, tot: to || null })
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

	/** The same view as an Atom feed. */
	const atomHref = $derived.by(() => {
		const p = new URLSearchParams();
		for (const [k, v] of Object.entries(query ?? {}))
			if (v !== undefined && k !== 'limit') p.set(k, String(v));
		return `${API_BASE_URL}/api/feed.atom${p.size ? `?${p}` : ''}`;
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && openId) patchUrl({ open: null }, true);
	}
</script>

<svelte:head><title>Actueel · Concordans</title></svelte:head>
<svelte:window onkeydown={onKey} />

<div class="actueel">
	<aside class="filters" aria-label="Filters">
		<h1 class="title">Actueel</h1>
		<p class="about">
			Wetsvoorstellen, nota’s van wijziging, amendementen, moties, stemmingen, toezeggingen, brieven
			van de regering, publicaties en inwerkingtredingen, per dag.
		</p>
		{#if newest}
			<p class="stand">Nieuwste gebeurtenis in de gegevens: {shortDate(newest)}</p>
		{/if}
		<button
			type="button"
			class="filters-toggle"
			aria-expanded={filtersOpen}
			onclick={() => (filtersOpen = !filtersOpen)}
			>Filters{chips.length ? ` (${chips.length})` : ''}</button
		>
		<div class="filters-body" class:filters-body--open={filtersOpen}>
			<IndexFacets {groups} />
		</div>
	</aside>

	<main class="feed" aria-busy={loading}>
		<div class="head">
			{#if total !== null}
				<p class="count">
					{total.toLocaleString('nl-NL')}<span class="noun"
						>{total === 1 ? 'gebeurtenis' : 'gebeurtenissen'}</span
					>
				</p>
			{/if}
			{#each chips as chip (chip.id)}
				<button type="button" class="chip" onclick={chip.onRemove}
					>{chip.label}<span class="chip-x" aria-hidden="true">×</span></button
				>
			{/each}
			{#if chips.length > 1}
				<button type="button" class="clear" onclick={clearFilters}>Wis alle filters</button>
			{/if}
			<a class="atom" href={atomHref} rel="alternate" type="application/atom+xml">Atom-feed</a>
		</div>

		<label class="search">
			<span class="visually-hidden">Zoek in Actueel</span>
			<input
				type="search"
				placeholder="Zoek in titels en teksten"
				value={qDraft ?? q}
				oninput={(e) => typeQuery(e.currentTarget.value)}
			/>
		</label>

		{#if loading && !items.length}
			<p class="status">Laden…</p>
		{:else if error && !items.length}
			<p class="status status--error">{error}</p>
		{:else if !items.length}
			<div class="empty">
				<p>Geen gebeurtenissen{chips.length ? ' met deze filters' : ''}.</p>
				{#if newest}<p class="stand">
						Nieuwste gebeurtenis in de gegevens: {shortDate(newest)}
					</p>{/if}
			</div>
		{:else}
			<div class="days" class:days--stale={loading}>
				{#each days as day (day.date)}
					<section class="day" aria-labelledby="day-{day.date}">
						<header class="day-head">
							<h2 class="day-title" id="day-{day.date}">{dayLabel(day.date, today)}</h2>
							<span class="day-meta">{countLine(day.counts)}</span>
						</header>
						<ul class="list">
							{#each day.entries as entry ('fold' in entry ? entry.fold.id : entry.item.id)}
								<FeedEntry
									{entry}
									{openId}
									onToggle={toggleOpen}
									{colorOf}
									{ministryName}
									{filterHref}
								/>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
			{#if cursor}
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
		gap: var(--s-7);
		max-width: 1320px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-8);
		--row-lead: 132px;
		--row-aside: 150px;
	}
	.filters {
		position: sticky;
		top: var(--s-4);
		align-self: start;
		max-height: calc(100vh - var(--s-6));
		overflow-y: auto;
		font-family: var(--font-sans);
	}
	.title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
	}
	.about {
		margin: var(--s-2) 0;
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.stand {
		margin: 0 0 var(--s-5);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.filters-toggle {
		display: none;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2) var(--s-3);
		margin: 0 0 var(--s-3);
		font-family: var(--font-sans);
	}
	.count {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-variant-numeric: tabular-nums;
	}
	.noun {
		margin-left: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.chip {
		display: inline-flex;
		gap: var(--s-1);
		padding: var(--s-1) var(--s-2);
		border: 1px solid var(--ink);
		border-radius: var(--r-1);
		background: transparent;
		font: inherit;
		font-size: var(--t-micro);
		cursor: pointer;
	}
	.chip:hover {
		background: var(--paper-2);
	}
	.chip-x {
		color: var(--ink-3);
	}
	.clear,
	.atom {
		border: 0;
		background: transparent;
		padding: 0;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
		text-decoration: none;
	}
	.atom {
		margin-left: auto;
	}
	.clear:hover,
	.atom:hover {
		color: var(--accent);
	}
	.search input {
		width: 100%;
		box-sizing: border-box;
		height: var(--s-7);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.search input::placeholder {
		color: var(--ink-3);
		font-style: italic;
	}

	.day-head {
		display: flex;
		align-items: baseline;
		gap: var(--s-3);
		padding: var(--s-5) 0 var(--s-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	.day-title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
	}
	.day-meta {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.days--stale {
		opacity: 0.6;
	}
	.status,
	.empty {
		margin: var(--s-5) 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.status--error {
		color: var(--accent);
	}
	.empty p {
		margin: 0 0 var(--s-1);
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
		font-family: var(--font-sans);
		font-size: var(--t-meta);
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
			gap: var(--s-4);
			padding: var(--s-4) var(--s-4) var(--s-7);
		}
		.filters {
			position: static;
			max-height: none;
		}
		.filters-toggle {
			display: block;
			width: 100%;
			min-height: 44px;
			padding: 0;
			border: 0;
			border-top: 1px solid var(--rule);
			border-bottom: 1px solid var(--rule);
			background: transparent;
			font: inherit;
			font-size: var(--t-meta);
			font-weight: 500;
			text-align: left;
			color: var(--ink);
			cursor: pointer;
		}
		.filters-body {
			display: none;
			padding-top: var(--s-3);
		}
		.filters-body--open {
			display: block;
		}
		.atom {
			margin-left: 0;
		}
	}
</style>
