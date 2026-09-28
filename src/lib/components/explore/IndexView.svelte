<script lang="ts">
	// Index: browse one category at a time. Beside the list a column of filters, each
	// option with the number of bronnen it holds under the other filters. A row's title
	// links to the bron; the rest of the row expands inline with its metadata and the
	// ways of opening it (Lezen, Bekijk in netwerk).
	//
	// Every filter, the sort and the open row are in the URL, so a view can be shared.
	// What the API can filter or sort is passed on as a query; the rest is done
	// on the rows loaded so far.
	import { tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { bronHref } from '$lib/bron/href';
	import { useSearchOpener } from '$lib/stores/search-trigger';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import { TIERS, TIER_LABEL, bronLabel, type Collection, type Tier } from '$lib/vocabulary';
	import { getCoverage, type Coverage } from '$lib/api/stats';
	import {
		STAGES,
		STAGE_LABEL,
		dossierStatus,
		OUTCOME_LABEL,
		TRACK_LABEL,
		isStage,
		type Outcome,
		type Stage,
		type Track
	} from '$lib/components/parliamentary/stages';
	import { groupByNumber, numberOf } from '$lib/components/parliamentary/dossier-number';
	import { partyColor } from '$lib/utils/party-color';
	import Hemicycle from './Hemicycle.svelte';
	import IndexToolbar from './index/IndexToolbar.svelte';
	import IndexFacets, { activeFilters, type FacetGroup } from './index/IndexFacets.svelte';
	import { DECISION_KIND_LABEL, isDecisionKind } from './index/decision-kind';
	import {
		COMMITMENT_STATUSES,
		COMMITMENT_STATUS_LABEL,
		POSTS,
		POST_LABEL,
		currentCabinet,
		getCabinets,
		getMinistries,
		laterPosts,
		period,
		type Cabinet,
		type Ministry
	} from './index/government';
	import { COURT_GROUPS } from './index/courts';
	import { pannable } from './index/pannable';
	import IndexDetail from './index/IndexDetail.svelte';
	import IndexRow from './index/IndexRow.svelte';
	import {
		INDEX_CATEGORIES,
		INDEX_TABS,
		collectionOf,
		type IndexCategory
	} from './index/categories';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { formatCount } from '$lib/verbonden/filter';

	let {
		category,
		onSelectItem,
		onResultCountChange
	}: {
		category: IndexCategory;
		/** Opens the bron in Lezen, from the hemicycle. `name` is its key, and a dossier's number (`37020-XV`). */
		onSelectItem: (collection: Collection, name: string) => void;
		/** Reports what is shown and how many there are, for the status bar. */
		onResultCountChange?: (info: {
			filtered: number;
			total: number;
			category: IndexCategory;
		}) => void;
	} = $props();

	const oneOf = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined =>
		allowed.find((a) => a === value);

	// ── URL-driven filter state ─────────────────────────────────────────────
	const params = $derived(page.url.searchParams);
	const q = $derived(params.get('q') ?? '');
	const stage = $derived(oneOf(params.get('stage'), STAGES));
	// Stages a dossier must all have passed, comma-separated.
	const hasStage = $derived((params.get('has_stage') ?? '').split(',').filter(isStage).join(','));
	// The tracks are the API's: a new one shows up with its own name until it has a label.
	const track = $derived(params.get('track') ?? '');
	const trackLabel = (t: string) =>
		TRACK_LABEL[t as Track] ?? t.charAt(0).toUpperCase() + t.slice(1).replaceAll('_', ' ');
	const decisionKindParam = $derived(params.get('soort') ?? '');
	const ministry = $derived(params.get('ministry') ?? '');
	/** A ministry of the URL as the API types it; an unknown key is left to the API to refuse. */
	const asMinistry = (key: string) => (key || undefined) as Schema<'MinistryKey'> | undefined;
	const cabinetParam = $derived(params.get('cabinet') ?? '');
	const memberParam = $derived(params.get('member') ?? '');
	const post = $derived(oneOf(params.get('post'), POSTS));
	const commitmentStatus = $derived(oneOf(params.get('status'), COMMITMENT_STATUSES));
	const overdue = $derived(params.get('overdue') === '1');
	const coalition = $derived(params.get('coalition') ?? '');
	// Dossiers: the open ones unless asked otherwise; a number searched for is looked up in all.
	const OUTCOMES = Object.keys(OUTCOME_LABEL) as Outcome[];
	const DOSSIER_NUMBER = /^\d{5}(-[a-z0-9()]+)?$/i;
	const dossierStatusParam = $derived(
		oneOf(params.get('stand'), ['open', 'closed', 'all'] as const)
	);
	const dossierScope = $derived(
		dossierStatusParam ?? (DOSSIER_NUMBER.test(q.trim()) ? 'all' : 'open')
	);
	const outcome = $derived(oneOf(params.get('outcome'), OUTCOMES));
	const passed = $derived(oneOf(params.get('passed'), ['true', 'false'] as const));
	const dateFrom = $derived(params.get('from') ?? '');
	const dateTo = $derived(params.get('to') ?? '');
	const dossierFilter = $derived(params.get('dossier') ?? '');
	const party = $derived(params.get('party') ?? '');
	const jurisdiction = $derived(oneOf(params.get('jurisdiction'), ['nl', 'eu'] as const));
	const court = $derived(params.get('court') ?? '');
	// TODO(backend G14): the lists hold records without text or articles; until they can
	// be left out by a parameter, a wet needs an article and a judgment a source.
	const withEmpty = $derived(params.get('leeg') === '1');
	const source = $derived(oneOf(params.get('source'), ['echr'] as const));
	const tier = $derived(oneOf(params.get('tier'), TIERS));
	const sort = $derived(params.get('sort'));
	const dirParam = $derived(oneOf(params.get('dir'), ['asc', 'desc'] as const));
	const onlyActive = $derived(params.get('only_active') === '1');
	// Members and factions are the sitting ones unless historical ones are asked for.
	const includeInactive = $derived(params.get('include_inactive') === '1');

	const FILTER_PARAMS = [
		'q',
		'stage',
		'has_stage',
		'track',
		'soort',
		'passed',
		'from',
		'to',
		'dossier',
		'party',
		'jurisdiction',
		'court',
		'tier',
		'leeg',
		'source',
		'sort',
		'dir',
		'only_active',
		'include_inactive',
		'ministry',
		'cabinet',
		'member',
		'post',
		'status',
		'overdue',
		'coalition',
		'stand',
		'outcome'
	];

	/** A filter is a step in the history; the search text and the open row replace it. */
	function patchUrl(patch: Record<string, string | null>, replaceState = false) {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(patch)) {
			if (v === null || v === '') url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		const search = url.search.replaceAll('%2F', '/');
		goto(url.pathname + search, { replaceState, keepFocus: true, noScroll: true });
	}

	const toggleParam = (name: string, current: string | undefined, value: string) =>
		patchUrl({ [name]: current === value ? null : value });

	// A tab drops the filters and the open row, so a stage filter of dossiers does not leak into decisions.
	function tabHref(k: IndexCategory): string {
		const url = new URL(page.url);
		for (const p of [...FILTER_PARAMS, 'open']) url.searchParams.delete(p);
		url.searchParams.set('mode', 'index');
		url.searchParams.set('kind', k);
		return url.pathname + url.search;
	}

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
				FILTER_PARAMS.filter((p) => p !== 'sort' && p !== 'dir').map((p) => [p, null])
			)
		);

	// ── Sorting ─────────────────────────────────────────────────────────────
	// The first option is the default. An option with `dir` is sorted here, with
	// that direction unless the URL says otherwise; the others are sorted by the API.
	type SortDef = { id: string; label: string; dir?: 'asc' | 'desc' };
	const SORTS: Record<IndexCategory, SortDef[]> = {
		instruments: [
			{ id: 'title', label: 'Citatietitel' },
			{ id: 'article_count', label: 'Aantal artikelen' }
		],
		judgments: [
			{ id: 'date_desc', label: 'Datum (nieuw → oud)' },
			{ id: 'date_asc', label: 'Datum (oud → nieuw)' },
			{ id: 'citation_count', label: 'Meest geciteerd' }
		],
		// Sorted by the API, over all pages.
		dossiers: [
			{ id: 'opened_on', label: 'Geopend (nieuw → oud)' },
			{ id: 'number', label: 'Kamerstuknummer' },
			{ id: 'closed_on', label: 'Afgehandeld (nieuw → oud)' },
			{ id: 'title', label: 'Titel' }
		],
		committees: [
			{ id: 'dossiers', label: 'Actieve dossiers', dir: 'desc' },
			{ id: 'abbreviation', label: 'Afkorting', dir: 'asc' },
			{ id: 'name', label: 'Naam', dir: 'asc' }
		],
		members: [
			{ id: 'name', label: 'Naam', dir: 'asc' },
			{ id: 'party', label: 'Fractie', dir: 'asc' }
		],
		factions: [
			{ id: 'seats', label: 'Zetels', dir: 'desc' },
			{ id: 'abbreviation', label: 'Afkorting', dir: 'asc' },
			{ id: 'name', label: 'Naam', dir: 'asc' }
		],
		decisions: [
			{ id: 'date', label: 'Datum', dir: 'desc' },
			{ id: 'result', label: 'Uitslag', dir: 'asc' },
			{ id: 'subject', label: 'Onderwerp', dir: 'asc' }
		],
		cabinets: [
			{ id: 'date', label: 'Aantreden', dir: 'desc' },
			{ id: 'bills', label: 'Wetsvoorstellen', dir: 'desc' },
			{ id: 'name', label: 'Naam', dir: 'asc' }
		],
		// Protocol: the ministries in their order, as the API gives them.
		ministers: [
			{ id: 'protocol', label: 'Ministerie' },
			{ id: 'name', label: 'Naam', dir: 'asc' },
			{ id: 'dossiers', label: 'Dossiers', dir: 'desc' },
			{ id: 'open_commitments', label: 'Open toezeggingen', dir: 'desc' }
		],
		commitments: [
			{ id: 'date', label: 'Datum' },
			{ id: 'expected_resolution', label: 'Verwachte afdoening' }
		]
	};
	const sortDef = $derived(SORTS[category].find((s) => s.id === sort) ?? SORTS[category][0]);
	const dir = $derived(sortDef.dir && (dirParam ?? sortDef.dir));

	type Keys<T> = Record<string, (row: T) => string | number>;
	function sorted<T>(rows: T[], keys: Keys<T>): T[] {
		// The list of the category just left recomputes once more with the sort of the
		// next one; a sort it does not know leaves the order as the API gave it.
		const key = keys[sortDef.id];
		if (!key) return rows;
		const sign = dir === 'asc' ? 1 : -1;
		return [...rows].sort((a, b) => {
			const [x, y] = [key(a), key(b)];
			return (
				(typeof x === 'number' ? x - (y as number) : x.localeCompare(y as string, 'nl')) * sign
			);
		});
	}

	// ── Data ────────────────────────────────────────────────────────────────
	type Page<T> = { items: T[]; total: number; more: boolean };
	type AnyPage = Page<unknown>;
	type Pages = {
		instruments?: Page<Schema<'InstrumentListItemDTO'>>;
		judgments?: Page<Schema<'JudgmentListItemDTO'>>;
		dossiers?: Page<Schema<'DossierSummaryDTO'>>;
		committees?: Page<Schema<'CommitteeDTO'>>;
		members?: Page<Schema<'MemberDTO'>>;
		factions?: Page<Schema<'FactionDTO'>>;
		decisions?: Page<Schema<'DecisionSummaryDTO'>>;
		cabinets?: Page<Cabinet>;
		ministers?: Page<MinisterRow>;
		commitments?: Page<Schema<'CommitmentDTO'>>;
	};
	/** One post in a cabinet, with the ministry it is under. */
	type MinisterRow = Schema<'CabinetPostDTO'> & {
		ministry: string | null;
		ministryName: string | null;
	};

	const PAGE = 100;

	// A list without `total` (members) is over when a slice comes back short.
	function toPage<T>(
		previous: Page<T> | undefined,
		items: T[],
		offset: number,
		total?: number
	): Page<T> {
		const all = offset && previous ? [...previous.items, ...items] : items;
		return {
			items: all,
			total: total ?? all.length,
			more: total === undefined ? items.length === PAGE : all.length < total
		};
	}

	let pages = $state<Pages>({});
	let seats = $state<Schema<'ParliamentSeatsResponse'> | null>(null);
	/** The sitting factions, to filter members by, with their seats. */
	let parties = $state<{ abbreviation: string; seats: number | null }[]>([]);
	// The counts per filter option the API gives with a list, under the other filters.
	let dossierFacets = $state<Schema<'DossierFacetsDTO'> | null>(null);
	let decisionFacets = $state<Schema<'DecisionFacets'> | null>(null);
	let judgmentFacets = $state<Schema<'JudgmentFacets'> | null>(null);
	// The EHRM judgments under the same search and period: the EHRM is its own source, so
	// the facet of the list does not count them.
	let echrTotal = $state<number | null>(null);
	/** The number of commitments in each state, under the other filters. */
	let statusCounts = $state<Map<string, number> | null>(null);
	let cabinets = $state<Cabinet[]>([]);
	let ministries = $state<Ministry[]>([]);
	/** The cabinet whose bewindspersonen are listed. */
	let shownCabinet = $state<Schema<'CabinetDetailDTO'> | null>(null);
	let loading = $state(false);
	let loadingMore = $state(false);
	let loadMoreFailed = $state(false);
	let error = $state<string | null>(null);

	// The request for the current category and filters. It is rebuilt only when
	// one of the values it reads changes, and that is what triggers a new load.
	type Fetcher = (offset: number, signal: AbortSignal) => Promise<void>;
	const fetchPage = $derived.by<Fetcher>(() => {
		const limit = PAGE;
		switch (category) {
			case 'instruments': {
				const query = {
					q: q || undefined,
					jurisdiction,
					article_count_min: withEmpty ? undefined : 1,
					sort: oneOf(sortDef.id, ['title', 'article_count'] as const),
					limit
				};
				return async (offset, signal) => {
					const r = await unwrap(
						api.GET('/api/instruments', { params: { query: { ...query, offset } }, signal })
					);
					pages.instruments = toPage(pages.instruments, r.items, offset, r.total);
				};
			}
			case 'judgments': {
				const query = {
					q: q || undefined,
					court: court || undefined,
					tier,
					// Without a source the list holds the cited judgments whose text is not loaded.
					source: source ?? 'rechtspraak',
					from: dateFrom || undefined,
					to: dateTo || undefined,
					sort: oneOf(sortDef.id, ['date_desc', 'date_asc', 'citation_count'] as const),
					limit
				};
				return async (offset, signal) => {
					const r = await unwrap(
						api.GET('/api/judgments', { params: { query: { ...query, offset } }, signal })
					);
					pages.judgments = toPage(pages.judgments, r.items, offset, r.total);
					if (!offset) judgmentFacets = r.facets ?? null;
					if (!offset && (query.q || query.from || query.to)) {
						const echr = await unwrap(
							api.GET('/api/judgments', {
								params: {
									query: { q: query.q, from: query.from, to: query.to, source: 'echr', limit: 1 }
								},
								signal
							})
						).catch(() => null);
						echrTotal = echr?.total ?? null;
					} else if (!offset) echrTotal = null;
				};
			}
			case 'dossiers': {
				const query = {
					status: dossierScope,
					outcome,
					subject: q || undefined,
					stage,
					has_stage: hasStage || undefined,
					track: track || undefined,
					ministry: asMinistry(ministry),
					sort: oneOf(sortDef.id, ['number', 'opened_on', 'closed_on', 'title'] as const),
					limit
				};
				return async (offset, signal) => {
					const r = await unwrap(
						api.GET('/api/dossiers', { params: { query: { ...query, offset } }, signal })
					);
					pages.dossiers = toPage(pages.dossiers, r.items, offset, r.total);
					if (!offset) dossierFacets = r.facets ?? null;
				};
			}
			case 'committees':
				return async (_offset, signal) => {
					const items = await unwrap(api.GET('/api/committees', { signal }));
					pages.committees = toPage(undefined, items, 0, items.length);
				};
			case 'members': {
				const query = {
					q: q || undefined,
					party: party || undefined,
					active: includeInactive ? undefined : true,
					include_all: includeInactive,
					limit
				};
				return async (offset, signal) => {
					const items = await unwrap(
						api.GET('/api/members', { params: { query: { ...query, offset } }, signal })
					);
					pages.members = toPage(pages.members, items, offset);
				};
			}
			case 'factions': {
				const query = { q: q || undefined, active: includeInactive ? undefined : true };
				return async (_offset, signal) => {
					const items = await unwrap(api.GET('/api/factions', { params: { query }, signal }));
					pages.factions = toPage(undefined, items, 0, items.length);
				};
			}
			case 'decisions': {
				const query = {
					kind: isDecisionKind(decisionKindParam) ? decisionKindParam : undefined,
					passed: passed === undefined ? undefined : passed === 'true',
					from: dateFrom || undefined,
					to: dateTo || undefined,
					q: q || undefined,
					dossier: dossierFilter || undefined,
					party: party || undefined,
					limit: 200
				};
				return async (offset, signal) => {
					const r = await unwrap(
						api.GET('/api/decisions', { params: { query: { ...query, offset } }, signal })
					);
					pages.decisions = toPage(pages.decisions, r.items, offset, r.total);
					if (!offset) decisionFacets = r.facets ?? null;
				};
			}
			case 'cabinets':
				return async () => {
					const items = await getCabinets();
					pages.cabinets = toPage(undefined, items, 0, items.length);
				};
			case 'ministers': {
				const key = cabinetParam;
				return async (_offset, signal) => {
					const all = await getCabinets();
					const chosen = key || currentCabinet(all)?.key;
					if (!chosen) {
						pages.ministers = toPage(undefined, [], 0, 0);
						return;
					}
					const detail = await unwrap(
						api.GET('/api/cabinets/{key}', { params: { path: { key: chosen } }, signal })
					);
					shownCabinet = detail;
					const rows = (detail.ministries ?? []).flatMap((m) =>
						m.posts.map((p) => ({
							...p,
							ministry: m.ministry ?? null,
							ministryName: m.name ?? null
						}))
					);
					pages.ministers = toPage(undefined, rows, 0, rows.length);
				};
			}
			case 'commitments': {
				const filters = {
					cabinet: cabinetParam || undefined,
					ministry: asMinistry(ministry),
					member: memberParam || undefined,
					overdue: overdue || undefined,
					q: q || undefined
				};
				const query = {
					...filters,
					status: commitmentStatus,
					sort: oneOf(sortDef.id, ['date', 'expected_resolution'] as const),
					limit
				};
				return async (offset, signal) => {
					const r = await unwrap(
						api.GET('/api/commitments', { params: { query: { ...query, offset } }, signal })
					);
					pages.commitments = toPage(pages.commitments, r.items, offset, r.total);
					if (offset) return;
					// The list has no facets: one count per state, under the other filters.
					const counts = await Promise.all(
						COMMITMENT_STATUSES.map((st) =>
							unwrap(
								api.GET('/api/commitments', {
									params: { query: { ...filters, status: st, limit: 1 } },
									signal
								})
							).then((c) => [st, c.total] as const)
						)
					);
					statusCounts = new Map(counts);
				};
			}
		}
	});

	let loadMoreAbort: AbortController | null = null;
	/** The load in progress, which a list kept from before replaces (see Coming back). */
	let loadAbort: AbortController | null = null;

	$effect(() => {
		const load = fetchPage;
		const ac = new AbortController();
		loadAbort = ac;
		loading = true;
		error = null;
		loadMoreFailed = false;
		load(0, ac.signal)
			.catch(() => {
				if (!ac.signal.aborted) error = `${labelOf(category)} konden niet worden geladen.`;
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
		const loaded = pages[category];
		if (!loaded || !scroller || loading) return;
		const entry: Kept = {
			url: keptUrl(url),
			category,
			page: $state.snapshot(loaded) as AnyPage,
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
		const staying =
			to?.url.pathname === from?.url.pathname && to?.url.searchParams.get('mode') === 'index';
		if (from && !staying) keep(from.url);
	});

	// Mounting by Back or Forward takes the kept list in place of the first page.
	let mounted = false;
	afterNavigate(({ type, to }) => {
		if (mounted) return;
		mounted = true;
		const kept = type === 'popstate' && to && readKept().find((k) => k.url === keptUrl(to.url));
		if (!kept || kept.category !== category) {
			revealOpen = !!openId;
			return;
		}
		loadAbort?.abort();
		loading = false;
		(pages as Record<IndexCategory, AnyPage>)[category] = kept.page;
		tick().then(() => scroller?.scrollTo({ top: kept.scroll }));
	});

	// Seats for the hemicycle, once, when the factions are opened.
	$effect(() => {
		if (category !== 'factions' || seats) return;
		const ac = new AbortController();
		unwrap(api.GET('/api/parliament/seats', { signal: ac.signal }))
			.then((r) => (seats = r))
			.catch(() => {});
		return () => ac.abort();
	});

	// The factions to filter members by; the member list itself is filtered by the API.
	$effect(() => {
		if (category !== 'members' || parties.length) return;
		const ac = new AbortController();
		unwrap(api.GET('/api/factions', { params: { query: { active: true } }, signal: ac.signal }))
			.then(
				(r) =>
					(parties = r
						.flatMap((f) =>
							f.abbreviation ? [{ abbreviation: f.abbreviation, seats: f.seats ?? null }] : []
						)
						.sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0)))
			)
			.catch(() => {});
		return () => ac.abort();
	});

	// ── What the API cannot filter or sort ──────────────────────────────────
	function countBy<T, K>(rows: T[] | undefined, key: (row: T) => K): Map<K, number> {
		const counts = new Map<K, number>();
		for (const row of rows ?? []) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
		return counts;
	}

	const includes = (text: string | null | undefined) =>
		(text ?? '').toLowerCase().includes(q.toLowerCase());

	/** A facet of the API as value → count; each dimension counted without its own filter. */
	const facetMap = (facet: { value?: string | boolean | null; count: number }[] | undefined) =>
		new Map((facet ?? []).map((f) => [String(f.value), f.count]));

	const dossierTracks = $derived(facetMap(dossierFacets?.track));
	const dossierStages = $derived(facetMap(dossierFacets?.stage));
	const dossierMinistries = $derived(facetMap(dossierFacets?.ministry));

	const dossiersShown = $derived(pages.dossiers?.items);

	/** The stages a bill passes, in order, for the bar in a dossier's row. */
	const BILL_STAGES: Stage[] = STAGES.filter((s) => s !== 'afgehandeld');

	// Sorted by number, the dossiers that share a number form one row that opens to them.
	type DossierRow = Schema<'DossierSummaryDTO'>;
	const dossierEntries = $derived.by(() =>
		!dossiersShown
			? undefined
			: sortDef.id === 'number'
				? groupByNumber(dossiersShown)
				: dossiersShown.map((d) => ({ number: numberOf(d.number), rows: [d] }))
	);
	let openNumbers = $state(new Set<string>());
	const toggleNumber = (number: string) => {
		const next = new Set(openNumbers);
		if (!next.delete(number)) next.add(number);
		openNumbers = next;
	};

	const committeesShown = $derived.by(() => {
		const rows = pages.committees?.items.filter(
			(c) =>
				(!onlyActive || (c.active_dossier_count ?? 0) > 0) &&
				(!q || includes(c.name) || includes(c.abbreviation) || includes(c.slug))
		);
		return (
			rows &&
			sorted(rows, {
				dossiers: (c) => c.active_dossier_count ?? 0,
				abbreviation: (c) => c.abbreviation ?? '',
				name: (c) => c.name ?? ''
			})
		);
	});

	const membersShown = $derived(
		pages.members &&
			sorted(pages.members.items, { name: (m) => m.name ?? '', party: (m) => m.party ?? '' })
	);

	const factionsShown = $derived(
		pages.factions &&
			sorted(pages.factions.items, {
				seats: (f) => f.seats ?? 0,
				abbreviation: (f) => f.abbreviation ?? '',
				name: (f) => f.name ?? ''
			})
	);

	type DecisionRow = Schema<'DecisionSummaryDTO'>;
	const decisionKinds = $derived(facetMap(decisionFacets?.kind));
	const decisionOutcomes = $derived(facetMap(decisionFacets?.passed));
	/** Per sitting day, all its decisions under the filters, also those not yet loaded. */
	const decisionDayCounts = $derived(
		new Map((decisionFacets?.days ?? []).map((d) => [d.date, d] as const))
	);

	const decisionsShown = $derived(
		pages.decisions &&
			sorted(pages.decisions.items, {
				date: (s) => s.date ?? '',
				result: (s) => Number(s.passed),
				subject: (s) => s.subject ?? ''
			})
	);

	// Sorted by date, the decisions of one sitting day are one group: the Kamer votes in blocks.
	const decisionDays = $derived.by(() => {
		if (!decisionsShown) return undefined;
		if (sortDef.id !== 'date')
			return [{ date: null, rows: decisionsShown, count: decisionsShown.length, passed: 0 }];
		const days: { date: string | null; rows: DecisionRow[]; passed: number }[] = [];
		for (const s of decisionsShown) {
			const last = days.at(-1);
			const day = last && last.date === (s.date ?? null) ? last : null;
			if (day) day.rows.push(s);
			else days.push({ date: s.date ?? null, rows: [s], passed: 0 });
		}
		// The day's own numbers, from the facet; the rows loaded may be fewer.
		return days.map((d) => {
			const facet = d.date ? decisionDayCounts.get(d.date) : undefined;
			return {
				...d,
				count: facet?.count ?? d.rows.length,
				passed: facet?.passed ?? d.rows.filter((r) => r.passed).length
			};
		});
	});

	// ── Regering ────────────────────────────────────────────────────────────
	// The cabinets and ministries fill the filters of all three categories.
	$effect(() => {
		if (!['cabinets', 'ministers', 'commitments', 'dossiers'].includes(category)) return;
		if (!cabinets.length)
			getCabinets()
				.then((c) => (cabinets = c))
				.catch(() => {});
		if (!ministries.length)
			getMinistries()
				.then((m) => (ministries = m))
				.catch(() => {});
	});
	const ministryName = (key: string | null | undefined) =>
		(key && ministries.find((m) => m.key === key)?.name) || key || '';

	/** Parties in a coalition, with the number of cabinets they were in. */
	const coalitionParties = $derived(
		[
			...countBy(
				cabinets.flatMap((c) => (c.parties ?? []).flatMap((p) => p.short ?? [])),
				(p) => p
			)
		]
			.filter(([, n]) => n > 1)
			.sort((a, b) => b[1] - a[1])
	);
	const cabinetsShown = $derived.by(() => {
		const rows = pages.cabinets?.items.filter(
			(c) =>
				(!coalition || (c.parties ?? []).some((p) => p.short === coalition)) &&
				(!dateFrom || (c.to_date ?? '9999') >= dateFrom) &&
				(!dateTo || (c.from_date ?? '') <= dateTo) &&
				(!q ||
					includes(c.name) ||
					includes(c.prime_minister?.name) ||
					(c.parties ?? []).some((p) => includes(p.short) || includes(p.name)))
		);
		return (
			rows &&
			sorted(rows, {
				date: (c) => c.from_date ?? '',
				bills: (c) => c.bills,
				name: (c) => c.name
			})
		);
	});
	/** The years the cabinets span, for the strip above the list. */
	// The cabinets on a line of years, so wide that the names can be read; it scrolls and is
	// dragged sideways, and opens at the present.
	const YEAR_WIDTHS = [10, 16, 28, 48, 80];
	let yearWidth = $state(28);
	let cabScroll = $state<HTMLElement | null>(null);
	const cabinetSpan = $derived.by(() => {
		const year = (iso: string | null | undefined, end: boolean) =>
			iso ? Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12 : end ? thisYear + 1 : 0;
		const rows = [...(cabinetsShown ?? [])].sort((a, b) =>
			(a.from_date ?? '').localeCompare(b.from_date ?? '')
		);
		if (!rows.length) return null;
		const from = Math.floor(Math.min(...rows.map((c) => year(c.from_date, false))));
		const to = Math.ceil(Math.max(...rows.map((c) => year(c.to_date, true))));
		return { from, to, year, rows };
	});
	const cabTicks = $derived.by(() => {
		if (!cabinetSpan) return [];
		const step = yearWidth >= 48 ? 2 : yearWidth >= 28 ? 5 : 10;
		const ticks = [];
		for (let y = Math.ceil(cabinetSpan.from / step) * step; y < cabinetSpan.to; y += step)
			ticks.push(y);
		return ticks;
	});
	// Zooming keeps the year in the middle in the middle.
	function zoomCabinets(step: number) {
		const i = YEAR_WIDTHS.indexOf(yearWidth) + step;
		if (i < 0 || i >= YEAR_WIDTHS.length) return;
		const el = cabScroll;
		const middle = el ? (el.scrollLeft + el.clientWidth / 2) / yearWidth : 0;
		yearWidth = YEAR_WIDTHS[i];
		if (el) tick().then(() => (el.scrollLeft = middle * yearWidth - el.clientWidth / 2));
	}
	// A new set of cabinets opens at its newest.
	$effect(() => {
		const el = cabScroll;
		void cabinetSpan?.rows.length;
		if (el) untrack(() => tick().then(() => (el.scrollLeft = el.scrollWidth)));
	});
	const thisYear = new Date().getFullYear();

	const ministerPostCounts = $derived(countBy(pages.ministers?.items, (m) => m.post ?? ''));
	const ministersShown = $derived.by(() => {
		const rows = pages.ministers?.items.filter(
			(m) => (!post || m.post === post) && (!q || includes(m.member.name))
		);
		return (
			rows &&
			sorted(rows, {
				name: (m) => m.member.name ?? '',
				dossiers: (m) => m.dossiers,
				open_commitments: (m) => m.open_commitments
			})
		);
	});
	// The counts of a person stand with their longest post in the list shown.
	const repeatPosts = $derived(laterPosts(ministersShown ?? []));
	/** Under the protocol order, the posts under their ministry; the others without a ministry last. */
	const ministerGroups = $derived.by(() => {
		if (!ministersShown) return undefined;
		if (sortDef.id !== 'protocol') return [{ key: null, name: null, rows: ministersShown }];
		const groups: { key: string | null; name: string | null; rows: MinisterRow[] }[] = [];
		for (const m of ministersShown) {
			const last = groups.at(-1);
			if (last && last.key === m.ministry) last.rows.push(m);
			else groups.push({ key: m.ministry, name: m.ministryName, rows: [m] });
		}
		return groups;
	});

	const totalSeats = $derived(factionsShown?.reduce((sum, f) => sum + (f.seats ?? 0), 0) ?? 0);

	// ── Toolbar ─────────────────────────────────────────────────────────────
	/**
	 * The courts to filter on: the colleges the dataset holds judgments of, from
	 * `/api/stats/coverage`, and the EHRM. The EHRM is its own source (`echr`); the list
	 * of a college holds the judgments of `rechtspraak` only.
	 */
	let coverage = $state<Coverage | null>(null);
	$effect(() => {
		if (category !== 'judgments' || coverage) return;
		getCoverage()
			.then((c) => (coverage = c))
			.catch(() => {
				// Without coverage the filters are the usual colleges, without counts.
			});
	});
	// Counts per tier and for the EHRM. Which courts there are comes from the coverage; the
	// counts under the period and search from the list's facet.
	const courtCounts = $derived.by(() => {
		if (!coverage) return null;
		const counts = new Map<Tier, number>();
		for (const t of coverage.tiers) if (t.tier) counts.set(t.tier as Tier, t.count);
		// Under the other filters, from the list's facet; the EHRM is its own source.
		if (judgmentFacets && source !== 'echr')
			for (const t of TIERS) if (t !== 'ehrm') counts.set(t, 0);
		if (source !== 'echr')
			for (const f of judgmentFacets?.tier ?? [])
				if (f.value && f.value !== 'ehrm') counts.set(f.value as Tier, f.count);
		const echr = coverage.courts
			.filter((c) => c.source === 'echr')
			.reduce((n, c) => n + c.count, 0);
		// Under a search or a period, the EHRM judgments that match it.
		counts.set('ehrm', q || dateFrom || dateTo ? (echrTotal ?? 0) : echr);
		return counts;
	});
	const USUAL: Tier[] = [
		'hoge_raad',
		'parket',
		'raad_van_state',
		'gerechtshof',
		'rechtbank',
		'ehrm'
	];

	/** The courts under their group; without coverage the usual ones, without counts. */
	const courtOptions = $derived.by(() => {
		const held = (t: Tier) =>
			coverage
				? coverage.tiers.some((c) => c.tier === t && c.count > 0) || t === 'ehrm' || t === tier
				: USUAL.includes(t) || t === tier;
		const named = new Set(COURT_GROUPS.flatMap((g) => g.tiers));
		const groups = [
			...COURT_GROUPS,
			{ label: 'Overig', tiers: TIERS.filter((t) => !named.has(t)) }
		];
		return groups.flatMap((g) => {
			const tiers = g.tiers.filter(held);
			if (!tiers.length) return [];
			const count = courtCounts && tiers.reduce((n, t) => n + (courtCounts.get(t) ?? 0), 0);
			return [
				{ heading: g.label, count: count ?? undefined },
				...tiers.map((t) => {
					const ehrm = t === 'ehrm';
					const on = ehrm ? source === 'echr' : source !== 'echr' && !court && tier === t;
					return {
						id: t,
						label: TIER_LABEL[t],
						count: courtCounts?.get(t),
						indent: true,
						on,
						// One college or the EHRM at a time: the API takes one tier.
						onClick: () =>
							patchUrl({
								tier: on || ehrm ? null : t,
								court: null,
								source: ehrm && !on ? 'echr' : null
							})
					};
				})
			];
		});
	});

	// The years of the judgments under the filters, the last forty, as columns.
	const judgmentYears = $derived(
		(judgmentFacets?.year ?? [])
			.flatMap((f) => (f.value ? [{ year: f.value, count: f.count }] : []))
			.sort((a, b) => a.year.localeCompare(b.year))
			.slice(-40)
	);

	const PLACEHOLDER: Record<IndexCategory, string> = {
		instruments: 'Zoek in titel, BWB of citatie',
		judgments: 'Zoek in zaaknaam of ECLI',
		dossiers: 'Zoek op nummer of in titel',
		committees: 'Zoek op afkorting of naam',
		members: 'Zoek op naam',
		factions: 'Zoek op naam of afkorting',
		decisions: 'Zoek in onderwerp',
		cabinets: 'Zoek op naam, minister-president of partij',
		ministers: 'Zoek op naam',
		commitments: 'Zoek in de tekst'
	};

	const labelOf = (c: IndexCategory) =>
		INDEX_CATEGORIES.find((cat) => cat.key === c)!.label.toLowerCase();
	const noun1 = (c: IndexCategory) =>
		c === 'ministers' ? 'bewindspersoon' : bronLabel(collectionOf(c)).toLowerCase();

	const toggle = (name: string, current: string | undefined, value: string) => () =>
		toggleParam(name, current, value);
	const flag = (name: string, on: boolean) => () => patchUrl({ [name]: on ? null : '1' });

	const facetGroups = $derived.by<FacetGroup[]>(() => {
		switch (category) {
			case 'instruments':
				return [
					{
						id: 'jurisdiction',
						label: 'Rechtsorde',
						kind: 'list',
						options: [
							{
								id: 'nl',
								label: 'Nederland',
								on: jurisdiction === 'nl',
								onClick: toggle('jurisdiction', jurisdiction, 'nl')
							},
							{
								id: 'eu',
								label: 'Europese Unie',
								on: jurisdiction === 'eu',
								onClick: toggle('jurisdiction', jurisdiction, 'eu')
							}
						]
					},
					{
						id: 'leeg',
						label: 'Weergave',
						kind: 'list',
						options: [
							{
								id: 'leeg',
								label: 'Ook zonder artikelen',
								on: withEmpty,
								onClick: flag('leeg', withEmpty)
							}
						]
					}
				];
			case 'judgments':
				return [
					{
						id: 'court',
						label: 'Instantie',
						note: coverage ? formatCount(coverage.total) : undefined,
						kind: 'list',
						options: courtOptions
					},
					{
						id: 'period',
						label: 'Periode',
						kind: 'range',
						unit: 'year',
						from: dateFrom,
						to: dateTo,
						onChange: (from, to) => patchUrl({ from: from || null, to: to || null })
					}
				];
			case 'dossiers': {
				// The tracks are the ones the API counts, in its order, the chosen one always.
				const tracks = [...dossierTracks.keys()].filter(
					(t) => (dossierTracks.get(t) ?? 0) > 0 || t === track
				);
				if (track && !tracks.includes(track)) tracks.push(track);
				const stages = STAGES.filter((st) => st !== 'afgehandeld');
				const statusCounts_ = facetMap(dossierFacets?.status);
				const outcomes = facetMap(dossierFacets?.outcome);
				const scope = (v: 'open' | 'closed' | 'all') => () =>
					patchUrl({ stand: v === 'open' ? null : v, outcome: null });
				return [
					{
						id: 'stand',
						label: 'Stand',
						kind: 'list',
						options: [
							{
								id: 'open',
								label: 'Lopend',
								count: statusCounts_.get('open') ?? 0,
								on: dossierScope === 'open',
								default: !dossierStatusParam,
								onClick: scope('open')
							},
							{
								id: 'closed',
								label: 'Afgehandeld',
								count: statusCounts_.get('closed') ?? 0,
								on: dossierScope === 'closed' && !outcome,
								onClick: scope(dossierScope === 'closed' && !outcome ? 'open' : 'closed')
							},
							...OUTCOMES.filter((o) => (outcomes.get(o) ?? 0) > 0 || o === outcome).map((o) => ({
								id: o,
								label: OUTCOME_LABEL[o],
								count: outcomes.get(o) ?? 0,
								indent: true,
								on: outcome === o,
								onClick: () =>
									patchUrl(outcome === o ? { outcome: null } : { outcome: o, stand: 'closed' })
							})),
							{
								id: 'all',
								label: 'Alle dossiers',
								count: (statusCounts_.get('open') ?? 0) + (statusCounts_.get('closed') ?? 0),
								on: dossierScope === 'all',
								// Chosen by a number searched for, not by the reader.
								default: !dossierStatusParam,
								onClick: scope(dossierScope === 'all' ? 'open' : 'all')
							}
						]
					},
					{
						id: 'track',
						label: 'Soort',
						kind: 'list',
						options: tracks.map((t) => ({
							id: t,
							label: trackLabel(t),
							count: dossierTracks.get(t) ?? 0,
							on: track === t,
							onClick: toggle('track', track, t)
						}))
					},
					{
						id: 'stage',
						label: 'Fase',
						note: `${formatCount(stages.reduce((n, st) => n + (dossierStages.get(st) ?? 0), 0))} met fase`,
						kind: 'steps',
						ends: ['Voorstel', 'Stemming'],
						none: 'Alle fasen',
						options: stages.map((st) => ({
							id: st,
							label: STAGE_LABEL[st],
							count: dossierStages.get(st) ?? 0,
							on: stage === st,
							onClick: toggle('stage', stage, st)
						}))
					},
					{
						id: 'ministry',
						label: 'Ministerie',
						kind: 'list',
						options: [...dossierMinistries]
							.filter(([m, n]) => m !== 'null' && (n > 0 || m === ministry))
							.sort((a, b) => b[1] - a[1])
							.map(([m, n]) => ({
								id: m,
								label: ministryName(m),
								count: n,
								on: ministry === m,
								onClick: toggle('ministry', ministry, m)
							}))
					}
				];
			}
			case 'decisions':
				return [
					{
						id: 'soort',
						label: 'Soort',
						kind: 'list',
						options: (Object.keys(DECISION_KIND_LABEL) as (keyof typeof DECISION_KIND_LABEL)[])
							.filter((k) => (decisionKinds.get(k) ?? 0) > 0 || k === decisionKindParam)
							.map((k) => ({
								id: k,
								label: DECISION_KIND_LABEL[k],
								count: decisionKinds.get(k) ?? 0,
								on: decisionKindParam === k,
								onClick: toggle('soort', decisionKindParam, k)
							}))
					},
					{
						id: 'passed',
						label: 'Uitslag',
						kind: 'list',
						options: [
							{
								id: 'true',
								label: 'Aangenomen',
								count: decisionOutcomes.get('true') ?? 0,
								on: passed === 'true',
								onClick: toggle('passed', passed, 'true')
							},
							{
								id: 'false',
								label: 'Verworpen',
								count: decisionOutcomes.get('false') ?? 0,
								on: passed === 'false',
								onClick: toggle('passed', passed, 'false')
							}
						]
					},
					{
						id: 'period',
						label: 'Datum',
						kind: 'range',
						unit: 'date',
						from: dateFrom,
						to: dateTo,
						onChange: (from, to) => patchUrl({ from: from || null, to: to || null })
					},
					{
						id: 'dossier',
						label: 'Dossier',
						kind: 'text',
						value: dossierFilter,
						placeholder: 'Kamerstuknummer',
						onChange: (v) => patchUrl({ dossier: v || null })
					}
				];
			case 'members':
				return [
					{
						id: 'party',
						label: 'Fractie',
						note: includeInactive ? undefined : 'zetels',
						kind: 'list',
						options: parties.map((p) => ({
							id: p.abbreviation,
							label: p.abbreviation,
							swatch: partyColor(p.abbreviation),
							// The seats are the sitting members; with historical ones they no longer are.
							count: includeInactive ? undefined : (p.seats ?? undefined),
							on: party === p.abbreviation,
							onClick: toggle('party', party, p.abbreviation)
						}))
					},
					{
						id: 'include_inactive',
						label: 'Weergave',
						kind: 'list',
						options: [
							{
								id: 'hist',
								label: 'Ook historische leden',
								on: includeInactive,
								onClick: flag('include_inactive', includeInactive)
							}
						]
					}
				];
			case 'factions':
				return [
					{
						id: 'include_inactive',
						label: 'Weergave',
						kind: 'list',
						options: [
							{
								id: 'hist',
								label: 'Ook opgeheven fracties',
								on: includeInactive,
								onClick: flag('include_inactive', includeInactive)
							}
						]
					}
				];
			case 'committees':
				return [
					{
						id: 'only_active',
						label: 'Weergave',
						kind: 'list',
						options: [
							{
								id: 'active',
								label: 'Alleen met lopende dossiers',
								on: onlyActive,
								onClick: flag('only_active', onlyActive)
							}
						]
					}
				];
			case 'cabinets':
				return [
					{
						id: 'coalition',
						label: 'In de coalitie',
						note: 'kabinetten',
						kind: 'list',
						options: coalitionParties.map(([p, n]) => ({
							id: p,
							label: p,
							count: n,
							swatch: partyColor(p),
							on: coalition === p,
							onClick: toggle('coalition', coalition, p)
						}))
					},
					{
						id: 'period',
						label: 'Periode',
						kind: 'range',
						unit: 'year',
						from: dateFrom,
						to: dateTo,
						onChange: (from, to) => patchUrl({ from: from || null, to: to || null })
					}
				];
			case 'ministers':
				return [
					{
						id: 'cabinet',
						label: 'Kabinet',
						kind: 'select',
						value: cabinetParam,
						all: currentCabinet(cabinets)
							? `${currentCabinet(cabinets)!.name} (in functie)`
							: 'Kabinet in functie',
						options: cabinets
							.filter((c) => c.to_date)
							.map((c) => ({
								value: c.key,
								label: `${c.name}, ${period(c.from_date, c.to_date)}`
							})),
						onChange: (v) => patchUrl({ cabinet: v || null, post: null })
					},
					{
						id: 'post',
						label: 'Functie',
						kind: 'list',
						options: POSTS.filter((p) => (ministerPostCounts.get(p) ?? 0) > 0 || p === post).map(
							(p) => ({
								id: p,
								label: POST_LABEL[p],
								count: ministerPostCounts.get(p) ?? 0,
								on: post === p,
								onClick: toggle('post', post, p)
							})
						)
					}
				];
			case 'commitments':
				return [
					{
						id: 'status',
						label: 'Stand',
						kind: 'list',
						options: COMMITMENT_STATUSES.filter(
							(st) => !statusCounts || (statusCounts.get(st) ?? 0) > 0 || st === commitmentStatus
						).map((st) => ({
							id: st,
							label: COMMITMENT_STATUS_LABEL[st],
							count: statusCounts?.get(st),
							on: commitmentStatus === st,
							onClick: toggle('status', commitmentStatus, st)
						}))
					},
					{
						id: 'overdue',
						label: 'Termijn',
						kind: 'list',
						options: [
							{
								id: 'overdue',
								label: 'Open en over de verwachte datum',
								on: overdue,
								onClick: flag('overdue', overdue)
							}
						]
					},
					{
						id: 'cabinet',
						label: 'Kabinet',
						kind: 'select',
						value: cabinetParam,
						all: 'Alle kabinetten',
						options: cabinets
							.filter((c) => c.commitments > 0 || c.key === cabinetParam)
							.map((c) => ({ value: c.key, label: c.name, count: c.commitments })),
						onChange: (v) => patchUrl({ cabinet: v || null })
					},
					{
						id: 'ministry',
						label: 'Ministerie',
						kind: 'select',
						value: ministry,
						all: 'Alle ministeries',
						options: ministries
							.filter((m) => !m.until || m.key === ministry)
							.map((m) => ({ value: m.key, label: m.name })),
						onChange: (v) => patchUrl({ ministry: v || null })
					},
					...(memberParam
						? [
								{
									id: 'member',
									label: 'Bewindspersoon',
									kind: 'list' as const,
									options: [
										{
											id: memberParam,
											label:
												pages.commitments?.items.find((c) => c.member?.key === memberParam)?.member
													?.name ?? 'Gekozen bewindspersoon',
											on: true,
											onClick: () => patchUrl({ member: null })
										}
									]
								}
							]
						: [])
				];
		}
	});
	const chips = $derived(activeFilters(facetGroups));
	let filtersOpen = $state(false);

	// On a narrow screen the tab strip scrolls: the category on screen is scrolled into it,
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
	// The open row is `?open=<collection>/<key>`, so it can be shared and Back finds it open.
	const openId = $derived(params.get('open'));
	const toggleOpen = (id: string) => patchUrl({ open: openId === id ? null : id }, true);

	// A shared link with an open row scrolls to it once the list is in.
	let revealOpen = $state(false);
	$effect(() => {
		if (!revealOpen || loading || !pages[category]) return;
		revealOpen = false;
		const id = untrack(() => openId);
		tick().then(() =>
			scroller
				?.querySelector(`[data-bron="${CSS.escape(id ?? '')}"]`)
				?.scrollIntoView({ block: 'center' })
		);
	});

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && openId) patchUrl({ open: null }, true);
	}

	// ── Result count for the status bar and above the list ──────────────────
	const resultRows = $derived.by(
		() =>
			({
				instruments: pages.instruments?.items,
				judgments: pages.judgments?.items,
				dossiers: dossiersShown,
				committees: committeesShown,
				members: membersShown,
				factions: factionsShown,
				decisions: decisionsShown,
				cabinets: cabinetsShown,
				ministers: ministersShown,
				commitments: pages.commitments?.items
			})[category] as unknown[] | undefined
	);
	/** How many there are under the filters: the API's total, or the rows filtered here. */
	const resultTotal = $derived.by(() => {
		if (!resultRows) return null;
		const clientFiltered = ['committees', 'cabinets', 'ministers'].includes(category);
		return clientFiltered ? resultRows.length : (pages[category]?.total ?? resultRows.length);
	});
	$effect(() => {
		const rows = resultRows;
		if (!rows) return;
		onResultCountChange?.({
			filtered: rows.length,
			total: pages[category]?.total ?? rows.length,
			category
		});
	});

	// ── Columns ─────────────────────────────────────────────────────────────
	// The heads over the three columns of a row, and their widths.
	type Columns = {
		lead: string;
		body: string;
		aside: string | string[];
		leadW: number;
		asideW: number;
	};
	const COLUMNS: Record<IndexCategory, Columns> = {
		instruments: {
			lead: 'BWB of CELEX',
			body: 'Wet',
			aside: 'Rechtsorde',
			leadW: 130,
			asideW: 110
		},
		judgments: { lead: 'Datum', body: 'Uitspraak', aside: 'Aangehaald', leadW: 110, asideW: 110 },
		dossiers: { lead: 'Nummer', body: 'Titel', aside: 'Fase', leadW: 110, asideW: 150 },
		decisions: { lead: 'Soort', body: 'Onderwerp', aside: 'Uitslag', leadW: 110, asideW: 110 },
		members: { lead: 'Fractie', body: 'Naam', aside: '', leadW: 150, asideW: 60 },
		factions: { lead: 'Fractie', body: 'Naam', aside: 'Zetels', leadW: 130, asideW: 110 },
		committees: {
			lead: 'Afkorting',
			body: 'Commissie',
			aside: 'Lopende dossiers',
			leadW: 110,
			asideW: 130
		},
		cabinets: {
			lead: 'Periode',
			body: 'Kabinet',
			aside: 'Bewindspersonen',
			leadW: 110,
			asideW: 130
		},
		ministers: {
			lead: 'Functie',
			body: 'Bewindspersoon',
			aside: ['Dossiers', 'Wetsvoorstellen', 'Open toezeggingen'],
			leadW: 150,
			asideW: 300
		},
		commitments: { lead: 'Gedaan', body: 'Toezegging', aside: 'Verwacht', leadW: 110, asideW: 130 }
	};
	const columns = $derived(COLUMNS[category]);

	// ── Opening a source ────────────────────────────────────────────────────
	// The title of a row opens the bron as Lezen in the detail does: a text of its own at
	// full width, the rest beside the network.
	const hrefOf = (bron: string) => bronHref(bron, { keepMode: false, mode: 'read' });

	// A wet that amends others is known from its Staatsblad number only: its own text
	// was not downloaded, but the articles it changed point to it.
	const isPublication = (w: Schema<'InstrumentListItemDTO'>) =>
		!w.bwb_id && !w.celex && !w.jurisdiction && w.key.startsWith('stb_');
	const jurisdictionTag = (w: Schema<'InstrumentListItemDTO'>) =>
		w.jurisdiction === 'eu'
			? 'EU'
			: w.jurisdiction === 'int'
				? 'Verdrag'
				: isPublication(w)
					? 'Stb.'
					: 'NL';

	const fmtDay = (iso: string) =>
		new Intl.DateTimeFormat('nl-NL', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(new Date(iso));

	const openSearch = useSearchOpener();

	const fmtDateShort = (iso: string | null | undefined) =>
		iso
			? new Intl.DateTimeFormat('nl-NL', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				}).format(new Date(iso))
			: '—';
