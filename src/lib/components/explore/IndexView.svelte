<script lang="ts">
	import { sideScroll } from '$lib/actions/side-scroll';
	import { tick, untrack } from 'svelte';
	// Index: browse one category at a time. Over the list a bar of filters (FilterBar), each
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
	import { getFactions } from '$lib/api/factions';
	import { isAborted, report } from '$lib/api/errors';
	import LoadState, { failureText } from '$lib/components/ui/LoadState.svelte';
	import Kenmerk from '$lib/components/ui/Kenmerk.svelte';
	import { getCoverage, getStats, type Stats } from '$lib/api/stats';
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import { SOURCE_LABEL } from '$lib/bron/herkomst';
	import { uniqueBy } from '$lib/util/unique';
	import { isEscape } from '$lib/actions/keys';
	import { focusFirstNew, rijen } from '$lib/actions/rijen';
	import Bepaalregel from '$lib/components/ui/Bepaalregel.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import Follow from '$lib/components/ui/Follow.svelte';
	import { atomHref } from '$lib/components/actueel/feed';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import FilterBar from './index/FilterBar.svelte';
	import { activeFilters, type FacetGroup } from './index/facets';
	import type { FacetsApart } from './index/faceted';
	import {
		CHAMBER_OPTIONS,
		ekListSource,
		type Chamber
	} from '$lib/components/parliamentary/chamber';
	import { getCabinets, getMinistries } from '$lib/api/government';
	import {
		INDEX_CATEGORIES,
		categoryLabel,
		categoryNoun,
		type IndexCategory
	} from './index/categories';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { shapeOfCategory } from '$lib/bron/vormen';
	import { formatCount } from '$lib/text/getal';
	import { navigate, withParams } from '$lib/util/address';
	import { LISTS } from './index/lists';
	import { INDEX_FILTER_PARAMS, readParams, type IndexPatch } from './index/lists/params';
	import {
		PAGE,
		forParams,
		type Answer,
		type ListContext,
		type Page,
		type Shared
	} from './index/lists/list';
	import { requestFrom } from './index/deep';
	import { sourceOfList } from '$lib/nav/sources';

	let { category }: { category: IndexCategory } = $props();

	// The lists beside this one under the same source.
	const source = $derived(sourceOfList(category));
	const sourceLists = $derived(INDEX_CATEGORIES.filter((c) => source.lists.includes(c.key)));

	// ── URL-driven filter state ─────────────────────────────────────────────
	const list = $derived(LISTS[category]);
	const p = $derived(readParams(page.url.searchParams));
	const q = $derived(p.q);
	const kamer = $derived(p.kamer);

	/** A filter is a step in the history; the search text and the open row replace it. */
	const patchUrl = (patch: IndexPatch, replaceState = false) =>
		navigate(withParams(page.url, patch), { step: !replaceState });

	// A tab drops the filters and the open row, so a stage filter of dossiers does not leak into decisions.
	const tabHref = (k: IndexCategory, filters: IndexPatch = {}) =>
		withParams(
			page.url,
			{ mode: 'index', kind: k, ...filters },
			{ clear: [...INDEX_FILTER_PARAMS, 'open'] }
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
				INDEX_FILTER_PARAMS.filter((name) => name !== 'sort' && name !== 'dir').map((name) => [
					name,
					null
				])
			)
		);

	// ── Sorting ─────────────────────────────────────────────────────────────
	// The first option is the default. An option with `dir` is sorted here, with
	// that direction unless the URL says otherwise; the others are sorted by the API.
	const sorts = $derived(forParams(list.sorts, p));
	/** The rows under the Header, unless they show no more than it (the fracties under their
	 *  hall): then no count, order or rule of a list either. */
	const rowsShown = $derived(list.rowsShown?.(p) ?? true);
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
		offset: number,
		size: number
	): AnyPage {
		// A page can repeat an item of the page before when the order has ties.
		const all = offset && previous ? uniqueBy([...previous.items, ...items], idOf) : items;
		// Without a total (one still being counted), a full page of the size asked says there is
		// more: a list without `total` (members) is over when a slice comes back short.
		const more = total == null ? items.length >= size : all.length < total;
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
	/** Why the next page failed; the rows loaded so far stay. */
	let loadMoreError = $state.raw<{ error: unknown } | null>(null);
	/** Why the list failed, in a box: any thrown value, also a falsy one. */
	let error = $state.raw<{ error: unknown } | null>(null);
	/** Opnieuw after a failure: the list asked again as it stands. */
	let retries = $state(0);

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

	/** The rows the next page brings: the list's own limit, else a page. */
	let pageSize = $state(PAGE);
	let loadMoreAbort: AbortController | null = null;
	/** The load in progress, which a list kept from before replaces (see Coming back). */
	let loadAbort: AbortController | null = null;

	$effect(() => {
		void queryKey;
		void retries;
		const cat = category;
		const asked = untrack(() => LISTS[cat]);
		const query = untrack(() => asked.query(p, sortDef));
		// The rows asked at a time: the list's own limit, else a page.
		const limit = (query as { limit?: unknown } | null)?.limit;
		const size = typeof limit === 'number' ? limit : PAGE;
		pageSize = size;
		// A first page sets its state while this effect runs: read without depending on it.
		const set = (patch: Record<string, unknown>) =>
			untrack(() => {
				states[cat] = { ...states[cat], ...patch };
			});
		fetchPage = async (offset, signal) => {
			// Past what the API pages to (the Stukken: 10.000), the list goes on in a window of
			// dates; its total counts the rows before the window as well.
			const next = requestFrom(
				asked,
				query,
				offset,
				// Not a dependency of the effect that loads the first page.
				untrack(() => (pages[cat]?.items ?? []) as never[])
			);
			if (!next) {
				const kept = pages[cat];
				if (kept) pages[cat] = { ...kept, more: false };
				return;
			}
			const answer = await asked.load(next.query, next.offset, signal, facettenApart, set);
			const total = answer.total == null ? answer.total : answer.total + next.behind;
			if (!signal.aborted) pages[cat] = toPage(pages[cat], { ...answer, total }, offset, size);
		};
		const ac = new AbortController();
		loadAbort = ac;
		loading = true;
		// A list whose facets come apart says so itself (facettenApart).
		facettenLaden = false;
		facettenFout = null;
		error = null;
		loadMoreError = null;
		fetchPage(0, ac.signal)
			.catch((e) => {
				if (ac.signal.aborted || isAborted(e)) return;
				report('Lijst', e);
				error = { error: e };
			})
			.finally(() => {
				if (!ac.signal.aborted) loading = false;
			});
		return () => {
			ac.abort();
			loadMoreAbort?.abort();
		};
	});

	/** The focusable element of a row, for J and K and for the focus after Volgende. */
	const ROW = 'a.row-title';
	let results = $state<HTMLElement | null>(null);

	async function loadMore() {
		const offset = pages[category]?.items.length;
		if (loadingMore || !offset) return;
		loadingMore = true;
		loadMoreError = null;
		const ac = (loadMoreAbort = new AbortController());
		// The focus to the first row the page adds: the button gives way to "Laden…" (B2).
		const before = results?.querySelectorAll(ROW).length ?? 0;
		try {
			await fetchPage(offset, ac.signal);
			await tick();
			if (results && !ac.signal.aborted) focusFirstNew(results, ROW, before);
		} catch (e) {
			// The rows loaded so far stay; the button offers the next page again.
			if (ac.signal.aborted || isAborted(e)) return;
			report('Volgende', e);
			loadMoreError = { error: e };
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

	// The stand of the one source a list shows (the EHRM): from the stats, asked once it is chosen.
	const listSource = $derived(list.source?.(p) ?? null);
	let dataAsOf = $state<Stats['data_as_of'] | null>(null);
	$effect(() => {
		if (!listSource || untrack(() => dataAsOf)) return;
		getStats()
			.then((s) => {
				dataAsOf = s.data_as_of ?? {};
			})
			.catch((e) => report('Stand van de bron', e));
	});
	const sourceCompleteness = $derived(listSource ? dataAsOf?.[listSource]?.completeness : null);

	// The factions to filter members by, of the Kamer shown; the list is filtered by the API.
	let partiesOf = $state<Chamber | null>(null);
	$effect(() => {
		if (!needs.includes('parties') || partiesOf === kamer) return;
		const ac = new AbortController();
		const chamber = kamer;
		getFactions({ active: true, chamber }, ac.signal)
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
	// An opened group stays open when the reader goes to another list and comes back.
	let openGroups = $state(new Set<string>());
	const toggleGroup = (key: string) => {
		const next = new Set(openGroups);
		if (!next.delete(key)) next.add(key);
		openGroups = next;
	};

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
		openGroups,
		toggleGroup,
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
					onChange: (from, to) => patchUrl({ van: from || null, tot: to || null })
				} satisfies FacetGroup)
			: null;
	});
	// The period is a button of the bar as every other filter (FilterBar).
	const facetten = $derived(list.facets(ctx));
	const filters = $derived(periode ? [...facetten, periode] : facetten);
	const chips = $derived(activeFilters(filters));

	// The Eerste Kamer's composition as read from its site: the day of the composition shown,
	// and the first read, before which nothing is known. Each row carries the same source,
	// with the page of that row; the list links the site (ekListSource).
	const composition = $derived.by(() => {
		const source = kamer === 'EK' && rows ? list.composition?.(rows) : null;
		return source ? ekListSource(source) : null;
	});

	// On a phone the tab strip scrolls (wider, it wraps): the category on screen is scrolled into it,
	// and an edge that hides tabs fades out (use:sideScroll).
	let catbar = $state<HTMLElement | null>(null);
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
	const noun1 = categoryNoun;
	/** Toon at the foot of the open filters on a phone: what the list holds under them. */
	const showLabel = $derived(
		resultTotal === null
			? `Toon ${labelOf(category)}`
			: `Toon ${formatCount(resultTotal)} ${resultTotal === 1 ? noun1(category) : labelOf(category)}`
	);

	// ── Columns ─────────────────────────────────────────────────────────────
	const columns = $derived(forParams(list.columns, p));
	// The Kamer is a choice, not a filter: the first of the bar of filters, always one of the
	// two, and no chip above the list.
	/** Another Kamer: its own list, without the filters that belonged to the other. */
	const kiesKamer = (c: Chamber) =>
		patchUrl({ kamer: c === 'TK' ? null : c, open: null, fractie: null });
	const widen = $derived(list.widen?.(p) ?? null);
	/** After the count: what the counts the list has already say (`12 aangenomen`). */
	const summary = $derived(list.summary?.(ctx) ?? null);
	/** The list as a feed, where the feed has a word for every filter chosen. */
	const follow = $derived(list.follow?.(p) ?? null);
	const after = $derived(list.after?.(p) ?? null);

	const openSearch = useSearchOpener();
</script>

<svelte:window onkeydown={handleKey} />

<div class="index-view">
	<!-- The lists of the soort the page stands under (Parlement: Kamerleden, Fracties,
	     Commissies); the soorten themselves are the top navigation. A soort of one list has
	     no strip. -->
	{#if sourceLists.length > 1}
		<nav class="catbar" data-zijscroll use:sideScroll aria-label={source.label} bind:this={catbar}>
			{#each sourceLists as cat (cat.key)}
				<a
					href={tabHref(cat.key)}
					class="cat"
					class:cat--on={cat.key === category}
					aria-current={cat.key === category ? 'page' : undefined}
					title={cat.about}
					data-sveltekit-noscroll
					data-sveltekit-keepfocus
				>
					<KindGlyph vorm={shapeOfCategory(cat.key)} size={11} />
					<span class="cat-name">{cat.label}</span>
				</a>
			{/each}
		</nav>
	{/if}

	<div class="stage">
		<div class="stage-scroll" bind:this={scroller}>
			<div class="page blad">
				<!-- The page names itself for a screen reader; the tabs above show it. -->
				<h1 class="sr-only">Bronnen: {categoryLabel(category)}</h1>
				<!-- The choose-line (docs/bediening.md): the field of the list, over the filters and
				     the list. -->
				<div class="regel">
					<Bepaalregel
						zoek={{
							waarde: qDraft ?? q,
							placeholder: list.placeholder,
							naam: `Zoek in ${labelOf(category)}`,
							onInput: typeQuery
						}}
					/>
				</div>

				<div
					class="results"
					use:lijstDoel
					bind:this={results}
					use:rijen={ROW}
					aria-busy={loading}
					style:--row-aside="{columns.asideW}px"
				>
					<FilterBar
						groups={filters}
						chamber={list.chamber
							? {
									value: kamer,
									options: CHAMBER_OPTIONS,
									onChoose: (c) => kiesKamer(c as Chamber)
								}
							: null}
						pending={(!pages[category] && !error) || facettenLaden}
						stale={facettenFout !== null}
						show={showLabel}
						list={() => results}
						onClear={clearFilters}
						end={rowsShown && sorts.length > 1 ? sortControl : undefined}
						count={rowsShown && list.Rows ? countLine : undefined}
						countEnd={rowsShown && (listSource || follow) ? sourceLine : undefined}
						{between}
					/>

					<!-- A list that failed shows no figure of the one before. -->
					{#if list.Figure && !error}<list.Figure {ctx} />{/if}

					<!-- While the next result loads, the previous one stays, dimmed. -->
					{#if loading && !pages[category] && rowsShown}
						<!-- The shape of a list while it loads: rows where rows will stand. -->
						<p class="sr-only" role="status">Laden…</p>
						<ul class="list skelet" aria-hidden="true">
							{#each { length: 8 } as _, i (i)}
								<li class="skelet-rij"><span></span><span></span></li>
							{/each}
						</ul>
					{:else if error}
						<div class="status-line">
							<LoadState
								state={{ status: 'error', error: error.error }}
								what={`De ${labelOf(category)}`}
								plural
								retry={() => retries++}
							/>
						</div>
					{:else}
						<div class="shown" class:shown--stale={loading}>
							{#if list.Rows && rowsShown && rows}
								{#if rows.length === 0}
									<!-- Not while counting: the empty page of the filters before is stale. -->
									{#if !loading}{@render empty(list.emptyNoun?.(p) ?? list.noun)}{/if}
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
			<button type="button" class="btn" onclick={() => patchUrl(widen.patch)}>{widen.label}</button>
		{/if}
		{#if q}
			<button type="button" class="btn" onclick={() => openSearch(q)}
				>Zoek "{q}" in alle bronnen</button
			>
		{/if}
	</div>
{/snippet}

<!-- The order of the list, at the right of the bar of filters. -->
{#snippet sortControl()}
	<TekstMenu
		rechts
		label="Volgorde"
		waarde={sortDef.id}
		opties={sorts.map((o) => ({ waarde: o.id, label: o.label }))}
		onSelect={(v) => patchUrl({ sort: v || null })}
	/>
	{#if dir}
		<IconButton
			label={dir === 'asc' ? 'Oplopend; sorteer aflopend' : 'Aflopend; sorteer oplopend'}
			onclick={() => patchUrl({ dir: dir === 'asc' ? 'desc' : 'asc' })}
			>{dir === 'asc' ? '↑' : '↓'}</IconButton
		>
	{/if}
{/snippet}

<!-- How many, under the filters: the count before the chips. -->
{#snippet countLine()}
	{#if loading && pages[category]}
		<!-- A filter on its way: the count it will have, not the one before (B24). -->
		<p class="result-count"><span class="result-noun">tellen…</span></p>
	{:else if resultTotal !== null && !error}
		<p class="result-count">
			{formatCount(resultTotal)}<span class="result-noun"
				>&nbsp;{resultTotal === 1 ? noun1(category) : labelOf(category)}{#if summary},
					{summary}{/if}</span
			>
		</p>
	{:else}
		<!-- The count's own height before it is known, so nothing below it moves. -->
		<p class="result-count" aria-hidden="true">&nbsp;</p>
	{/if}
{/snippet}

<!-- At the right of the count: where the list comes from, and the list as a feed. -->
{#snippet sourceLine()}
	{#if listSource}
		<Coverage coverage={sourceCompleteness} of={SOURCE_LABEL[listSource] ?? listSource} />
	{/if}
	{#if follow}
		<!-- The list as a feed: its filters in one Atom link. -->
		<Follow href={atomHref(follow)} />
	{/if}
{/snippet}

<!-- Between the bar and the count: the hall of a Kamer, and counts that did not come. -->
{#snippet between()}
	{#if list.Header}<list.Header {ctx} />{/if}
	{#if facettenFout}
		<LoadState
			state={{ status: 'error', error: facettenFout }}
			what="De tellingen"
			plural
			retry={facettenOpnieuw}
		/>
	{/if}
{/snippet}

{#snippet loadMoreButton(loaded: AnyPage | undefined, noun: string)}
	{#if loaded?.more}
		{@const remaining = (loaded.total ?? 0) - loaded.items.length}
		<div class="volgende">
			{#if loadMoreError}
				<p class="volgende-fout" role="alert">
					{failureText(`De volgende ${noun}`, loadMoreError.error, true)}
					<Kenmerk error={loadMoreError.error} />
				</p>
			{/if}
			<AlleN
				volgende
				{noun}
				stap={pageSize}
				rest={remaining > 0 ? remaining : null}
				laden={loadingMore}
				opnieuw={!!loadMoreError}
				onclick={loadMore}
			/>
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
		padding: var(--s-3) var(--s-5) 0;
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
		flex-shrink: 0;
		overflow-x: auto;
		scrollbar-width: thin;
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
	}
	/* The list at the full width of the page, the bar of its filters over it. In this box
	   that scrolls on its own, the bar of a phone stays at its top (Thijs, 9 Oct). */
	.results {
		min-width: 0;
		--filterbar-top: 0;
	}

	.result-count {
		margin: 0 var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 600;
		line-height: 1.1;
		color: var(--ink);
	}
	.result-noun {
		margin-left: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.result-noun:first-child {
		margin-left: 0;
	}

	/* The heads of the columns, over the rows in the same grid. */
	.list-head {
		display: grid;
		grid-template-columns: var(--voorkolom) minmax(0, 1fr) var(--row-aside);
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
		grid-template-columns: var(--voorkolom) minmax(0, 1fr);
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
		font-variant-numeric: lining-nums tabular-nums;
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
			padding: var(--s-3) var(--s-4) 0;
		}
		.cat {
			padding: var(--s-2) var(--s-4) var(--s-3);
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

	/* The choose-line over the filters: the field, without rules. */
	.regel {
		margin-bottom: var(--s-4);
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
	}
</style>
