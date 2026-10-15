<script lang="ts">
	import { untrack } from 'svelte';
	// Index: browse one category at a time. Beside the list a column of filters, each
	// option with the number of bronnen it holds under the other filters. A row says what
	// the bron is in its own lines; its title opens it, and at its end stand the ways on in
	// one click (Lezen, Netwerk; Openen for a bron read beside the network). No panel
	// opens beneath a row (Thijs, 10 Oct).
	//
	// Each category is one definition in the register (index/lists): its sorts, field,
	// columns, request, filters and rows. This view holds what every list shares: the
	// address, the loading, the way back and the frame.
	import BronRegel from '$lib/components/parliamentary/BronRegel.svelte';
	import { lijstDoel } from '$lib/stores/sprong';
	import { afterTick } from '$lib/util/after-tick';
	import { page } from '$app/state';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { useSearchOpener } from '$lib/stores/search-trigger';
	import { api, unwrap } from '$lib/api/client';
	import { isAborted, report } from '$lib/api/errors';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { bronLabel } from '$lib/vocabulary';
	import { getCoverage } from '$lib/api/stats';
	import { uniqueBy } from '$lib/util/unique';
	import { isEscape } from '$lib/actions/keys';
	import { rijen } from '$lib/actions/rijen';
	import Bepaalregel from '$lib/components/ui/Bepaalregel.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import IconKnop from '$lib/components/ui/IconKnop.svelte';
	import IndexFacets, { activeFilters, type FacetGroup } from './index/IndexFacets.svelte';
	import type { FacetsApart } from './index/faceted';
	import {
		CHAMBER_OPTIONS,
		ekListSource,
		type Chamber
	} from '$lib/components/parliamentary/chamber';
	import { getCabinets, getMinistries } from './index/government';
	import {
		INDEX_CATEGORIES,
		INDEX_TABS,
		categoryLabel,
		collectionOf,
		type IndexCategory
	} from './index/categories';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { formatCount } from '$lib/text/getal';
	import { navigate, withParams, type ParamPatch } from '$lib/util/address';
	import { LISTS } from './index/lists';
	import { FILTER_PARAMS, readParams } from './index/lists/params';
	import {
		PAGE,
		forParams,
		type Answer,
		type ListContext,
		type Page,
		type Shared
	} from './index/lists/list';

	let { category }: { category: IndexCategory } = $props();

	// ── URL-driven filter state ─────────────────────────────────────────────
	const list = $derived(LISTS[category]);
	const p = $derived(readParams(page.url.searchParams));
	const q = $derived(p.q);
	const kamer = $derived(p.kamer);

	/** A filter is a step in the history; the search text and the open row replace it. */
	const patchUrl = (patch: ParamPatch, replaceState = false) =>
		navigate(withParams(page.url, patch), { step: !replaceState });

	// A tab drops the filters and the open row, so a stage filter of dossiers does not leak into decisions.
	const tabHref = (k: IndexCategory, filters: ParamPatch = {}) =>
		withParams(
			page.url,
			{ mode: 'index', kind: k, ...filters },
			{ clear: [...FILTER_PARAMS, 'open'] }
		);

	// ── Search text ─────────────────────────────────────────────────────────
	// What is typed goes into the URL when the typing pauses, in place of the last
	// entry: one step back leaves the search, not one letter.
	const QUERY_DELAY = 250;
	/** The text in the field while it is not yet in the URL. */
	let qDraft = $state<string | null>(null);
	let qTimer: ReturnType<typeof setTimeout> | undefined;
	function typeQuery(v: string) {
		qDraft = v;
		clearTimeout(qTimer);
		qTimer = setTimeout(() => patchUrl({ q: v || null, open: null }, true), v ? QUERY_DELAY : 0);
	}
	// Once the URL has the text, or another text by Back, the field follows the URL.
	$effect(() => {
		if (qDraft === q) qDraft = null;
	});
	$effect(() => () => clearTimeout(qTimer));

	// The filters go, the sort stays.
	const clearFilters = () =>
		patchUrl(
			Object.fromEntries(
				FILTER_PARAMS.filter((name) => name !== 'sort' && name !== 'dir').map((name) => [
					name,
					null
				])
			)
		);

	// ── Sorting ─────────────────────────────────────────────────────────────
	// The first option is the default. An option with `dir` is sorted here, with
	// that direction unless the URL says otherwise; the others are sorted by the API.
	const sorts = $derived(forParams(list.sorts, p));
	const sortDef = $derived(sorts.find((s) => s.id === p.sort) ?? sorts[0]);
	const dir = $derived(sortDef.dir && (p.dir ?? sortDef.dir));

	// ── Data ────────────────────────────────────────────────────────────────
	type AnyPage = Page<unknown>;

	/** An item's own id, or its key; null without either. */
	const idOf = (item: unknown): string | null => {
		const o = item as { id?: unknown; key?: unknown };
		return typeof o?.id === 'string' ? o.id : typeof o?.key === 'string' ? o.key : null;
	};

	function toPage(
		previous: AnyPage | undefined,
		{ items, total, of }: Answer<unknown>,
		offset: number
	): AnyPage {
		// A page can repeat an item of the page before when the order has ties.
		const all = offset && previous ? uniqueBy([...previous.items, ...items], idOf) : items;
		// Without a total (one still being counted), a full page says there is more; a list can
		// ask more than PAGE at a time (stemmingen: 200). A list without `total` (members) is
		// over when a slice comes back short.
		const more = total == null ? items.length >= PAGE : all.length < total;
		return { items: all, total: total ?? (more ? null : all.length), more, of };
	}

	let pages = $state<Partial<Record<IndexCategory, AnyPage>>>({});
	/** Each list's own state beside its rows: its facets and counts, as they come. */
	let states = $state<Partial<Record<IndexCategory, Record<string, unknown>>>>({});
	/** The facets of the list asked apart from its first page, still on their way. */
	let facettenLaden = $state(false);
	/**
	 * Why they did not come: the filters say so, without the counts of the filters before
	 * (#80), and ask again.
	 */
	let facettenFout = $state<unknown>(null);
	let facettenOpnieuw = $state<() => void>(() => {});
	/**
	 * The facets of a first page asked on their own, beside it (one row, the same filters):
	 * counting them can take seconds, and the list does not wait for it (Thijs, 10 Oct: lazy).
	 */
	const facettenApart: FacetsApart = (vraag, zet, signal) => {
		facettenLaden = true;
		facettenFout = null;
		facettenOpnieuw = () => facettenApart(vraag, zet, signal);
		vraag()
			.then((r) => {
				if (!signal.aborted) zet(r);
			})
			.catch((e) => {
				report('Verfijning', e);
				if (!signal.aborted && !isAborted(e)) facettenFout = e;
			})
			.finally(() => {
				if (!signal.aborted) facettenLaden = false;
			});
	};
	let loading = $state(false);
	let loadingMore = $state(false);
	let loadMoreFailed = $state(false);
	let error = $state<string | null>(null);

	/** The page as shown: with the total its facets counted where its rows came without one. */
	const shownPage = $derived.by(() => {
		const loaded = pages[category];
		const total = list.total?.(states[category] ?? {});
		return loaded && loaded.total === null && total != null
			? { ...loaded, total, more: loaded.items.length < total }
			: loaded;
	});

	// The request of the list: rebuilt only when one of its values changes, and that is what
	// triggers a new load (the open row, for one, is no part of it).
	const queryKey = $derived(JSON.stringify(list.query(p, sortDef)));
	/** Loads the page from `offset` of the list asked last; a newer load aborts `signal`. */
	let fetchPage: (offset: number, signal: AbortSignal) => Promise<void> = async () => {};

	let loadMoreAbort: AbortController | null = null;
	/** The load in progress, which a list kept from before replaces (see Coming back). */
	let loadAbort: AbortController | null = null;

	$effect(() => {
		void queryKey;
		const cat = category;
		const asked = untrack(() => LISTS[cat]);
		const query = untrack(() => asked.query(p, sortDef));
		// A first page sets its state while this effect runs: read without depending on it.
		const set = (patch: Record<string, unknown>) =>
			untrack(() => {
				states[cat] = { ...states[cat], ...patch };
			});
		fetchPage = async (offset, signal) => {
			const answer = await asked.load(query, offset, signal, facettenApart, set);
			if (!signal.aborted) pages[cat] = toPage(pages[cat], answer, offset);
		};
		const ac = new AbortController();
		loadAbort = ac;
		loading = true;
		// A list whose facets come apart says so itself (facettenApart).
		facettenLaden = false;
		facettenFout = null;
		error = null;
		loadMoreFailed = false;
		fetchPage(0, ac.signal)
			.catch(() => {
				if (!ac.signal.aborted) error = `De ${labelOf(cat)} konden niet worden geladen.`;
			})
			.finally(() => {
				if (!ac.signal.aborted) loading = false;
			});
		return () => {
			ac.abort();
			loadMoreAbort?.abort();
		};
	});

	async function loadMore() {
		const offset = pages[category]?.items.length;
		if (loadingMore || !offset) return;
		loadingMore = true;
		loadMoreFailed = false;
		const ac = (loadMoreAbort = new AbortController());
		try {
			await fetchPage(offset, ac.signal);
		} catch {
			// The rows loaded so far stay; the button offers the next page again.
			if (!ac.signal.aborted) loadMoreFailed = true;
		} finally {
			loadingMore = false;
		}
	}

	// ── Coming back ─────────────────────────────────────────────────────────
	// Back from a bron finds the list as it was left: the pages loaded and the place in
	// the list, per URL, for as long as the tab is open. A reload or a link loads afresh.
	const KEPT = 'concordans:bladeren';
	const KEPT_MAX = 6;
	type Kept = { url: string; category: IndexCategory; page: AnyPage; scroll: number };
	let scroller = $state<HTMLElement | null>(null);

	// The open row is not part of what is loaded.
	const keptUrl = (url: URL) => {
		const params = new URLSearchParams(url.searchParams);
		params.delete('open');
		return `${url.pathname}?${params}`;
	};
	function readKept(): Kept[] {
		try {
			const kept = JSON.parse(sessionStorage.getItem(KEPT) ?? '[]');
			return Array.isArray(kept) ? kept : [];
		} catch {
			return [];
		}
	}
	function keep(url: URL) {
		// While a list loads, the one shown is the previous one: nothing to keep.
		if (!shownPage || !scroller || loading) return;
		const entry: Kept = {
			url: keptUrl(url),
			category,
			page: $state.snapshot(shownPage) as AnyPage,
			scroll: scroller.scrollTop
		};
		const rest = readKept().filter((k) => k.url !== entry.url);
		try {
			sessionStorage.setItem(KEPT, JSON.stringify([entry, ...rest].slice(0, KEPT_MAX)));
		} catch {
			// Storage full or blocked: coming back loads the list again.
		}
	}

	// Leaving Bladeren, for a bron or another page, keeps the list.
	beforeNavigate(({ from, to }) => {
		const van = from?.url;
		const naar = to?.url;
		const staying = naar?.pathname === van?.pathname && naar?.searchParams.get('mode') === 'index';
		if (van && !staying) keep(van);
	});

	// Mounting by Back or Forward takes the kept list in place of the first page.
	let mounted = false;
	afterNavigate(({ type, to }) => {
		if (mounted) return;
		mounted = true;
		const naar = to?.url;
		const kept = type === 'popstate' && naar && readKept().find((k) => k.url === keptUrl(naar));
		if (!kept || kept.category !== category) {
			revealOpen = !!p.open;
			return;
		}
		loadAbort?.abort();
		loading = false;
		pages[category] = kept.page;
		afterTick(() => scroller?.scrollTo({ top: kept.scroll }));
	});

	// ── What more than one list reads ───────────────────────────────────────
	const needs = $derived(list.needs ?? []);
	let shared = $state<Shared>({ cabinets: [], ministries: [], coverage: null, parties: [] });

	// The cabinets and ministries fill the filters of the government's lists.
	$effect(() => {
		if (!needs.includes('government')) return;
		if (!untrack(() => shared.cabinets.length))
			getCabinets()
				.then((c) => {
					shared.cabinets = c;
				})
				.catch((e) => report('Kabinetten', e));
		if (!untrack(() => shared.ministries.length))
			getMinistries()
				.then((m) => {
					shared.ministries = m;
				})
				.catch((e) => report('Ministeries', e));
	});

	// The courts to filter judgments on: the colleges the dataset holds judgments of.
	$effect(() => {
		if (!needs.includes('coverage') || untrack(() => shared.coverage)) return;
		getCoverage()
			.then((c) => {
				shared.coverage = c;
			})
			// Without coverage the filters are the usual colleges, without counts.
			.catch((e) => report('Gerechten', e));
	});

	// The factions to filter members by, of the Kamer shown; the list is filtered by the API.
	let partiesOf = $state<Chamber | null>(null);
	$effect(() => {
		if (!needs.includes('parties') || partiesOf === kamer) return;
		const ac = new AbortController();
		const chamber = kamer;
		unwrap(
			api.GET('/api/factions', { params: { query: { active: true, chamber } }, signal: ac.signal })
		)
			.then((r) => {
				shared.parties = r
					.flatMap((f) =>
						f.abbreviation ? [{ abbreviation: f.abbreviation, seats: f.seats ?? null }] : []
					)
					.sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0));
				partiesOf = chamber;
			})
			.catch((e) => report('Fracties om op te filteren', e));
		return () => ac.abort();
	});

	// ── The list as shown ───────────────────────────────────────────────────
	// The open row is `?open=<collection>/<key>`, so it can be shared and Back finds it open.
	const toggleOpen = (id: string) => patchUrl({ open: p.open === id ? null : id }, true);

	const base = $derived<Omit<ListContext<unknown, Record<string, unknown>>, 'rows'>>({
		p,
		sort: sortDef,
		dir,
		page: shownPage,
		state: states[category] ?? {},
		shared,
		loading,
		patch: patchUrl,
		toggleOpen,
		tabHref,
		empty
	});
	/** The rows as shown: filtered and sorted here where the API does not. */
	const rows = $derived(
		shownPage && (list.shown ? list.shown(shownPage.items, base) : shownPage.items)
	);
	const ctx = $derived<ListContext<unknown, Record<string, unknown>>>({ ...base, rows });

	/** The period of a list, the date it is about named by its label. */
	const periode = $derived.by(() => {
		const period = list.period(p);
		return period
			? ({
					id: 'period',
					label: period.label,
					kind: 'range',
					unit: period.unit,
					from: p.from,
					to: p.to,
					onChange: (from, to) => patchUrl({ from: from || null, to: to || null })
				} satisfies FacetGroup)
			: null;
	});
	// The period stands in the choose-line (Bepaalregel), the other groups in the facet column.
	const facetten = $derived(list.facets(ctx));
	const chips = $derived(activeFilters(periode ? [...facetten, periode] : facetten));
	let filtersOpen = $state(false);

	// The Eerste Kamer's composition as read from its site: the day of the composition shown,
	// and the first read, before which nothing is known. Each row carries the same source,
	// with the page of that row; the list links the site (ekListSource).
	const composition = $derived.by(() => {
		const source = kamer === 'EK' && rows ? list.composition?.(rows) : null;
		return source ? ekListSource(source) : null;
	});

	// On a phone the tab strip scrolls (wider, it wraps): the category on screen is scrolled into it,
	// and an edge that hides tabs fades out.
	let catbar = $state<HTMLElement | null>(null);
	let catMore = $state({ left: false, right: false });
	const measureCatbar = () => {
		if (!catbar) return;
		const { scrollLeft, scrollWidth, clientWidth } = catbar;
		catMore = { left: scrollLeft > 1, right: scrollLeft + clientWidth < scrollWidth - 1 };
	};
	$effect(() => {
		if (!catbar) return;
		measureCatbar();
		const observer = new ResizeObserver(measureCatbar);
		observer.observe(catbar);
		return () => observer.disconnect();
	});
	$effect(() => {
		void category;
		catbar
			?.querySelector('.cat--on')
			?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
	});

	// ── Open row, Esc ───────────────────────────────────────────────────────
	// A shared link with an open row scrolls to it once the list is in.
	let revealOpen = $state(false);
	$effect(() => {
		if (!revealOpen || loading || !pages[category]) return;
		revealOpen = false;
		const id = untrack(() => p.open);
		afterTick(() =>
			scroller
				?.querySelector(`[data-bron="${CSS.escape(id ?? '')}"]`)
				?.scrollIntoView({ block: 'center' })
		);
	});

	function handleKey(e: KeyboardEvent) {
		if (isEscape(e) && p.open) patchUrl({ open: null }, true);
	}

	// ── Result count above the list ──────────────────
	// How many there are under the filters: the API's total, or the rows filtered here.
	// Null while a list without a total has more to load: the rows loaded are not the count.
	const resultTotal = $derived.by(() => {
		if (!rows) return null;
		return list.countShown || !shownPage ? rows.length : shownPage.total;
	});

	const labelOf = (c: IndexCategory) =>
		INDEX_CATEGORIES.find((cat) => cat.key === c)!.label.toLowerCase();
	/** One bron of the list, as its count says it (a list without rows shows no count). */
	const noun1 = (c: IndexCategory) => bronLabel(collectionOf(c)).toLowerCase();

	// ── Columns ─────────────────────────────────────────────────────────────
	const columns = $derived(forParams(list.columns, p));
	// The Kamer is a choice, not a filter: the first group of the filters, always one of the
	// two, and no chip above the list.
	/** Another Kamer: its own list, without the filters that belonged to the other. */
	const kiesKamer = (c: Chamber) =>
		patchUrl({ kamer: c === 'TK' ? null : c, open: null, party: null });
	const widen = $derived(list.widen?.(p) ?? null);
	const after = $derived(list.after?.(p) ?? null);

	const openSearch = useSearchOpener();