</script>

<svelte:window onkeydown={handleKey} />

<div class="index-view">
	<!-- The categories in three groups, each named above its tabs: the law and the
	     courts, how the Kamer deals with a subject, and who does it. -->
	<nav
		class="catbar"
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
			<div class={category === 'factions' || category === 'decisions' ? 'page page--wide' : 'page'}>
				<aside class="facet-col" aria-label="Filters">
					<p class="page-about">{INDEX_CATEGORIES.find((c) => c.key === category)?.about}</p>
					<!-- On a narrow screen the filters fold away above the list. -->
					<button
						type="button"
						class="facet-toggle"
						aria-expanded={filtersOpen}
						onclick={() => (filtersOpen = !filtersOpen)}
						>Filters{chips.length ? ` (${chips.length})` : ''}<span
							class="chevron"
							class:chevron--open={filtersOpen}
							aria-hidden="true">›</span
						></button
					>
					<div class="facet-body" class:facet-body--open={filtersOpen}>
						<IndexFacets groups={facetGroups} />
					</div>
				</aside>
				<div
					class="results"
					aria-busy={loading}
					style:--row-lead="{columns.leadW}px"
					style:--row-aside="{columns.asideW}px"
				>
					{#if category === 'factions' && seats}
						<div class="hemi-card">
							<div class="hemi-svg-wrap">
								<Hemicycle data={seats} onSelect={(k) => onSelectItem('factions', k)} />
							</div>
						</div>
					{/if}

					<!-- How many, under which filters; a click on a filter takes it off. -->
					<div class="result-head">
						{#if resultTotal !== null}
							<p class="result-count">
								{formatCount(resultTotal)}<span class="result-noun"
									>{resultTotal === 1 ? noun1(category) : labelOf(category)}</span
								>
							</p>
						{/if}
						{#each chips as chip (chip.id)}
							<button type="button" class="chip" onclick={chip.onRemove}>
								{chip.label}<span class="chip-x" aria-hidden="true">×</span>
								<span class="visually-hidden">(verwijder)</span>
							</button>
						{/each}
						{#if chips.length > 1}
							<button type="button" class="chips-clear" onclick={clearFilters}
								>Wis alle filters</button
							>
						{/if}
					</div>

					<IndexToolbar
						query={qDraft ?? q}
						onQueryChange={typeQuery}
						searchPlaceholder={PLACEHOLDER[category]}
						searchLabel="Zoek in {labelOf(category)}"
						sortOptions={SORTS[category]}
						sort={sortDef.id}
						onSortChange={(v) => patchUrl({ sort: v || null })}
						{dir}
						onDirToggle={() => patchUrl({ dir: dir === 'asc' ? 'desc' : 'asc' })}
					/>

					{#if category === 'judgments' && judgmentYears.length > 1}
						{@const max = Math.max(...judgmentYears.map((y) => y.count))}
						<!-- The judgments per year under the filters; a bar filters on its year. -->
						<figure class="years">
							<div class="years-bars">
								{#each judgmentYears as { year, count } (year)}
									{@const on = dateFrom === `${year}-01-01` && dateTo === `${year}-12-31`}
									{@const inRange =
										(!dateFrom || `${year}-12-31` >= dateFrom) &&
										(!dateTo || `${year}-01-01` <= dateTo)}
									<button
										type="button"
										class="years-bar"
										class:years-bar--on={on}
										class:years-bar--out={!inRange}
										style:height="{Math.max(2, (count / max) * 100)}%"
										title="{year}: {formatCount(count)} uitspraken"
										aria-label="{year}: {formatCount(count)} uitspraken"
										aria-pressed={on}
										onclick={() =>
											patchUrl({
												from: on ? null : `${year}-01-01`,
												to: on ? null : `${year}-12-31`
											})}
									></button>
								{/each}
							</div>
							<figcaption class="years-axis">
								{#each judgmentYears as { year }, i (year)}
									<span
										>{i === 0 || i === judgmentYears.length - 1 || Number(year) % 10 === 0
											? year
											: ''}</span
									>
								{/each}
							</figcaption>
						</figure>
					{/if}

					{#if category === 'ministers' && shownCabinet}
						<p class="gov-head">
							<a href={hrefOf(`cabinets/${shownCabinet.key}`)}>{shownCabinet.name}</a>,
							{period(
								shownCabinet.from_date,
								shownCabinet.to_date
							)}{#if shownCabinet.prime_minister?.name}. Minister-president {shownCabinet
									.prime_minister.name}{/if}.
						</p>
					{/if}
					{#if category === 'cabinets' && cabinetSpan && sortDef.id === 'date'}
						{@const at = (y: number) => (y - cabinetSpan.from) * yearWidth}
						<!-- The cabinets in the time they governed, in three lanes so the names
						     fit; a cabinet opens its bewindspersonen. -->
						<div class="cab-strip">
							<div class="cab-tools">
								<span>Sleep of scroll opzij door de tijd</span>
								<button
									type="button"
									class="cab-zoom"
									onclick={() => zoomCabinets(-1)}
									disabled={yearWidth === YEAR_WIDTHS[0]}
									aria-label="Uitzoomen">−</button
								>
								<button
									type="button"
									class="cab-zoom"
									onclick={() => zoomCabinets(1)}
									disabled={yearWidth === YEAR_WIDTHS.at(-1)}
									aria-label="Inzoomen">+</button
								>
							</div>
							<div
								class="cab-scroll"
								bind:this={cabScroll}
								use:pannable
								role="region"
								aria-label="Kabinetten in de tijd"
							>
								<div class="cab-canvas" style:width="{at(cabinetSpan.to)}px">
									<div class="cab-lanes">
										{#each cabTicks as t (t)}
											<span class="cab-tick" style:left="{at(t)}px" aria-hidden="true"></span>
										{/each}
										{#each cabinetSpan.rows as c, i (c.key)}
											{@const from = at(cabinetSpan.year(c.from_date, false))}
											{@const width = at(cabinetSpan.year(c.to_date, true)) - from}
											<a
												class="cab"
												class:cab--now={!c.to_date}
												href={tabHref('ministers') + `&cabinet=${c.key}`}
												style:left="{from}px"
												style:top="{(i % 3) * 30}px"
												style:--w="{Math.max(width, 2)}px"
												title="{c.name}, {period(c.from_date, c.to_date)}"
												draggable="false"
											>
												<span class="cab-bar"></span>
												<span class="cab-name">{c.name.replace(/^kabinet-/, '')}</span>
											</a>
										{/each}
									</div>
									<div class="cab-axis" aria-hidden="true">
										{#each cabTicks as t (t)}
											<span style:left="{at(t)}px">{t}</span>
										{/each}
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- While the next result loads, the previous one stays, dimmed. -->
					{#if loading && !pages[category]}
						<p class="status-line">Laden…</p>
					{:else if error}
						<p class="status-line status-line--error">{error}</p>
					{:else}
						<div class="shown" class:shown--stale={loading}>
							{#if resultRows?.length}
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
							{/if}
							{#if category === 'instruments' && pages.instruments}
								{#if pages.instruments.items.length === 0}
									{@render empty('wetten')}
								{:else}
									<ul class="list">
										{#each pages.instruments.items as w (w.id)}
											{@const bron = `instruments/${w.key}`}
											<IndexRow
												{bron}
												title={w.citation_title ?? w.short_title ?? w.title ?? w.key}
												href={hrefOf(bron)}
												open={openId === bron}
												onToggle={() => toggleOpen(bron)}
											>
												{#snippet lead()}
													<span class="row-id-main"
														>{(w.bwb_id ?? w.celex ?? '').toUpperCase()}</span
													>
													{#if w.short_title && w.short_title !== w.title}
														<span class="row-id-sub">{w.short_title}</span>
													{/if}
												{/snippet}
												{#snippet body()}
													<span class="row-sub"
														>{w.article_count > 0
															? `${w.article_count} artikelen`
															: isPublication(w)
																? 'Publicatie in het Staatsblad; tekst niet in de dataset'
																: 'geen artikelen geïndexeerd'}</span
													>
												{/snippet}
												{#snippet aside()}
													<span class="tag tag--outline" class:tag--eu={w.jurisdiction === 'eu'}>
														{jurisdictionTag(w)}
													</span>
												{/snippet}
												{#snippet detail()}
													<IndexDetail category="instruments" record={w} {bron} />
												{/snippet}
											</IndexRow>
										{/each}
									</ul>
									{@render loadMoreButton(pages.instruments, 'wetten')}
								{/if}
							{:else if category === 'judgments' && pages.judgments}
								{#if pages.judgments.items.length === 0}
									{@render empty('uitspraken')}
								{:else}
									<ul class="list">
										{#each pages.judgments.items as j (j.id)}
											{@const bron = `judgments/${j.key}`}
											<IndexRow
												{bron}
												title={j.display_name ?? j.ecli ?? j.key}
												href={hrefOf(bron)}
												open={openId === bron}
												onToggle={() => toggleOpen(bron)}
											>
												{#snippet lead()}
													<span class="row-id-main">{fmtDateShort(j.date)}</span>
													{#if j.court}
														<span class="row-id-sub">{j.court}</span>
													{/if}
												{/snippet}
												{#snippet body()}
													{#if j.names?.length}
														<span class="row-names">{j.names.join(', ')}</span>
													{/if}
													{#if j.summary}
														<p class="row-summary">{j.summary}</p>
													{/if}
													{#if j.display_name && j.ecli}
														<span class="row-sub row-sub--mono">{j.ecli}</span>
													{/if}
												{/snippet}
												{#snippet aside()}
													{#if j.inbound_citation_count}
														<span class="num-strong"
															>{j.inbound_citation_count}<span class="num-lbl"
																>{j.inbound_citation_count === 1 ? 'citatie' : 'citaties'}</span
															></span
														>
													{/if}
												{/snippet}
												{#snippet detail()}
													<IndexDetail category="judgments" record={j} {bron} />
												{/snippet}
											</IndexRow>
										{/each}
									</ul>
									{@render loadMoreButton(pages.judgments, 'uitspraken')}
								{/if}
							{:else if category === 'dossiers' && dossierEntries}
								{#if dossierEntries.length === 0}
									{@render empty(
										dossierScope === 'open'
											? 'lopende dossiers'
											: dossierScope === 'closed'
												? 'afgehandelde dossiers'
												: 'dossiers'
									)}
								{:else}
									<ul class="list">
										{#each dossierEntries as entry (entry.number + entry.rows[0].id)}
											{#if entry.rows.length === 1}
												{@render dossierRow(entry.rows[0], false)}
											{:else}
												{@const isOpen = openNumbers.has(entry.number)}
												{@const own = entry.rows.find((d) => d.number === entry.number)}
												{@const tracks = new Set(entry.rows.map((d) => d.track))}
												{@const [track] = tracks}
												<!-- A filter or an unloaded page can leave out dossiers of the number. -->
												{@const all = (entry.rows[0].same_number_count ?? 0) + 1}
												<IndexRow
													title={own?.title ?? `Dossiers onder nummer ${entry.number}`}
													href={own ? hrefOf(`dossiers/${own.number}`) : undefined}
													open={isOpen}
													onToggle={() => toggleNumber(entry.number)}
												>
													{#snippet lead()}
														<span class="row-id-main">{entry.number}</span>
														{#if tracks.size === 1 && track}
															<span class="row-id-sub">{TRACK_LABEL[track]}</span>
														{/if}
													{/snippet}
													{#snippet body()}
														<span class="row-sub">
															Toevoegingen {entry.rows.flatMap((d) => d.suffix ?? []).join(', ')}
														</span>
													{/snippet}
													{#snippet aside()}
														<span class="num-strong"
															>{entry.rows.length}<span class="num-lbl"
																>{entry.rows.length < all
																	? `van ${all} dossiers`
																	: 'dossiers'}</span
															></span
														>
														<span class="chevron" class:chevron--open={isOpen} aria-hidden="true"
															>›</span
														>
													{/snippet}
												</IndexRow>
												{#if isOpen}
													{#each entry.rows as d (d.id)}
														{@render dossierRow(d, true)}
													{/each}
												{/if}
											{/if}
										{/each}
									</ul>
									{@render loadMoreButton(pages.dossiers, 'dossiers')}
								{/if}
							{:else if category === 'committees' && committeesShown}
								{#if committeesShown.length === 0}
									{@render empty('commissies')}
								{:else}
									<ul class="list">
										{#each committeesShown as c, i (c.id)}
											{@const bron = `committees/${c.key}`}
											{@const count = c.active_dossier_count ?? 0}
											<!-- Under the default sort, a divider where the committees without dossiers begin. -->
											{#if !onlyActive && sortDef.id === 'dossiers' && dir === 'desc' && count === 0 && i > 0 && (committeesShown[i - 1].active_dossier_count ?? 0) > 0}
												<li class="group-divider" aria-hidden="true">
													<span>Zonder lopende dossiers</span>
												</li>
											{/if}
											<IndexRow
												{bron}
												title={c.name ?? c.key}
												href={hrefOf(bron)}
												open={openId === bron}
												onToggle={() => toggleOpen(bron)}
											>
												{#snippet lead()}
													<span class="row-id-main">{c.abbreviation ?? ''}</span>
												{/snippet}
												{#snippet body()}
													<span class="row-sub">
														{count > 0
															? `${count === 1 ? 'lopend dossier' : 'lopende dossiers'}`
															: 'Geen lopende dossiers'}
													</span>
												{/snippet}
												{#snippet aside()}
													{#if count > 0}
														<span class="num-strong">{count}</span>
													{:else}
														<span class="tag tag--outline">—</span>
													{/if}
												{/snippet}
												{#snippet detail()}
													<IndexDetail category="committees" record={c} {bron} />
												{/snippet}
											</IndexRow>
										{/each}
									</ul>
								{/if}
							{:else if category === 'members' && membersShown}
								{#if membersShown.length === 0}
									{@render empty('kamerleden')}
								{:else}
									<ul class="list">
										{#each membersShown as m (m.id)}
											{@const bron = `members/${m.key}`}
											<IndexRow
												{bron}
												title={m.name ?? m.key}
												href={hrefOf(bron)}
												open={openId === bron}
												onToggle={() => toggleOpen(bron)}
											>
												{#snippet lead()}
													<span class="row-id-main row-id-main--inline">
														<span class="party-dot" style:background={partyColor(m.party ?? '')}
														></span>
														{m.party ?? ''}
													</span>
												{/snippet}
												{#snippet detail()}
													<IndexDetail category="members" record={m} {bron} />
												{/snippet}
											</IndexRow>
										{/each}
									</ul>
									{@render loadMoreButton(pages.members, 'kamerleden')}
								{/if}
							{:else if category === 'factions' && factionsShown}
								{#if factionsShown.length === 0}
									{@render empty('fracties')}
								{:else}
									<ul class="list">
										{#each factionsShown as f (f.id)}
											{@const bron = `factions/${f.key}`}
											<IndexRow
												{bron}
												title={f.name ?? f.key}
												href={hrefOf(bron)}
												open={openId === bron}
												onToggle={() => toggleOpen(bron)}
											>
												{#snippet lead()}
													<span class="row-id-main row-id-main--inline">
														<span
															class="party-dot"
															style:background={partyColor(f.abbreviation ?? '')}
														></span>
														{f.abbreviation ?? ''}
													</span>
												{/snippet}
												{#snippet body()}
													{#if f.seats != null && totalSeats > 0}
														<span class="row-sub"
															>{((f.seats / totalSeats) * 100).toLocaleString('nl-NL', {
																maximumFractionDigits: 1
															})}% van de zetels</span
														>
													{/if}
												{/snippet}
												{#snippet aside()}
													{#if f.seats != null}
														<span class="num-strong"
															>{f.seats}<span class="num-lbl"
																>{f.seats === 1 ? 'zetel' : 'zetels'}</span
															></span
														>
													{/if}
												{/snippet}
												{#snippet detail()}
													<IndexDetail category="factions" record={f} {bron} />
												{/snippet}
											</IndexRow>
										{/each}
									</ul>
								{/if}
							{:else if category === 'decisions' && decisionsShown}
								{#if decisionsShown.length === 0}
									{@render empty('stemmingen')}
								{:else}
									{#each decisionDays ?? [] as day (day.date)}
										{#if day.date}
											{@const failed = day.count - day.passed}
											<div class="day-head">
												<h3 class="day-title">{fmtDay(day.date)}</h3>
												<span class="day-meta"
													>{day.count}
													{day.count === 1 ? 'stemming' : 'stemmingen'} · {day.passed} aangenomen,
													{failed}
													verworpen</span
												>
												<span class="day-split" aria-hidden="true"
													><span style:width="{(day.passed / day.count) * 100}%"></span></span
												>
											</div>
										{/if}
										<ul class="list">
											{#each day.rows as s (s.id)}
												{@const bron = `decisions/${s.key}`}
												{@const inFavour = s.tally?.['Voor'] ?? 0}
												{@const against = s.tally?.['Tegen'] ?? 0}
												{@const inFavourPct = (inFavour / (inFavour + against)) * 100}
												<IndexRow
													{bron}
													title={s.subject ?? '—'}
													href={hrefOf(bron)}
													open={openId === bron}
													onToggle={() => toggleOpen(bron)}
												>
													{#snippet lead()}
														<span class="row-id-main"
															>{day.date
																? DECISION_KIND_LABEL[s.kind ?? 'overig']
																: fmtDateShort(s.date)}</span
														>
														{#if s.dossier_numbers?.[0]}
															<span class="row-id-sub">{s.dossier_numbers[0]}</span>
														{/if}
													{/snippet}
													{#snippet body()}
														{#if inFavour + against > 0}
															<span
																class="stem-mini"
																title="Zetelverdeling: {s.voters?.['Voor'] ?? 0} voor, {s.voters?.[
																	'Tegen'
																] ?? 0} tegen ({s.vote_kind === 'member' ? 'leden' : 'fracties'})"
															>
																<span class="stem-mini__v">{inFavour}</span>
																<span class="stem-mini__bar">
																	<span class="stem-mini__bar-v" style:width="{inFavourPct}%"
																	></span>
																	<span class="stem-mini__bar-t" style:width="{100 - inFavourPct}%"
																	></span>
																</span>
																<span class="stem-mini__t">{against}</span>
																<span class="stem-mini__unit">zetels</span>
															</span>
														{/if}
													{/snippet}
													{#snippet aside()}
														{#if s.passed != null}
															<span
																class="tag"
																class:tag--passed={s.passed}
																class:tag--rejected={!s.passed}
															>
																<span class="tag-dot" aria-hidden="true"></span>
																{s.passed ? 'Aangenomen' : 'Verworpen'}
															</span>
														{/if}
													{/snippet}
													{#snippet detail()}
														<IndexDetail category="decisions" record={s} {bron} />
													{/snippet}
												</IndexRow>
											{/each}
										</ul>
									{/each}
									{@render loadMoreButton(pages.decisions, 'stemmingen')}
								{/if}
							{:else if category === 'cabinets' && cabinetsShown}
								{#if cabinetsShown.length === 0}
									{@render empty('kabinetten')}
								{:else}
									<ul class="list">
										{#each cabinetsShown as c (c.key)}
											{@const bron = `cabinets/${c.key}`}
											{@const parties = c.parties ?? []}
											<IndexRow
												{bron}
												title={c.name}
												href={hrefOf(bron)}
												open={openId === bron}
												onToggle={() => toggleOpen(bron)}
											>
												{#snippet lead()}
													<span class="row-id-main">{period(c.from_date, c.to_date)}</span>
													{#if !c.to_date}
														<span class="row-id-sub">In functie</span>
													{/if}
												{/snippet}
												{#snippet body()}
													{#if c.prime_minister?.name}
														<span class="row-sub">Minister-president {c.prime_minister.name}</span>
													{/if}
													{#if parties.length}
														<span class="party-list">
															{#each parties as p, i (i)}
																<span class="party-item"
																	><span
																		class="party-dot"
																		style:background={partyColor(p.short ?? p.name ?? '')}
																	></span>{p.short ?? p.name}</span
																>
															{/each}
														</span>
													{/if}
												{/snippet}
												{#snippet aside()}
													<span class="num-strong"
														>{c.members}<span class="num-lbl">bewindspersonen</span></span
													>
												{/snippet}
												{#snippet detail()}
													<div class="gov-detail">
														<dl class="gov-stats">
															<div>
																<dt>Bewindspersonen</dt>
																<dd>{c.members}</dd>
															</div>
															<div>
																<dt>Wetsvoorstellen ingediend</dt>
																<dd>{c.bills}</dd>
															</div>
															<div>
																<dt>Toezeggingen</dt>
																<dd>{c.commitments}</dd>
															</div>
														</dl>
														<div class="gov-links">
															<a href={tabHref('ministers') + `&cabinet=${c.key}`}
																>Bewindspersonen</a
															>
															{#if c.commitments}
																<a href={tabHref('commitments') + `&cabinet=${c.key}`}
																	>Toezeggingen</a
																>
															{/if}
															<a href={bronHref(bron, { keepMode: false, mode: 'graph' })}
																>Bekijk in netwerk</a
															>
														</div>
													</div>
												{/snippet}
											</IndexRow>
										{/each}
									</ul>
								{/if}
							{:else if category === 'ministers' && ministerGroups}
								{#if !ministersShown?.length}
									{@render empty('bewindspersonen')}
								{:else}
									{#each ministerGroups as g, gi (gi)}
										{#if sortDef.id === 'protocol'}
											<div class="day-head">
												<h3 class="day-title">{g.name ?? 'Overige functies'}</h3>
												<span class="day-meta"
													>{g.rows.length}
													{g.rows.length === 1 ? 'bewindspersoon' : 'bewindspersonen'}</span
												>
											</div>
										{/if}
										<ul class="list">
											{#each g.rows as m, i (m.member.key + (m.post ?? '') + i)}
												{@const bron = `members/${m.member.key}`}
												{@const rowId = `${bron}#${m.ministry ?? 'x'}-${m.post ?? ''}`}
												<IndexRow
													bron={rowId}
													title={m.member.name ?? m.member.key}
													href={hrefOf(bron)}
													open={openId === rowId}
													onToggle={() => toggleOpen(rowId)}
												>
													{#snippet lead()}
														<span class="row-id-main"
															>{m.post ? POST_LABEL[m.post] : 'Functie'}</span
														>
														<span class="row-id-sub">{period(m.from_date, m.to_date)}</span>
													{/snippet}
													{#snippet body()}
														{#if m.function}
															<span class="row-sub">{m.function}</span>
														{/if}
													{/snippet}
													{#snippet aside()}
														{#if repeatPosts.has(m)}
															<span
																class="nums nums--repeat"
																title="Geteld bij de langste functie van deze persoon in dit kabinet"
															>
																<span>–</span><span>–</span><span>–</span>
															</span>
														{:else}
															<span class="nums">
																<span>{m.dossiers}</span>
																<span>{m.bills}</span>
																<span class:nums--hot={m.open_commitments > 0}
																	>{m.open_commitments}</span
																>
															</span>
														{/if}
													{/snippet}
													{#snippet detail()}
														<div class="gov-detail">
															<dl class="gov-stats">
																<div>
																	<dt>Dossiers ondertekend</dt>
																	<dd>{m.dossiers}</dd>
																</div>
																<div>
																	<dt>Waarvan wetsvoorstellen</dt>
																	<dd>{m.bills}</dd>
																</div>
																<div>
																	<dt>Open toezeggingen</dt>
																	<dd>{m.open_commitments}</dd>
																</div>
															</dl>
															<div class="gov-links">
																<a href={hrefOf(bron)}>Lezen</a>
																{#if m.open_commitments}
																	<a
																		href={tabHref('commitments') +
																			`&member=${m.member.key}&status=open`}>Open toezeggingen</a
																	>
																{/if}
																<a href={bronHref(bron, { keepMode: false, mode: 'graph' })}
																	>Bekijk in netwerk</a
																>
															</div>
														</div>
													{/snippet}
												</IndexRow>
											{/each}
										</ul>
									{/each}
								{/if}
							{:else if category === 'commitments' && pages.commitments}
								{#if pages.commitments.items.length === 0}
									{@render empty('toezeggingen')}
								{:else}
									<ul class="list">
										{#each pages.commitments.items as t (t.key)}
											{@const bron = `commitments/${t.key}`}
											{@const late =
												t.status === 'open' &&
												!!t.expected_resolution &&
												t.expected_resolution < new Date().toISOString().slice(0, 10)}
											<IndexRow
												{bron}
												title={t.text ?? 'Toezegging zonder tekst'}
												href={hrefOf(bron)}
												open={openId === bron}
												onToggle={() => toggleOpen(bron)}
											>
												{#snippet lead()}
													<span class="row-id-main">{fmtDateShort(t.date)}</span>
													{#if t.status}
														<span class="row-id-sub">{COMMITMENT_STATUS_LABEL[t.status]}</span>
													{/if}
												{/snippet}
												{#snippet body()}
													<span class="row-sub">
														{#if t.member}
															{t.member.name}{t.member.function ? `, ${t.member.function}` : ''}
														{:else if t.minister_name}
															{t.minister_name}
														{/if}
														{#if t.dossiers?.length}
															· {t.dossiers.map((d) => d.number).join(', ')}
														{/if}
													</span>
												{/snippet}
												{#snippet aside()}
													{#if t.expected_resolution}
														<span class="row-sub" class:row-sub--late={late}
															>{late ? 'Verlopen sinds' : 'Verwacht'}
															{fmtDateShort(t.expected_resolution)}</span
														>
													{/if}
												{/snippet}
												{#snippet detail()}
													<div class="gov-detail">
														<p class="gov-text">{t.text}</p>
														<div class="gov-links">
															{#if t.member}
																<a href={hrefOf(`members/${t.member.key}`)}>{t.member.name}</a>
															{/if}
															{#each t.dossiers ?? [] as d (d.key)}
																<a href={hrefOf(`dossiers/${d.number ?? d.key}`)}
																	>{d.number}{d.title ? `: ${d.title}` : ''}</a
																>
															{/each}
															{#if t.activity}
																<a href={hrefOf(`activities/${t.activity.key}`)}
																	>Gedaan in activiteit {t.activity.number ?? ''}</a
																>
															{/if}
														</div>
													</div>
												{/snippet}
											</IndexRow>
										{/each}
									</ul>
									{@render loadMoreButton(pages.commitments, 'toezeggingen')}
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

{#snippet dossierRow(d: DossierRow, member: boolean)}
	{@const bron = `dossiers/${d.number}`}
	<IndexRow
		{bron}
		{member}
		title={d.short_title ?? d.title ?? '—'}
		href={hrefOf(bron)}
		open={openId === bron}
		onToggle={() => toggleOpen(bron)}
	>
		{#snippet lead()}
			<span class="row-id-main">{d.number}</span>
			{#if d.track && !member}
				<span class="row-id-sub">{trackLabel(d.track)}</span>
			{/if}
		{/snippet}
		{#snippet body()}
			{@const who = d.initiative
				? 'Initiatief van Kamerleden'
				: d.ministry
					? ministryName(d.ministry)
					: ''}
			{#if who || d.opened_on}
				<span class="row-sub"
					>{who}{who && d.opened_on ? ' · ' : ''}{d.opened_on
						? `geopend ${fmtDateShort(d.opened_on)}`
						: ''}</span
				>
			{/if}
		{/snippet}
		{#snippet aside()}
			<span class="stage-aside">
				{#if d.current_stage && d.current_stage !== 'afgehandeld' && !d.outcome}
					{@const at = BILL_STAGES.indexOf(d.current_stage)}
					<span class="stage-bar" aria-hidden="true">
						{#each BILL_STAGES as s, i (s)}
							<span class:stage-bar--done={i < at} class:stage-bar--now={i === at}></span>
						{/each}
					</span>
				{/if}
				{#if dossierStatus(d)}
					<span class="row-sub">{dossierStatus(d)}</span>
				{/if}
			</span>
		{/snippet}
		{#snippet detail()}
			<IndexDetail category="dossiers" record={d} {bron} />
		{/snippet}
	</IndexRow>
{/snippet}

<!-- Nothing to show: with filters on, they say why; a text searched for can be searched
     for in all bronnen. -->
{#snippet empty(noun: string)}
	<div class="empty">
		<p>Geen {noun}{chips.length || q ? ' met deze filters' : ''}.</p>
		{#if category === 'dossiers' && dossierScope === 'open'}
			<button type="button" class="empty-act" onclick={() => patchUrl({ stand: 'all' })}
				>Zoek ook in afgehandelde dossiers</button
			>
		{/if}
		{#if q}
			<button type="button" class="empty-act" onclick={() => openSearch(q)}
				>Zoek "{q}" in alle bronnen</button
			>
		{/if}
	</div>
{/snippet}

{#snippet loadMoreButton(loaded: AnyPage | undefined, noun: string)}
	{#if loaded?.more}
		{@const remaining = loaded.total - loaded.items.length}
		<div class="load-more">
			{#if loadMoreFailed}
				<p class="load-more-error" role="alert">Meer {noun} laden is mislukt.</p>
			{/if}
			<button type="button" class="load-more-btn" onclick={loadMore} disabled={loadingMore}>
				{loadingMore
					? 'Laden…'
					: loadMoreFailed
						? 'Opnieuw'
						: `Meer ${noun} laden${remaining > 0 ? ` (${remaining.toLocaleString('nl-NL')} resterend)` : ''}`}
			</button>
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
		padding: 0 24px;
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
			#000 var(--fade-left),
			#000 calc(100% - var(--fade-right)),
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
		padding-top: 10px;
	}
	.catgroup + .catgroup {
		margin-left: 8px;
		padding-left: 8px;
		box-shadow: inset 1px 0 0 var(--rule);
	}
	.catgroup__label {
		padding: 0 10px;
		font-family: var(--font-sans);
		font-size: 10.5px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--ink-3);
	}
	.catgroup__tabs {
		display: flex;
	}
	.cat {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 10px 12px;
		text-decoration: none;
		border-bottom: 2px solid transparent;
		white-space: nowrap;
		color: var(--ink-3);
	}
	.cat-name {
		font-family: var(--font-serif);
		font-size: 16px;
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
		font-weight: 500;
	}

	/* What the category holds, in one sentence, above its list. */
	.page-about {
		margin: 0 0 var(--s-4);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
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
	/* The filters in a column beside the list; on a narrow screen above it. */
	.page {
		max-width: 1440px;
		margin: 0 auto;
		padding: 28px 32px 80px;
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		column-gap: 40px;
		align-items: start;
	}
	.page--wide {
		max-width: 1560px;
	}
	.facet-col {
		position: sticky;
		/* As far from the top as the page padding, so it does not jump when it sticks;
		   as high as the scrolling box, so its last filter can be reached. */
		top: 28px;
		max-height: calc(100cqh - 28px);
		overflow-y: auto;
		scrollbar-gutter: stable;
		/* Room for the focus ring: the column scrolls, so it clips what reaches its edge. */
		margin: 0 -6px;
		padding: 4px 6px 24px;
	}
	.results {
		min-width: 0;
	}
	.facet-toggle {
		display: none;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 44px;
		padding: 0;
		border: 0;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		background: transparent;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}

	/* The filters that are on, above the list; a click takes one off. */
	/* Uitspraken per year: a column per year, the chosen one in ink, the ones outside the
	   period pale. */
	.years {
		margin: 0 0 18px;
	}
	.years-bars {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 96px;
		border-bottom: 1px solid var(--rule-strong);
	}
	.years-bar {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: 0;
		background: var(--indigo);
		opacity: 0.55;
		cursor: pointer;
		transition: opacity var(--dur-1) var(--ease);
	}
	.years-bar:hover,
	.years-bar--on {
		opacity: 1;
	}
	.years-bar--out {
		background: var(--rule-strong);
		opacity: 1;
	}
	.years-bar:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.years-axis {
		display: flex;
		gap: 2px;
		margin-top: 4px;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
	}
	.years-axis span {
		flex: 1;
		min-width: 0;
		overflow: visible;
		white-space: nowrap;
	}

	/* Above the list: how many, then the filters that are on. */
	.result-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px 10px;
		margin: 0 0 12px;
	}
	.result-count {
		margin: 0 6px 0 0;
		font-family: var(--font-serif);
		font-size: 24px;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
		color: var(--ink);
	}
	.result-noun {
		margin-left: 8px;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}

	/* The heads of the columns, over the rows in the same grid. */
	.list-head {
		display: grid;
		grid-template-columns: var(--row-lead, 120px) minmax(0, 1fr) var(--row-aside, 190px);
		gap: 20px;
		padding: 0 8px 6px;
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-sans);
		font-size: 10.5px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-3);
	}
	.list-head__aside {
		text-align: right;
	}
	/* Numbers in columns of their own, right-aligned under their heads. */
	.nums {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		width: 100%;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.nums:not(.list-head .nums) {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.nums--hot {
		color: var(--accent);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 24px;
		padding: 3px 8px;
		border: 1px solid var(--ink);
		border-radius: var(--r-1);
		background: transparent;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink);
		cursor: pointer;
	}
	.chip:hover {
		background: var(--paper-2);
	}
	.chip-x {
		color: var(--ink-3);
	}
	.chips-clear {
		min-height: 24px;
		border: 0;
		background: transparent;
		padding: 3px 4px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
	}
	.chips-clear:hover {
		color: var(--accent);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* Kabinetten: each cabinet a bar on one line of years; the one in office in the accent. */
	.cab-strip {
		margin: 4px 0 22px;
	}
	.cab-tools {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		margin-bottom: 6px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.cab-tools span {
		margin-right: 8px;
	}
	.cab-zoom {
		width: 28px;
		height: 28px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: transparent;
		font-family: var(--font-sans);
		font-size: 15px;
		line-height: 1;
		color: var(--ink);
		cursor: pointer;
	}
	.cab-zoom:hover:not(:disabled) {
		background: var(--paper-2);
	}
	.cab-zoom:disabled {
		color: var(--ink-4, var(--rule-strong));
		cursor: default;
	}
	.cab-scroll {
		overflow-x: auto;
		overscroll-behavior-x: contain;
		cursor: grab;
		padding-bottom: 6px;
	}
	.cab-scroll:global(.is-dragging) {
		cursor: grabbing;
		user-select: none;
	}
	.cab-scroll:global(.is-dragging) .cab {
		pointer-events: none;
	}
	.cab-canvas {
		position: relative;
		min-width: 100%;
	}
	.cab-lanes {
		position: relative;
		height: 90px;
		border-bottom: 1px solid var(--rule-strong);
	}
	.cab-tick {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--rule);
	}
	.cab {
		position: absolute;
		display: flex;
		flex-direction: column;
		gap: 3px;
		/* The name may run under the next two cabinets, which lie in the other lanes. */
		width: calc(var(--w) * 3);
		text-decoration: none;
		color: var(--ink-2);
	}
	.cab-bar {
		display: block;
		width: calc(100% / 3 - 1px);
		min-width: 2px;
		height: 6px;
		background: var(--ink);
	}
	.cab-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-sans);
		font-size: 11.5px;
	}
	.cab--now .cab-bar {
		background: var(--accent);
	}
	.cab:hover .cab-bar,
	.cab:focus-visible .cab-bar {
		background: var(--accent);
	}
	.cab:hover .cab-name {
		color: var(--ink);
	}
	.cab-axis {
		position: relative;
		height: 16px;
		margin-top: 4px;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
	}
	.cab-axis span {
		position: absolute;
		transform: translateX(-50%);
	}
	.party-list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin-top: 6px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.party-item {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	/* The detail of a cabinet, post or commitment: three numbers and the ways on. */
	.gov-head {
		margin: 0 0 8px;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.gov-detail {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px 0 8px;
	}
	.gov-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 32px;
		margin: 0;
	}
	.gov-stats dt {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.gov-stats dd {
		margin: 2px 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-variant-numeric: tabular-nums;
	}
	.gov-text {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1.5;
		max-width: 68ch;
	}
	.gov-links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 20px;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.gov-links a {
		color: var(--ink);
		border-bottom: 1px solid var(--rule-strong);
		text-decoration: none;
	}
	.gov-links a:hover {
		color: var(--accent);
	}
	.row-sub--late {
		color: var(--accent);
	}

	/* Stemmingen: the sitting day over its votes, with the share that passed. */
	.day-head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		padding: 18px 8px 8px;
		border-bottom: 1px solid var(--rule-strong);
	}
	.day-head:first-of-type {
		padding-top: 4px;
	}
	.day-title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
	}
	.day-title::first-letter {
		text-transform: uppercase;
	}
	.day-meta {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.day-split {
		margin-left: auto;
		align-self: center;
		display: flex;
		width: 120px;
		height: 6px;
		background: var(--rule);
	}
	.day-split span {
		background: var(--ink);
	}

	/* ── Hemicycle card (factions only) ──────────────────────────────── */
	.hemi-card {
		margin-bottom: 28px;
		padding: 22px 28px;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
	}
	.hemi-svg-wrap :global(.hemicycle) {
		background: transparent;
	}

	/* ── Status and empty states ─────────────────────────────────────── */
	.status-line {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
		color: var(--ink-3);
		margin: 12px 0;
	}
	.status-line--error {
		color: var(--ink-2);
	}
	.empty {
		padding: 80px 40px;
		text-align: center;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 16px;
		color: var(--ink-3);
	}
	.empty p {
		margin: 0;
	}
	.empty-act {
		margin-top: 16px;
		min-height: 32px;
		padding: 0 14px;
		background: transparent;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-style: normal;
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
		cursor: pointer;
	}
	.empty-act:hover {
		background: var(--paper-2);
		color: var(--ink);
	}
	/* The previous result while the next one loads. */
	.shown--stale {
		opacity: 0.55;
		transition: opacity var(--dur-1) var(--ease);
	}

	/* ── List and row ────────────────────────────────────────────────── */
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.row-id-main {
		display: block;
	}
	.row-id-main--inline {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.row-id-sub {
		display: block;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		margin-top: 2px;
	}

	.row-sub {
		display: block;
		margin-top: 5px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.row-sub--mono {
		font-variant-numeric: tabular-nums;
	}
	/* The name lawyers give a judgment (Urgenda, Haviltex), under its title. */
	.row-names {
		display: block;
		margin-top: 2px;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
		color: var(--ink-2);
	}
	/* The inhoudsindicatie of a judgment, two lines at most. */
	.row-summary {
		margin: 4px 0 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		line-height: 1.45;
		color: var(--ink-2);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	/* A bill's stages as a bar: passed in ink, the current one in the accent. */
	.stage-aside {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}
	.stage-bar {
		display: flex;
		gap: 2px;
		width: 112px;
	}
	.stage-bar span {
		flex: 1;
		height: 5px;
		background: var(--rule);
	}
	.stage-bar span.stage-bar--done {
		background: var(--ink-2);
	}
	.stage-bar span.stage-bar--now {
		background: var(--accent);
	}

	/* Qualities on a row are words: the outcome of a vote in ink-2, the rest in ink-3. */
	.tag {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		white-space: nowrap;
		line-height: 22px;
	}
	.tag-dot {
		display: none;
	}
	.tag--passed,
	.tag--rejected {
		color: var(--ink-2);
		font-weight: 500;
	}

	.num-strong {
		font-family: var(--font-serif);
		font-size: 17px;
		color: var(--ink);
		font-feature-settings: 'lnum';
		line-height: 1;
	}
	.num-lbl {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		margin-left: 4px;
	}

	.party-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		vertical-align: middle;
	}

	/* Seats for and against on a decision row; the numbers say which is which. */
	.stem-mini {
		display: inline-grid;
		grid-template-columns: 32px 140px 32px auto;
		gap: 8px;
		align-items: center;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		margin-top: 6px;
	}
	.stem-mini__v {
		color: var(--ink-2);
		text-align: right;
		font-weight: 500;
	}
	.stem-mini__t {
		color: var(--ink-2);
		text-align: left;
		font-weight: 500;
	}
	.stem-mini__unit {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.stem-mini__bar {
		height: 8px;
		background: var(--paper-2);
		border-radius: var(--r-1);
		overflow: hidden;
		display: flex;
	}
	.stem-mini__bar-v {
		background: var(--ink-2);
	}
	.stem-mini__bar-t {
		background: var(--rule-strong);
	}

	.chevron {
		font-family: var(--font-sans);
		font-size: 16px;
		line-height: 1;
		color: var(--ink-3);
		transition: transform var(--dur-1) var(--ease);
	}
	.chevron--open {
		transform: rotate(90deg);
	}

	/* Committees: where the ones without dossiers begin */
	.group-divider {
		list-style: none;
		padding: 18px 8px 10px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		border-bottom: 1px solid var(--rule);
	}

	/* Load more */
	.load-more {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 24px 0 12px;
	}
	.load-more-error {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.load-more-btn {
		height: 32px;
		padding: 0 16px;
		background: transparent;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}
	.load-more-btn:hover:not(:disabled) {
		background: var(--paper-2);
		color: var(--ink);
	}
	.load-more-btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	/* Narrow viewports: the columns stack. */
	@media (max-width: 768px) {
		.catbar {
			padding: 0 16px;
		}
		.cat {
			padding: 8px 14px 10px;
		}
		.catgroup__label {
			padding: 0 14px;
		}
		.page {
			padding: 18px 16px 60px;
			grid-template-columns: minmax(0, 1fr);
		}
		.facet-col {
			position: static;
			max-height: none;
			margin-bottom: 16px;
			padding-bottom: 0;
		}
		.facet-toggle {
			display: flex;
		}
		.facet-body {
			display: none;
			padding-top: 12px;
		}
		.facet-body--open {
			display: block;
		}
		.stage-aside {
			align-items: flex-start;
		}
		/* The rows stack on a phone (IndexRow): the head keeps only the heads of the
		   number columns, over the numbers at full width. */
		.list-head {
			grid-template-columns: minmax(0, 1fr);
		}
		.list-head > span:not(.nums) {
			display: none;
		}
	}

	.nums--repeat {
		color: var(--ink-3);
	}
</style>