</script>

<svelte:window onkeydown={handleKey} />

<div class="index-view">
	<!-- The categories in three groups, each named above its tabs: the law and the
	     courts, how the Kamer deals with a subject, and who does it. -->
	<nav
		class="catbar"
		data-zijscroll
		class:catbar--more-left={catMore.left}
		class:catbar--more-right={catMore.right}
		aria-label="Categorieën"
		bind:this={catbar}
		onscroll={measureCatbar}
	>
		{#each INDEX_TABS as group, g (g)}
			<div class="catgroup" role="group" aria-labelledby="catgroup-{g}">
				<span class="catgroup__label" id="catgroup-{g}">{group.label}</span>
				<div class="catgroup__tabs">
					{#each group.categories as cat (cat.key)}
						<a
							href={tabHref(cat.key)}
							class="cat"
							class:cat--on={cat.key === category}
							aria-current={cat.key === category ? 'page' : undefined}
							title={cat.about}
							data-sveltekit-noscroll
							data-sveltekit-keepfocus
						>
							<KindGlyph collection={collectionOf(cat.key)} size={11} />
							<span class="cat-name">{cat.label}</span>
						</a>
					{/each}
				</div>
			</div>
		{/each}
	</nav>

	<div class="stage">
		<div class="stage-scroll" bind:this={scroller}>
			<div class="page blad blad__indeling">
				<!-- The page names itself for a screen reader; the tabs above show it. -->
				<h1 class="sr-only">Bronnen: {categoryLabel(category)}</h1>
				<!-- The choose-line (docs/bediening.md): the field of the list and its period, over
				     the facets and the list. -->
				<div class="regel">
					<Bepaalregel
						zoek={{
							waarde: qDraft ?? q,
							placeholder: list.placeholder,
							naam: `Zoek in ${labelOf(category)}`,
							onInput: typeQuery
						}}
						periode={periode
							? {
									label: periode.label,
									van: periode.from,
									tot: periode.to,
									onChange: periode.onChange
								}
							: null}
						kamer={list.chamber
							? {
									waarde: kamer,
									opties: CHAMBER_OPTIONS,
									onKies: (c) => kiesKamer(c as Chamber)
								}
							: null}
					/>
				</div>
				<aside class="facet-col blad__facetten" aria-label="Verfijnen">
					<!-- On a phone the facets behind one quiet line, opened in place. -->
					<button
						type="button"
						class="verfijnen-knop"
						aria-expanded={filtersOpen}
						aria-controls="bladeren-facetten"
						onclick={() => (filtersOpen = !filtersOpen)}
						>Verfijnen{chips.length ? ` (${chips.length})` : ''}</button
					>
					<div class="facet-body" id="bladeren-facetten" class:facet-body--open={filtersOpen}>
						<IndexFacets
							groups={facetten}
							pending={(!pages[category] && !error) || facettenLaden}
							stale={facettenFout !== null}
						/>
						{#if facettenFout}
							<LoadState
								state={{ status: 'error', error: facettenFout }}
								what="De tellingen"
								plural
								retry={facettenOpnieuw}
							/>
						{/if}
						{#if chips.length}
							<p class="wis"><TekstLink onclick={clearFilters}>Wis alle filters</TekstLink></p>
						{/if}
					</div>
				</aside>

				<div
					class="results"
					use:lijstDoel
					use:rijen={'a.row-title'}
					aria-busy={loading}
					style:--row-aside="{columns.asideW}px"
				>
					{#if list.Header}<list.Header {ctx} />{/if}

					<!-- How many, under which filters; a click on a filter takes it off. -->
					<div class="result-head">
						{#if list.Rows && resultTotal !== null}
							<p class="result-count">
								{formatCount(resultTotal)}<span class="result-noun"
									>{resultTotal === 1 ? noun1(category) : labelOf(category)}</span
								>
							</p>
						{:else if list.Rows}
							<!-- The count's own height before it is known, so nothing below it moves. -->
							<p class="result-count" aria-hidden="true">&nbsp;</p>
						{/if}
						{#if sorts.length > 1}
							<!-- The order of the list: one line under its count (docs/bediening.md). -->
							<span class="volgorde">
								<TekstMenu
									klein
									rechts
									label="Volgorde"
									waarde={sortDef.id}
									opties={sorts.map((o) => ({ waarde: o.id, label: o.label }))}
									onKies={(v) => patchUrl({ sort: v || null })}
								/>
								{#if dir}
									<IconKnop
										label={dir === 'asc'
											? 'Oplopend; sorteer aflopend'
											: 'Aflopend; sorteer oplopend'}
										onclick={() => patchUrl({ dir: dir === 'asc' ? 'desc' : 'asc' })}
										>{dir === 'asc' ? '↑' : '↓'}</IconKnop
									>
								{/if}
							</span>
						{/if}
					</div>

					{#if list.Figure}<list.Figure {ctx} />{/if}

					<!-- While the next result loads, the previous one stays, dimmed. -->
					{#if loading && !pages[category]}
						<!-- The shape of a list while it loads: rows where rows will stand. -->
						<p class="sr-only" role="status">Laden…</p>
						<ul class="list skelet" aria-hidden="true">
							{#each { length: 8 } as _, i (i)}
								<li class="skelet-rij"><span></span><span></span></li>
							{/each}
						</ul>
					{:else if error}
						<p class="status-line status-line--error stil">{error}</p>
					{:else}
						<div class="shown" class:shown--stale={loading}>
							{#if list.Rows && rows}
								{#if rows.length === 0}
									{@render empty(list.emptyNoun?.(p) ?? list.noun)}
								{:else}
									<div class="list-head" aria-hidden="true">
										<span>{columns.lead}</span>
										<span>{columns.body}</span>
										{#if Array.isArray(columns.aside)}
											<span class="nums">
												{#each columns.aside as head (head)}<span>{head}</span>{/each}
											</span>
										{:else}
											<span class="list-head__aside">{columns.aside}</span>
										{/if}
									</div>
									<list.Rows {ctx} />
									{@render loadMoreButton(shownPage, list.noun)}
									{#if after}
										<BronRegel afterList label={after.label} href={after.href} />
									{/if}
								{/if}
							{/if}
						</div>
					{/if}
					<!-- Where the list comes from, under it: the source and its date close the list. -->
					{#if composition && !loading}
						<BronRegel
							afterList
							composedOn={composition.composition_date}
							dataSince={composition.data_since}
							label={composition.attribution}
							href={composition.url}
						/>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Nothing to show: with filters on, they say why; a text searched for can be searched
     for in all bronnen. -->
{#snippet empty(noun: string)}
	<div class="empty">
		<p class="stil">Geen {noun}{chips.length || q ? ' met deze filters' : ''}.</p>
		{#if widen}
			<button type="button" class="btn is-groot" onclick={() => patchUrl(widen.patch)}
				>{widen.label}</button
			>
		{/if}
		{#if q}
			<button type="button" class="btn is-groot" onclick={() => openSearch(q)}
				>Zoek "{q}" in alle bronnen</button
			>
		{/if}
	</div>
{/snippet}

{#snippet loadMoreButton(loaded: AnyPage | undefined, noun: string)}
	{#if loaded?.more}
		{@const remaining = (loaded.total ?? 0) - loaded.items.length}
		<div class="volgende">
			{#if loadMoreFailed}
				<p class="volgende-fout" role="alert">De volgende {noun} konden niet worden geladen.</p>
			{/if}
			{#if loadingMore}<span>Laden…</span>{:else}<TekstLink onclick={loadMore}
					>{loadMoreFailed
						? 'Opnieuw'
						: `Volgende ${noun}${remaining > 0 ? `, nog ${formatCount(remaining)}` : ''}`}</TekstLink
				>{/if}
		</div>
	{/if}
{/snippet}

<style>
	.index-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	/* ── Category bar ─────────────────────────────────────────────────── */
	.catbar {
		display: flex;
		align-items: stretch;
		gap: 0;
		padding: 0 var(--s-5);
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
		flex-shrink: 0;
		overflow-x: auto;
		scrollbar-width: thin;
		--fade-left: 0px;
		--fade-right: 0px;
		mask-image: linear-gradient(
			to right,
			transparent 0,
			black var(--fade-left),
			black calc(100% - var(--fade-right)),
			transparent 100%
		);
	}
	/* A hidden tab is announced by the edge that fades. */
	.catbar--more-left {
		--fade-left: 40px;
	}
	.catbar--more-right {
		--fade-right: 40px;
	}
	/* A group: its name over its tabs, a hairline between groups. */
	.catgroup {
		display: flex;
		flex-direction: column;
		padding-top: var(--s-3);
	}
	.catgroup + .catgroup {
		margin-left: var(--s-2);
		padding-left: var(--s-2);
		box-shadow: inset 1px 0 0 var(--rule);
	}
	.catgroup__label {
		padding: 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
		white-space: nowrap;
		color: var(--ink-3);
	}
	.catgroup__tabs {
		display: flex;
	}
	.cat {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		padding: var(--s-2) var(--s-2) var(--s-3);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		white-space: nowrap;
		color: var(--ink-3);
	}
	.cat-name {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-3);
		line-height: 1;
		transition: color var(--dur-1) var(--ease);
	}
	.cat:hover .cat-name {
		color: var(--ink-2);
	}
	.cat--on {
		border-bottom-color: var(--ink);
		color: var(--ink);
	}
	.cat--on .cat-name {
		color: var(--ink);
		font-weight: 600;
	}

	/* From a tablet up the groups wrap to a second line instead of scrolling: every tab
	   stays in sight (Regering goes under the rest at 1280 and 1024). Each group has its
	   hairline at its left; the bar's left inset clips the one that would start a line. */
	@media (min-width: 769px) {
		.catbar {
			flex-wrap: wrap;
			overflow: visible;
			mask-image: none;
			padding-left: calc(var(--s-5) - var(--s-2) - 1px);
			clip-path: inset(0 0 0 calc(var(--s-5) - var(--s-2)));
		}
		.cat {
			gap: var(--s-1);
		}
		.catgroup,
		.catgroup + .catgroup {
			margin: 0 var(--s-2) 0 0;
			padding-left: var(--s-2);
			box-shadow: inset 1px 0 0 var(--rule);
		}
	}

	/* ── Stage container ─────────────────────────────────────────────── */
	.stage {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.stage-scroll {
		flex: 1;
		overflow-y: auto;
		/* The filter column measures its height against this box, not the window. */
		container-type: size;
	}
	/* The filters in a column beside the list, on a narrow screen above it: the frame and
	   its grid are the shared .blad and .blad__indeling (lib/styles/frame.css). */
	/* The shared .blad__facetten (lib/styles/frame.css), in this scrolling box rather than the
	   window: no top bar over it, and as high as the box, so its last filter can be reached. */
	.facet-col {
		top: var(--s-6);
		max-height: calc(100cqh - var(--s-6));
	}
	.results {
		min-width: 0;
	}

	/* Above the list: how many, then the filters that are on. */
	.result-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2) var(--s-3);
		margin: 0 0 var(--s-3);
		padding-bottom: var(--s-2);
		border-bottom: 2px solid var(--ink);
	}
	.result-count {
		margin: 0 var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 800;
		line-height: 1.1;
		color: var(--ink);
	}
	.result-noun {
		margin-left: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}

	/* The heads of the columns, over the rows in the same grid. */
	.list-head {
		display: grid;
		grid-template-columns: var(--row-lead) minmax(0, 1fr) var(--row-aside);
		gap: var(--s-5);
		padding: 0 var(--s-2) var(--s-1);
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}
	.list-head__aside {
		text-align: right;
	}
	/* Numbers in columns of their own, right-aligned under their heads. */
	.nums {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-3);
		width: 100%;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	/* ── Status and empty states ─────────────────────────────────────── */
	.status-line {
		margin: var(--s-3) 0;
	}
	.status-line--error {
		color: var(--ink-2);
	}
	/* Nothing to show: the quiet line (.stil) where the rows would begin, its way on under it. */
	.empty {
		padding: var(--s-3) 0;
	}
	.empty .btn {
		margin-top: var(--s-4);
	}
	/* The previous result while the next one loads. */
	.shown--stale {
		opacity: 0.55;
		transition: opacity var(--dur-1) var(--ease);
	}

	/* ── List and row ────────────────────────────────────────────────── */
	.skelet-rij {
		display: grid;
		grid-template-columns: var(--row-lead) minmax(0, 1fr);
		gap: var(--s-5);
		align-items: center;
		height: var(--s-8);
		padding: 0 var(--s-3);
		border-bottom: 1px solid var(--rule);
	}
	.skelet-rij span {
		height: var(--s-3);
		border-radius: var(--r-1);
		background: var(--paper-2);
	}
	.skelet-rij span:first-child {
		width: 60%;
	}
	.skelet-rij span:last-child {
		width: 70%;
	}
	/* One heavy rule per list, the count's above it (docs/bediening.md); the heads of the
	   columns hang under it on a thin rule of their own. */
	.results :global(.list) {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	/* What identifies the row (a number, a date, a kind): small and grey; the title is
	   what is read. */
	.results :global(.row-id-main) {
		display: block;
	}
	.results :global(.row-id-main--inline) {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
	}
	.results :global(.row-id-sub) {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		margin-top: 2px;
	}
	/* A dossier by name in the narrow lead: two lines at most, the whole on hover. */
	.results :global(.row-id-naam) {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		overflow-wrap: break-word;
	}

	.results :global(.row-sub) {
		display: block;
		margin-top: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	/* Qualities on a row are words: the outcome of a vote in ink-2, the rest in ink-3. */
	.results :global(.tag) {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		white-space: nowrap;
		line-height: 22px;
	}
	.results :global(.tag--passed),
	.results :global(.tag--rejected) {
		color: var(--ink-2);
		font-weight: 600;
	}

	.results :global(.num-strong) {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink);
		font-feature-settings: 'lnum';
		line-height: 1;
	}
	.results :global(.num-lbl) {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		margin-left: var(--s-1);
	}

	.results :global(.party-dot) {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		vertical-align: middle;
	}

	/* Narrow viewports: the columns stack. */
	@media (max-width: 768px) {
		.catbar {
			padding: 0 var(--s-4);
		}
		.cat {
			padding: var(--s-2) var(--s-4) var(--s-3);
		}
		.catgroup__label {
			padding: 0 var(--s-4);
		}
		/* The filters scroll along on a phone: their bar stays at the top of the list, so a
		   filter is one tap away wherever one is (Thijs, 9 Oct). Open, they scroll on their own
		   and leave the list below in sight. */
		.facet-col {
			position: sticky;
			top: 0;
			z-index: 2;
			max-height: none;
			overflow: visible;
			margin: 0 calc(-1 * var(--s-4)) var(--s-4);
			padding: 0 var(--s-4);
			background: var(--paper);
		}
		.facet-body {
			display: none;
			padding-top: var(--s-3);
		}
		.facet-body--open {
			display: block;
			max-height: 60dvh;
			overflow-y: auto;
			overscroll-behavior: contain;
			/* Room for the scrollbar beside the counts, so it never covers a figure. */
			scrollbar-gutter: stable;
			scrollbar-width: thin;
			padding-right: var(--s-2);
			padding-bottom: var(--s-3);
			border-bottom: 1px solid var(--rule);
		}
		/* The rows stack on a phone (IndexRow): the head keeps only the heads of the
		   number columns, over the numbers at full width. */
		.list-head {
			grid-template-columns: minmax(0, 1fr);
		}
		.list-head > span:not(.nums) {
			display: none;
		}
		/* Without number columns the head holds only its rule, under the count's: it goes. */
		.list-head:not(:has(.nums)) {
			display: none;
		}
	}

	/* The choose-line over both columns: the field and the period, without rules. */
	.regel {
		grid-column: 1 / -1;
		margin-bottom: var(--s-5);
	}
	.wis {
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
	}
	/* The order at the right of the count, on the ink rule that opens the list. */
	.volgorde {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		margin-left: auto;
	}
	.volgende {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--s-2);
		padding: var(--s-5) 0 var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.volgende-fout {
		margin: 0;
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	@media (max-width: 768px) {
		.regel {
			margin-bottom: var(--s-3);
		}
		.verfijnen-knop {
			padding: var(--s-2) 0;
		}
	}
</style>
