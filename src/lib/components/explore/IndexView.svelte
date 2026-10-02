<script lang="ts">
	import { korteDatum, langeDatum, weekdag } from '$lib/text/datum';
	import { uniqueBy } from '$lib/util/unique';
	import NameLink from '$lib/bron/NameLink.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { isEscape } from '$lib/actions/keys';
	// Index: browse one category at a time. Beside the list a column of filters, each
	// option with the number of bronnen it holds under the other filters. A row's title
	// links to the bron; the rest of the row expands inline with its metadata and the
	// ways on to the bron (… lezen, In het netwerk).
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
	import {
		COURT_KINDS,
		COURT_KIND_LABEL,
		OLD_TIER,
		TIERS,
		TIER_LABEL,
		bronLabel,
		type CourtKind,
		type Tier
	} from '$lib/vocabulary';
	import { getCoverage, type Coverage } from '$lib/api/stats';
	import {
		NO_KIND_LABEL,
		PHASES,
		OUTCOME_LABEL,
		kindFromParam,
		phaseFromParam,
		type Outcome
	} from '$lib/components/parliamentary/stages';
	import {
		chapterTitle,
		groupByNumber,
		groupRuns
	} from '$lib/components/parliamentary/dossier-number';
	import { partyColor } from '$lib/utils/party-color.svelte';
	import { stand, datum } from '$lib/components/parliamentary/stand';
	import Hemicycle from './Hemicycle.svelte';
	import ZaalTegenover from './ZaalTegenover.svelte';
	import DossierOpen from '$lib/components/open/DossierOpen.svelte';
	import OpenRij from '$lib/components/open/OpenRij.svelte';
	import KabinetOpen from '$lib/components/open/KabinetOpen.svelte';
	import ZaalLegenda from './ZaalLegenda.svelte';
	import { kleurVan } from './partijkleuren.svelte';
	import IndexToolbar from './index/IndexToolbar.svelte';
	import IndexFacets, { activeFilters, type FacetGroup } from './index/IndexFacets.svelte';
	import {
		NO_DECISION_KIND,
		decisionKindFromParam,
		decisionMethod,
		decisionOutcome
	} from './index/decision-kind';
	import {
		CHAMBERS,
		CHAMBER_NAME,
		EK_SOURCE,
		chamberFromParam,
		type Chamber
	} from '$lib/components/parliamentary/chamber';
	import { formatLongDate } from './readers/_shared';
	import { kamerstukLabel } from '$lib/components/parliamentary/kamerstuk';
	import { judgmentCaseNumber, judgmentCourt, judgmentRowTitle } from './index/judgment-kind';
	import {
		COMMITMENT_STATUSES,
		OPEN_STATUS,
		statusFromParam,
		POSTS,
		POST_LABEL,
		currentCabinet,
		inOffice,
		getCabinets,
		getMinistries,
		period,
		type Cabinet,
		type Ministry
	} from './index/government';
	import { COURT_GROUPS, MIXED_TIERS } from './index/courts';
	import { pannable } from './index/pannable';
	import CabinetOccupancy from './index/CabinetOccupancy.svelte';
	import IndexDetail from './index/IndexDetail.svelte';
	import IndexRow from './index/IndexRow.svelte';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import { stemmingNaam } from '$lib/components/parliamentary/stemming';
	import {
		INDEX_CATEGORIES,
		INDEX_TABS,
		categoryLabel,
		collectionOf,
		type IndexCategory
	} from './index/categories';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { formatCount } from '$lib/verbonden/filter';

	let {
		category,
		onResultCountChange
	}: {
		category: IndexCategory;
		/** Reports what is shown and how many there are, for the status bar. */
		onResultCountChange?: (info: {
			filtered: number;
			total: number | null;
			category: IndexCategory;
		}) => void;
	} = $props();

	const oneOf = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined =>
		allowed.find((a) => a === value);

	// ── URL-driven filter state ─────────────────────────────────────────────
	const params = $derived(page.url.searchParams);
	const q = $derived(params.get('q') ?? '');
	// A dossier's phase and kind as the Kamer names them (API 0.52). A link from before names
	// them the old way (`?stage=mvt`, `?track=wetsvoorstel`): read as the Kamer's word, or left
	// out where the Kamer has none. The kind keeps the URL name `track`: `kind` is the tab.
	// One phase or several (API 0.75): the dossiers whose current phase is one of them.
	const phases = $derived(
		(params.get('phase') ?? params.get('stage') ?? '')
			.split(',')
			.flatMap((v) => phaseFromParam(v) ?? [])
	);
	// Phases a dossier must all have passed, comma-separated.
	const hasPhase = $derived(
		(params.get('has_phase') ?? params.get('has_stage') ?? '')
			.split(',')
			.flatMap((v) => phaseFromParam(v) ?? [])
			.join(',')
	);
	const track = $derived(kindFromParam(params.get('track') ?? '') ?? '');
	// A decision's kind as the Kamer writes it; an old link's `motie` is read as `Motie`.
	const decisionKindParam = $derived(decisionKindFromParam(params.get('soort') ?? '') ?? '');
	/** A kind of stuk, as the Kamer writes it (`Brief regering`). */
	const documentKind = $derived(params.get('soort') ?? '');
	// The Kamer whose parliament is listed; no filter but a choice, so it stays across tabs.
	const kamer = $derived<Chamber>(chamberFromParam(params.get('kamer')) ?? 'TK');
	/** The tabs that list one Kamer at a time. */
	const CHAMBER_CATEGORIES: readonly IndexCategory[] = [
		'decisions',
		'documents',
		'members',
		'factions',
		'committees'
	];
	/** The Eerste Kamer is known from our first read on: no history to show or filter by. */
	const ekComposition = $derived(
		kamer === 'EK' && category !== 'decisions' && category !== 'documents'
	);
	const ministry = $derived(params.get('ministry') ?? '');
	/** A ministry of the URL as the API types it; an unknown key is left to the API to refuse. */
	const asMinistry = (key: string) => (key || undefined) as Schema<'MinistryKey'> | undefined;
	const cabinetParam = $derived(params.get('cabinet') ?? '');
	const memberParam = $derived(params.get('member') ?? '');
	const post = $derived(oneOf(params.get('post'), POSTS));
	// A link from before API 0.48 names a state the old way (`open`): read as the Kamer's word.
	const commitmentStatus = $derived(
		oneOf(statusFromParam(params.get('status')), COMMITMENT_STATUSES)
	);
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
	const courtKind = $derived(oneOf(params.get('court_kind'), COURT_KINDS));
	// Rechtsgebied and procedure as rechtspraak.nl gives them (API 0.74, BE-44).
	const subject = $derived(params.get('subject') ?? '');
	// The main area of law (BE-57, API 0.75): `Bestuursrecht` holds `Bestuursrecht; Belastingrecht`.
	const subjectArea = $derived(params.get('subject_area') ?? '');
	const procedure = $derived(params.get('procedure') ?? '');
	const sort = $derived(params.get('sort'));
	const dirParam = $derived(oneOf(params.get('dir'), ['asc', 'desc'] as const));
	const onlyActive = $derived(params.get('only_active') === '1');
	// Members and factions are the sitting ones unless historical ones are asked for.
	const includeInactive = $derived(params.get('include_inactive') === '1');

	const FILTER_PARAMS = [
		'q',
		'phase',
		'has_phase',
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
		'court_kind',
		'subject',
		'subject_area',
		'procedure',
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

	// A link from before API 0.30 may name a tier that is now a court within a wider tier:
	// it opens that court. A tier the API does not know is left out, as the list would be.
	$effect(() => {
		const old = params.get('tier');
		if (!old || TIERS.includes(old as Tier)) return;
		const now = OLD_TIER[old];
		untrack(() => patchUrl({ tier: now?.tier ?? null, court_kind: now?.courtKind ?? null }, true));
	});

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
			// The day of its newest paper, activity or decision (API 0.75).
			{ id: 'last_activity', label: 'Laatste activiteit' },
			{ id: 'number', label: 'Kamerstuknummer' },
			{ id: 'closed_on', label: 'Afgehandeld (nieuw → oud)' },
			{ id: 'title', label: 'Titel' }
		],
		committees: [
			{ id: 'dossiers', label: 'Actieve dossiers', dir: 'desc' },
			{ id: 'abbreviation', label: 'Afkorting', dir: 'asc' },
			{ id: 'name', label: 'Naam', dir: 'asc' }
		],
		// By surname over all pages, as the API sorts it (BE-11): "Van der Lee" under L.
		members: [
			{ id: 'family_name', label: 'Achternaam' },
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
		// One order: the ministries in protocol order, as the chart draws them.
		ministers: [{ id: 'protocol', label: 'Ministerie' }],
		commitments: [
			{ id: 'date', label: 'Datum' },
			{ id: 'expected_resolution', label: 'Verwachte afdoening' }
		],
		// One order: newest first, as the API lists them.
		documents: [{ id: 'date', label: 'Datum' }]
	};
	// The Eerste Kamer's committees are not yet linked to dossiers: no sort or column by them.
	const noDossiers = $derived(ekComposition && category === 'committees');
	const sorts = $derived(
		noDossiers ? SORTS.committees.filter((o) => o.id !== 'dossiers') : SORTS[category]
	);
	const sortDef = $derived(sorts.find((s) => s.id === sort) ?? sorts[0]);
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
	/** `total` is null when the API gives none and more items may follow. */
	type Page<T> = { items: T[]; total: number | null; more: boolean };
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
		documents?: Page<Schema<'DocumentListItemDTO'>>;
	};
	/** One post in a cabinet, with the ministry it is under. */
	type MinisterRow = Schema<'CabinetPostDTO'> & {
		ministry: string | null;
		ministryName: string | null;
	};

	const PAGE = 100;
	// The sitting members of a Kamer in one slice: no Kamer has more than 150 seats, and
	// a list without `total` can then count them.
	const SEATED = 200;

	// A list without `total` (members) is over when a slice comes back short.
	/** An item's own id, or its key; null without either. */
	const idOf = (item: unknown): string | null => {
		const o = item as { id?: unknown; key?: unknown };
		return typeof o?.id === 'string' ? o.id : typeof o?.key === 'string' ? o.key : null;
	};

	function toPage<T>(
		previous: Page<T> | undefined,
		items: T[],
		offset: number,
		total?: number
	): Page<T> {
		// A page can repeat an item of the page before when the order has ties.
		const all = offset && previous ? uniqueBy([...previous.items, ...items], idOf) : items;
		const more = total === undefined ? items.length === PAGE : all.length < total;
		return { items: all, total: total ?? (more ? null : all.length), more };
	}

	let pages = $state<Pages>({});
	let seats = $state<Schema<'ParliamentSeatsResponse'> | null>(null);
	/** The sitting factions, to filter members by, with their seats. */
	let parties = $state<{ abbreviation: string; seats: number | null }[]>([]);
	// The counts per filter option the API gives with a list, under the other filters.
	let dossierFacets = $state<Schema<'DossierFacetsDTO'> | null>(null);
	let decisionFacets = $state<Schema<'DecisionFacets'> | null>(null);
	/** The kinds of stukken under the other filters, as the list's facet counts them. */
	let documentKinds = $state<Map<string, number>>(new Map());
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
					court_kind: courtKind,
					subject: subject || undefined,
					subject_area: subjectArea || undefined,
					procedure: procedure || undefined,
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
					// The source facet counts every source, whichever the list shows.
					if (!offset)
						echrTotal =
							query.q || query.from || query.to
								? (r.facets?.source?.find((f) => f.value === 'echr')?.count ?? 0)
								: null;
				};
			}
			case 'dossiers': {
				const query = {
					status: dossierScope,
					outcome,
					subject: q || undefined,
					phase: phases.length ? phases.join(',') : undefined,
					has_phase: hasPhase || undefined,
					kind: track || undefined,
					ministry: asMinistry(ministry),
					sort: oneOf(sortDef.id, [
						'number',
						'opened_on',
						'last_activity',
						'closed_on',
						'title'
					] as const),
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
			case 'committees': {
				const query = { chamber: kamer };
				return async (_offset, signal) => {
					const items = await unwrap(api.GET('/api/committees', { params: { query }, signal }));
					pages.committees = toPage(undefined, items, 0, items.length);
				};
			}
			case 'members': {
				const query = {
					chamber: kamer,
					q: q || undefined,
					party: party || undefined,
					active: includeInactive ? undefined : true,
					include_all: includeInactive,
					sort: oneOf(sortDef.id, ['family_name', 'name'] as const),
					limit: includeInactive ? limit : SEATED
				};
				return async (offset, signal) => {
					const items = await unwrap(
						api.GET('/api/members', { params: { query: { ...query, offset } }, signal })
					);
					pages.members = toPage(pages.members, items, offset);
				};
			}
			case 'factions': {
				const query = {
					chamber: kamer,
					q: q || undefined,
					active: includeInactive ? undefined : true
				};
				return async (_offset, signal) => {
					const items = await unwrap(api.GET('/api/factions', { params: { query }, signal }));
					pages.factions = toPage(undefined, items, 0, items.length);
				};
			}
			case 'decisions': {
				const query = {
					chamber: kamer,
					kind: decisionKindParam || undefined,
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
						m.seats.flatMap((seat) =>
							seat.posts.map((p) => ({
								...p,
								ministry: m.ministry ?? null,
								ministryName: m.name ?? null
							}))
						)
					);
					pages.ministers = toPage(undefined, rows, 0, rows.length);
				};
			}
			case 'documents': {
				// Always one Kamer: without a filter the list is slow on the full database.
				const query = {
					chamber: kamer,
					kind: documentKind || undefined,
					dossier: q || undefined,
					from: dateFrom || undefined,
					to: dateTo || undefined,
					limit
				};
				return async (offset, signal) => {
					const r = await unwrap(
						api.GET('/api/documents', { params: { query: { ...query, offset } }, signal })
					);
					pages.documents = toPage(pages.documents, r.items, offset, r.total ?? undefined);
					if (!offset) documentKinds = facetMap(r.facets?.kind);
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
					// The number in each state under the other filters, from the list's facet.
					if (!offset)
						statusCounts = new Map(
							(r.facets?.status ?? []).flatMap((f) =>
								f.value ? [[f.value, f.count] as const] : []
							)
						);
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
		if (category !== 'factions' || seats?.chamber === kamer) return;
		const ac = new AbortController();
		const chamber = kamer;
		unwrap(api.GET('/api/parliament/seats', { params: { query: { chamber } }, signal: ac.signal }))
			.then((r) => (seats = r))
			.catch(() => {});
		return () => ac.abort();
	});

	// The factions to filter members by, of the Kamer shown; the list is filtered by the API.
	let partiesOf = $state<Chamber | null>(null);
	$effect(() => {
		if (category !== 'members' || partiesOf === kamer) return;
		const ac = new AbortController();
		const chamber = kamer;
		unwrap(
			api.GET('/api/factions', { params: { query: { active: true, chamber } }, signal: ac.signal })
		)
			.then((r) => {
				parties = r
					.flatMap((f) =>
						f.abbreviation ? [{ abbreviation: f.abbreviation, seats: f.seats ?? null }] : []
					)
					.sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0));
				partiesOf = chamber;
			})
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

	const dossierKinds = $derived(facetMap(dossierFacets?.kind));
	const dossierPhases = $derived(facetMap(dossierFacets?.phase));
	const dossierMinistries = $derived(facetMap(dossierFacets?.ministry));

	const dossiersShown = $derived(pages.dossiers?.items);

	// The dossiers that share a number form one row that opens to them: all of them when
	// sorted by number, neighbouring ones under another sort (a budget's chapters).
	type DossierRow = Schema<'DossierSummaryDTO'>;
	const dossierEntries = $derived.by(() =>
		!dossiersShown
			? undefined
			: sortDef.id === 'number'
				? groupByNumber(dossiersShown)
				: groupRuns(dossiersShown)
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
		pages.members && sorted(pages.members.items, { party: (m) => m.party ?? '' })
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
				(!dateFrom || (c.to_date ?? (isOpen(c) ? '9999' : (c.from_date ?? ''))) >= dateFrom) &&
				(!dateTo || (c.from_date ?? '') <= dateTo) &&
				(!q ||
					includes(c.name) ||
					includes(c.prime_minister?.name) ||
					(c.parties ?? []).some((p) => includes(p.short)))
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
	const thisYear = new Date().getFullYear();
	/** A day as a year with its month as a fraction: 2024-07-02 is 2024.5. */
	const yearOf = (iso: string | null | undefined, end: boolean) =>
		iso ? Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12 : end ? thisYear + 1 : 0;
	/** The cabinet in office; an older one without an end has an end no source gives. */
	const isOpen = (c: Cabinet) => inOffice(c, cabinets);
	// A cabinet whose end is not known is drawn as a stub of a year, its end left open.
	const endYear = (c: Cabinet) =>
		c.to_date ? yearOf(c.to_date, true) : isOpen(c) ? thisYear + 1 : yearOf(c.from_date, false) + 1;
	const cabinetSpan = $derived.by(() => {
		const year = yearOf;
		const rows = [...(cabinetsShown ?? [])].sort((a, b) =>
			(a.from_date ?? '').localeCompare(b.from_date ?? '')
		);
		if (!rows.length) return null;
		const from = Math.floor(Math.min(...rows.map((c) => year(c.from_date, false))));
		const to = Math.ceil(Math.max(...rows.map((c) => endYear(c))));
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

	const ministerPostCounts = $derived(countBy(pages.ministers?.items, (m) => m.post ?? ''));
	const ministersShown = $derived(
		pages.ministers?.items.filter(
			(m) => (!post || m.post === post) && (!q || includes(m.member.name))
		)
	);
	/** The cabinet as the chart draws it: its seats with the posts the filters let through. */
	const occupancyCabinet = $derived.by(() => {
		if (!shownCabinet || (!post && !q)) return shownCabinet;
		const keep = (p: Schema<'CabinetPostDTO'>) =>
			(!post || p.post === post) && (!q || includes(p.member.name));
		return {
			...shownCabinet,
			ministries: (shownCabinet.ministries ?? [])
				.map((m) => ({
					...m,
					seats: m.seats
						.map((seat) => ({ ...seat, posts: seat.posts.filter(keep) }))
						.filter((seat) => seat.posts.length)
				}))
				.filter((m) => m.seats.length)
		};
	});

	// The Eerste Kamer's composition as read from its site: the day of the composition shown,
	// and the first read, before which nothing is known. Each row carries the same source.
	const composition = $derived.by(() => {
		if (!ekComposition) return null;
		const source =
			category === 'factions'
				? factionsShown?.[0]?.source
				: category === 'committees'
					? committeesShown?.[0]?.source
					: membersShown?.[0]?.ek?.source;
		return source ?? null;
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
		// Each group of courts is a filter group of its own, under its own heading, as every
		// other filter: no heading inside a list, and so no indent.
		return groups.flatMap((g): FacetGroup[] => {
			const tiers = g.tiers.filter(held);
			if (!tiers.length) return [];
			const count = courtCounts && tiers.reduce((n, t) => n + (courtCounts.get(t) ?? 0), 0);
			const options = tiers.flatMap((t) => {
				const ehrm = t === 'ehrm';
				const on = ehrm ? source === 'echr' : source !== 'echr' && !court && tier === t;
				return [
					{
						id: t,
						label: TIER_LABEL[t],
						count: courtCounts?.get(t),
						on,
						// One college or the EHRM at a time: the API takes one tier.
						onClick: () =>
							patchUrl({
								tier: on || ehrm ? null : t,
								court_kind: null,
								court: null,
								source: ehrm && !on ? 'echr' : null
							})
					},
					...(on && MIXED_TIERS.includes(t) ? kindOptions() : [])
				];
			});
			return [
				{
					id: `court-${g.label}`,
					label: g.label,
					note: count != null ? formatCount(count) : undefined,
					kind: 'list',
					options
				}
			];
		});
	});

	/** The courts within the chosen tier, from the list's facet; one at a time. */
	function kindOptions() {
		const counts = new Map<CourtKind, number>();
		for (const f of judgmentFacets?.court_kind ?? [])
			if (f.value && COURT_KINDS.includes(f.value as CourtKind))
				counts.set(f.value as CourtKind, f.count);
		if (courtKind && !counts.has(courtKind)) counts.set(courtKind, 0);
		return [...counts].map(([k, count]) => ({
			id: `kind-${k}`,
			label: COURT_KIND_LABEL[k],
			count,
			indent: true,
			on: courtKind === k,
			onClick: () => patchUrl({ court_kind: courtKind === k ? null : k })
		}));
	}

	/** The main area of a subject as rechtspraak.nl writes it: up to its first `;`. */
	const areaOf = (value: string) => value.split(';')[0].trim();

	/**
	 * Rechtsgebied as a tree: the main areas with their counts (facets.subject_area), and
	 * under the chosen one its sub-areas (facets.subjects, "Bestuursrecht; Belastingrecht"
	 * as "Belastingrecht"). A main area alone holds its sub-areas; a sub-area narrows it.
	 * A judgment of the main area without a sub-area has no option of its own.
	 */
	function areaFacet(): FacetGroup[] {
		const chosenArea = subjectArea || (subject ? areaOf(subject) : '');
		const areas = (judgmentFacets?.subject_area ?? []).flatMap((f) =>
			f.value ? [{ value: f.value, count: f.count }] : []
		);
		if (chosenArea && !areas.some((a) => a.value === chosenArea))
			areas.unshift({ value: chosenArea, count: 0 });
		const subs = (area: string) =>
			(judgmentFacets?.subjects ?? []).flatMap((f) =>
				f.value && f.value.includes(';') && areaOf(f.value) === area
					? [
							{
								id: f.value,
								label: f.value.slice(f.value.indexOf(';') + 1).trim(),
								count: f.count,
								indent: true as const,
								on: subject === f.value,
								onClick: () =>
									patchUrl({ subject: subject === f.value ? null : f.value, subject_area: area })
							}
						]
					: []
			);
		const options = areas.flatMap((a) => {
			const on = chosenArea === a.value;
			return [
				{
					id: `area-${a.value}`,
					label: a.value,
					count: a.count,
					// Chosen while one of its sub-areas narrows it; a click lets go of both.
					on,
					onClick: () => patchUrl({ subject_area: on ? null : a.value, subject: null })
				},
				...(on ? subs(a.value) : [])
			];
		});
		return options.length ? [{ id: 'subject', label: 'Rechtsgebied', kind: 'list', options }] : [];
	}

	/**
	 * A facet of the list as the source names its values (rechtsgebied, procedure), most
	 * judgments first; the API counts it without its own filter. A judgment without the
	 * value cannot be chosen by it and is left out. One value at a time.
	 */
	function sourceFacet(
		param: 'subject' | 'procedure',
		label: string,
		facet: { value?: string | null; count: number }[] | null | undefined,
		current: string
	): FacetGroup[] {
		const options = (facet ?? []).flatMap((f) =>
			f.value
				? [
						{
							id: f.value,
							label: f.value,
							count: f.count,
							on: current === f.value,
							onClick: () => toggleParam(param, current, f.value!)
						}
					]
				: []
		);
		if (current && !options.some((o) => o.on))
			options.unshift({
				id: current,
				label: current,
				count: 0,
				on: true,
				onClick: () => toggleParam(param, current, current)
			});
		// No counts yet, or an API without the facet: no group, rather than an empty heading.
		return options.length ? [{ id: param, label, kind: 'list', preview: 6, options }] : [];
	}

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
		commitments: 'Zoek in de tekst',
		documents: 'Zoek op Kamerstuknummer'
	};

	const labelOf = (c: IndexCategory) =>
		INDEX_CATEGORIES.find((cat) => cat.key === c)!.label.toLowerCase();
	const noun1 = (c: IndexCategory) =>
		c === 'ministers' ? 'bewindspersoon' : bronLabel(collectionOf(c)).toLowerCase();

	const toggle = (name: string, current: string | undefined, value: string) => () =>
		toggleParam(name, current, value);
	const flag = (name: string, on: boolean) => () => patchUrl({ [name]: on ? null : '1' });

	const facetGroupsAll = $derived.by<FacetGroup[]>(() => {
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
					// The groups of courts, each under its own heading; no heading Instantie above.
					...courtOptions,
					...areaFacet(),
					...sourceFacet('procedure', 'Procedure', judgmentFacets?.procedure, procedure),
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
				// The kinds are the ones the API counts, in its order, the chosen one always. A
				// dossier without a kind (letters and motions) cannot be chosen: it is counted.
				const kinds = [...dossierKinds.keys()].filter(
					(k) => k !== 'null' && ((dossierKinds.get(k) ?? 0) > 0 || k === track)
				);
				if (track && !kinds.includes(track)) kinds.push(track);
				const withoutKind = dossierKinds.get('null') ?? 0;
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
						note: withoutKind
							? `${formatCount(withoutKind)} ${NO_KIND_LABEL.toLowerCase()}, zonder soort`
							: undefined,
						kind: 'list',
						options: kinds.map((k) => ({
							id: k,
							label: k,
							count: dossierKinds.get(k) ?? 0,
							on: track === k,
							onClick: toggle('track', track, k)
						}))
					},
					{
						id: 'phase',
						label: 'Fase',
						note: `${formatCount(PHASES.reduce((n, p) => n + (dossierPhases.get(p) ?? 0), 0))} met fase`,
						kind: 'steps',
						ends: ['Voorstel', 'Eindtekst'],
						none: 'Alle fasen',
						options: PHASES.map((p) => ({
							id: p,
							label: p,
							count: dossierPhases.get(p) ?? 0,
							on: phases.includes(p),
							onClick: () => {
								const next = phases.includes(p) ? phases.filter((x) => x !== p) : [...phases, p];
								patchUrl({ phase: next.length ? next.join(',') : null, stage: null });
							}
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
			case 'decisions': {
				// The kinds the Kamer's decisions have, as the facet counts them; one without a zaak
				// cannot be chosen. The Eerste Kamer's decisions have none yet: no group then.
				const kinds = [...decisionKinds.keys()]
					.filter(
						(k) => k !== 'null' && ((decisionKinds.get(k) ?? 0) > 0 || k === decisionKindParam)
					)
					.map((k) => ({
						id: k,
						label: k,
						count: decisionKinds.get(k) ?? 0,
						on: decisionKindParam === k,
						onClick: toggle('soort', decisionKindParam, k)
					}));
				return [
					...(kinds.length || kamer === 'TK'
						? [{ id: 'soort', label: 'Soort', kind: 'list' as const, options: kinds }]
						: []),
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
			}
			case 'documents':
				return [
					{
						id: 'soort',
						label: 'Soort',
						kind: 'list',
						options: [...documentKinds]
							.filter(([k, n]) => k !== 'null' && (n > 0 || k === documentKind))
							.sort((a, b) => b[1] - a[1])
							.map(([k, n]) => ({
								id: k,
								label: k,
								count: n,
								on: documentKind === k,
								onClick: toggle('soort', documentKind, k)
							}))
					},
					{
						id: 'period',
						label: 'Datum',
						kind: 'range',
						unit: 'date',
						from: dateFrom,
						to: dateTo,
						onChange: (from, to) => patchUrl({ from: from || null, to: to || null })
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
					...(ekComposition
						? []
						: [
								{
									id: 'include_inactive',
									label: 'Weergave',
									kind: 'list' as const,
									options: [
										{
											id: 'hist',
											label: 'Ook historische leden',
											on: includeInactive,
											onClick: flag('include_inactive', includeInactive)
										}
									]
								}
							])
				];
			case 'factions':
				return ekComposition
					? []
					: [
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
				// The Eerste Kamer's committees are not yet linked to dossiers.
				return ekComposition
					? []
					: [
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
							.filter((c) => !isOpen(c))
							.map((c) => ({
								value: c.key,
								label: `${c.name}, ${period(c.from_date, c.to_date, false)}`
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
							label: st,
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
	const chips = $derived(activeFilters(facetGroupsAll));
	let filtersOpen = $state(false);

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
		if (isEscape(e) && openId) patchUrl({ open: null }, true);
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
				commitments: pages.commitments?.items,
				documents: pages.documents?.items
			})[category] as unknown[] | undefined
	);
	// How many there are under the filters: the API's total, or the rows filtered here.
	// Null while a list without a total has more to load: the rows loaded are not the count.
	const listTotal = (rows: unknown[]): number | null => {
		const page = pages[category];
		return page ? page.total : rows.length;
	};
	const resultTotal = $derived.by(() => {
		if (!resultRows) return null;
		const clientFiltered = ['committees', 'cabinets', 'ministers'].includes(category);
		return clientFiltered ? resultRows.length : listTotal(resultRows);
	});
	$effect(() => {
		const rows = resultRows;
		if (!rows) return;
		onResultCountChange?.({ filtered: rows.length, total: listTotal(rows), category });
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
			leadW: 140,
			asideW: 110
		},
		judgments: { lead: 'Datum', body: 'Uitspraak', aside: 'Aangehaald', leadW: 140, asideW: 110 },
		dossiers: { lead: 'Nummer', body: 'Titel', aside: 'Fase', leadW: 140, asideW: 150 },
		decisions: { lead: 'Soort', body: 'Onderwerp', aside: 'Uitslag', leadW: 140, asideW: 180 },
		members: { lead: 'Fractie', body: 'Naam', aside: '', leadW: 140, asideW: 60 },
		factions: { lead: 'Fractie', body: 'Naam', aside: 'Zetels', leadW: 140, asideW: 110 },
		committees: {
			lead: 'Afkorting',
			body: 'Commissie',
			aside: 'Lopende dossiers',
			leadW: 140,
			asideW: 130
		},
		cabinets: {
			lead: 'Periode',
			body: 'Kabinet',
			aside: 'Bewindspersonen',
			leadW: 140,
			asideW: 130
		},
		ministers: {
			lead: 'Functie',
			body: 'Bewindspersoon',
			aside: ['Dossiers', 'Wetsvoorstellen', 'Open toezeggingen'],
			leadW: 140,
			asideW: 300
		},
		commitments: { lead: 'Gedaan', body: 'Toezegging', aside: 'Verwacht', leadW: 140, asideW: 130 },
		documents: { lead: 'Kamerstuk', body: 'Stuk', aside: 'Datum', leadW: 140, asideW: 110 }
	};
	// The Kamer is a choice, not a filter: the first group of the filters, always one of the
	// two, and no chip above the list (chips come from facetGroupsAll).
	const kamerGroup = $derived<FacetGroup>({
		id: 'kamer',
		label: 'Kamer',
		kind: 'keuze',
		value: kamer,
		options: CHAMBERS.map((c) => ({ value: c, label: CHAMBER_NAME[c] })),
		onChange: (c) => patchUrl({ kamer: c === 'TK' ? null : c, open: null, party: null })
	});
	const facetGroups = $derived(
		CHAMBER_CATEGORIES.includes(category) ? [kamerGroup, ...facetGroupsAll] : facetGroupsAll
	);
	const columns = $derived(noDossiers ? { ...COLUMNS.committees, aside: '' } : COLUMNS[category]);

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

	const fmtDay = (iso: string) => weekdag(iso);

	const openSearch = useSearchOpener();

	const fmtDateShort = (iso: string | null | undefined) => korteDatum(iso) || null;
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
			<div class="page">
				<!-- The page names itself for a screen reader; the tabs above show it. -->
				<h1 class="sr-only">Bladeren: {categoryLabel(category)}</h1>
				<aside class="facet-col" aria-label="Filters">
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
						<IndexFacets groups={facetGroups} pending={!pages[category] && !error} />
					</div>
				</aside>
				<div
					class="results"
					aria-busy={loading}
					style:--row-lead="{columns.leadW}px"
					style:--row-aside="{columns.asideW}px"
				>
					{#if category === 'factions' && seats && seats.chamber === kamer}
						<div class="hemi-card">
							<div class="hemi-svg-wrap">
								{#if seats.chamber === 'EK'}
									<ZaalTegenover data={seats} />
								{:else}
									<Hemicycle
										data={seats}
										meubels
										colorOf={(f, i) =>
											kleurVan('TK', f.abbreviation ?? f.name ?? f.key, i, f.color ?? null)}
									/>
								{/if}
								<ZaalLegenda
									data={seats}
									kolommen={2}
									rijen={10}
									peil={seats.chamber === 'EK'
										? `Eerste Kamer, samenstelling op ${formatLongDate(composition?.composition_date ?? seats.as_of ?? null)}`
										: `Tweede Kamer, stand op ${formatLongDate(seats.as_of ?? null)}`}
									bron={seats.chamber === 'EK'
										? composition
											? {
													label: composition.attribution ?? 'eerstekamer.nl',
													href: composition.url ?? ''
												}
											: null
										: seats.seating_plan
											? {
													label: seats.seating_plan.title ?? 'Zetelverdeling',
													href: seats.seating_plan.page ?? seats.seating_plan.url ?? ''
												}
											: null}
									plaatsen={seats.chamber === 'EK'
										? ['Voorzitter', 'Griffie', 'Regering', 'Verslag en redactie']
										: [
												'Voorzitter',
												'Griffier',
												'Kabinet (vak-K)',
												'Verslag en redactie',
												'Spreekgestoelte'
											]}
								/>
							</div>
						</div>
					{/if}

					<!-- How many, under which filters; a click on a filter takes it off. -->
					<div class="result-head">
						{#if resultTotal !== null && category !== 'ministers'}
							<p class="result-count">
								{formatCount(resultTotal)}<span class="result-noun"
									>{resultTotal === 1 ? noun1(category) : labelOf(category)}</span
								>
							</p>
						{:else if category !== 'ministers'}
							<!-- The count's own height before it is known, so nothing below it moves. -->
							<p class="result-count" aria-hidden="true">&nbsp;</p>
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
						sortOptions={sorts.length > 1 ? sorts : []}
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

					{#if category === 'ministers' && shownCabinet && occupancyCabinet}
						<!-- One title line; the chart is the list: a block opens its details. -->
						<h2 class="gov-title">
							<a href={hrefOf(`cabinets/${shownCabinet.key}`)}>{shownCabinet.name}</a>
						</h2>
						<p class="gov-sub">
							{period(shownCabinet.from_date, shownCabinet.to_date, isOpen(shownCabinet))}
							{#if shownCabinet.prime_minister?.name}
								, minister-president <NameLink
									collection="members"
									name={shownCabinet.prime_minister.name}
									key={shownCabinet.prime_minister.key}
								/>
							{/if}
							, {shownCabinet.members}
							{shownCabinet.members === 1 ? 'bewindspersoon' : 'bewindspersonen'}
						</p>
						{#if !ministersShown?.length && !loading}
							{@render empty('bewindspersonen')}
						{:else}
							<CabinetOccupancy
								cabinet={occupancyCabinet}
								{openId}
								onToggle={toggleOpen}
								commitmentsHref={(key) =>
									tabHref('commitments') + `&member=${key}&status=${OPEN_STATUS}`}
							/>
						{/if}
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
											{@const width = at(endYear(c)) - from}
											<a
												class="cab"
												class:cab--now={isOpen(c)}
												class:cab--unknown={!c.to_date && !isOpen(c)}
												href={tabHref('cabinets') + `&open=cabinets/${c.key}`}
												style:left="{from}px"
												style:top="{(i % 3) * 30}px"
												style:--w="{Math.max(width, 2)}px"
												title="{c.name}, {period(c.from_date, c.to_date, isOpen(c))}"
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
						<!-- The shape of a list while it loads: rows where rows will stand. -->
						<p class="visually-hidden" role="status">Laden…</p>
						<ul class="list skelet" aria-hidden="true">
							{#each { length: 8 } as _, i (i)}
								<li class="skelet-rij"><span></span><span></span></li>
							{/each}
						</ul>
					{:else if error}
						<p class="status-line status-line--error">{error}</p>
					{:else}
						<div class="shown" class:shown--stale={loading}>
							{#if resultRows?.length && category !== 'ministers'}
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
												title={judgmentRowTitle(j)}
												href={hrefOf(bron)}
												open={openId === bron}
												onToggle={() => toggleOpen(bron)}
											>
												{#snippet lead()}
													<span class="row-id-main"><Waarde value={fmtDateShort(j.date)} /></span>
													<span class="row-id-sub"
														><Waarde value={judgmentCourt(j.display_name, j.court)} /></span
													>
												{/snippet}
												{#snippet body()}
													{#if j.summary}
														<p class="row-summary">{j.summary}</p>
													{/if}
													<!-- The case number and the rechtsgebied, as rechtspraak.nl lists them;
													     the ECLI is the title unless the case has a name. -->
													{@const zaak = judgmentCaseNumber(j.display_name)}
													{@const context = [
														j.names?.length ? j.ecli : null,
														zaak,
														j.subjects?.join('; ')
													].filter(Boolean)}
													{#if context.length}
														<span class="row-sub">{context.join(', ')}</span>
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
												{@const kinds = new Set(entry.rows.map((d) => d.kind))}
												{@const [kind] = kinds}
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
														{#if kinds.size === 1 && kind}
															<span class="row-id-sub">{kind}</span>
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
													<span class="row-id-main"><Waarde value={c.abbreviation} /></span>
												{/snippet}
												{#snippet body()}
													{#if c.chamber !== 'EK'}
														<span class="row-sub">
															{count > 0
																? `${count === 1 ? 'lopend dossier' : 'lopende dossiers'}`
																: 'Geen lopende dossiers'}
														</span>
													{/if}
												{/snippet}
												{#snippet aside()}
													{#if c.chamber === 'EK'}
														<!-- Not yet linked to dossiers: no count to give. -->
													{:else if count > 0}
														<span class="num-strong">{count}</span>
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
													<!-- An Eerste Kamer member's fractie is the one it sits in there. -->
													{@const ek = kamer === 'EK' ? m.ek : null}
													{@const abbreviation = ek ? ek.abbreviation : m.party}
													<span class="row-id-main row-id-main--inline">
														<span
															class="party-dot"
															style:background={partyColor(abbreviation ?? '')}
														></span>
														{#if ek?.faction && ek.abbreviation}<BronLink
																ref={{ collection: 'factions', key: ek.faction }}
																>{ek.abbreviation}</BronLink
															>{:else if m.party}<NameLink
																collection="factions"
																name={m.party}
															/>{/if}
													</span>
												{/snippet}
												{#snippet detail()}
													<IndexDetail category="members" record={m} {bron} chamber={kamer} />
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
													{day.count === 1 ? 'stemming' : 'stemmingen'}: {day.passed} aangenomen,
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
												<!-- The Eerste Kamer's decisions carry no kind yet: their dossier leads. -->
												{@const kindLabel =
													s.kind ?? (s.chamber === 'EK' ? null : NO_DECISION_KIND)}
												<IndexRow
													{bron}
													title={stemmingNaam(s.subject, s.dossier_numbers?.[0])}
													href={hrefOf(bron)}
													open={openId === bron}
													onToggle={() => toggleOpen(bron)}
												>
													{#snippet lead()}
														{#if !day.date || kindLabel}
															<span class="row-id-main"
																><Waarde
																	value={day.date ? kindLabel : fmtDateShort(s.date)}
																/></span
															>
															{#if s.dossier_numbers?.[0]}
																<span class="row-id-sub">{s.dossier_numbers[0]}</span>
															{/if}
														{:else if s.dossier_numbers?.[0]}
															<span class="row-id-main">{s.dossier_numbers[0]}</span>
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
														{:else if decisionMethod(s)}
															<span class="row-method">{decisionMethod(s)}</span>
														{/if}
													{/snippet}
													{#snippet aside()}
														{#if decisionOutcome(s)}
															<!-- A hamerstuk passes without a vote; a postponed one is no outcome. -->
															<span
																class="tag"
																class:tag--passed={s.passed === true}
																class:tag--rejected={s.passed === false}
															>
																<span class="tag-dot" aria-hidden="true"></span>
																{decisionOutcome(s)}
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
									{#if kamer === 'EK'}
										<p class="list-source">
											Bron: {EK_SOURCE.name},
											<a href={EK_SOURCE.url} rel="external">{EK_SOURCE.site}</a>.
										</p>
									{/if}
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
													<span class="row-id-main"
														>{period(c.from_date, c.to_date, isOpen(c))}</span
													>
													{#if isOpen(c)}
														<span class="row-id-sub">In functie</span>
													{/if}
												{/snippet}
												{#snippet body()}
													{#if c.prime_minister?.name}
														<span class="row-sub"
															>Minister-president <NameLink
																collection="members"
																name={c.prime_minister.name}
																key={c.prime_minister.key}
															/></span
														>
													{/if}
													{#if parties.length}
														<span class="party-list">
															{#each parties as p, i (i)}
																<span class="party-item"
																	><span
																		class="party-dot"
																		style:background={partyColor(p.short ?? '')}
																	></span><NameLink
																		collection="factions"
																		name={p.short ?? p.faction ?? ''}
																		key={p.faction}
																	/></span
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
													<KabinetOpen
														cabinetKey={c.key}
														naam={c.name}
														inFunctie={isOpen(c)}
														{bron}
														ministersHref={tabHref('ministers') + `&cabinet=${c.key}`}
													/>
												{/snippet}
											</IndexRow>
										{/each}
									</ul>
								{/if}
							{:else if category === 'documents' && pages.documents}
								{#if pages.documents.items.length === 0}
									{@render empty('stukken')}
								{:else}
									<ul class="list">
										{#each pages.documents.items as doc (doc.key)}
											{@const bron = `documents/${doc.key}`}
											{@const label = kamerstukLabel(doc)}
											<IndexRow
												{bron}
												title={doc.title ?? doc.kind ?? doc.key}
												href={hrefOf(bron)}
												open={openId === bron}
												onToggle={() => toggleOpen(bron)}
											>
												{#snippet lead()}
													<span class="row-id-main"><Waarde value={label} /></span>
												{/snippet}
												{#snippet body()}
													{#if doc.kind}<span class="row-sub">{doc.kind}</span>{/if}
												{/snippet}
												{#snippet aside()}
													{#if doc.date}<span class="row-sub">{fmtDateShort(doc.date)}</span>{/if}
												{/snippet}
												{#snippet detail()}
													<IndexDetail category="documents" record={doc} {bron} />
												{/snippet}
											</IndexRow>
										{/each}
									</ul>
									{@render loadMoreButton(pages.documents, 'stukken')}
								{/if}
							{:else if category === 'commitments' && pages.commitments}
								{#if pages.commitments.items.length === 0}
									{@render empty('toezeggingen')}
								{:else}
									<ul class="list">
										{#each pages.commitments.items as t (t.key)}
											{@const bron = `commitments/${t.key}`}
											{@const late =
												t.status === OPEN_STATUS &&
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
													<span class="row-id-main"><Waarde value={fmtDateShort(t.date)} /></span>
													{#if t.status}
														<span class="row-id-sub">{t.status}</span>
													{/if}
												{/snippet}
												{#snippet body()}
													<span class="row-sub">
														{#if t.member}
															<NameLink
																collection="members"
																name={t.member.name ?? ''}
																key={t.member.key}
															/>{t.member.function ? `, ${t.member.function}` : ''}
														{:else if t.minister_name}
															{t.minister_name}
														{/if}
														{#if t.dossiers?.length}
															, {t.dossiers.map((d) => d.number).join(', ')}
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
													<OpenRij
														zin={t.status
															? `${t.status}${t.expected_resolution ? `, verwacht ${langeDatum(t.expected_resolution)}` : ''}.`
															: null}
														links={[
															...(t.member
																? [
																		{
																			label: t.member.name ?? 'Bewindspersoon',
																			ref: `members/${t.member.key}`
																		}
																	]
																: []),
															...uniqueBy(t.dossiers ?? [], (d) => d.key).map((d) => ({
																label: `${d.number}${d.title ? `: ${d.title}` : ''}`,
																ref: `dossiers/${d.number ?? d.key}`
															})),
															...(t.activity
																? [
																		{
																			label:
																				`Gedaan in activiteit ${t.activity.number ?? ''}`.trim(),
																			ref: `activities/${t.activity.key}`
																		}
																	]
																: [])
														]}
														lezen={bronHref(bron, { keepMode: false, mode: 'read' })}
														lezenLabel="Toezegging lezen"
														netwerk={bronHref(bron, { keepMode: false, mode: 'graph' })}
													/>
												{/snippet}
											</IndexRow>
										{/each}
									</ul>
									{@render loadMoreButton(pages.commitments, 'toezeggingen')}
								{/if}
							{/if}
						</div>
					{/if}
					<!-- Where the list comes from, under it: the source and its date close the list. -->
					{#if composition && category !== 'factions' && !loading}
						<p class="list-source">
							Samenstelling op {formatLongDate(composition.composition_date ?? null)}, gegevens
							sinds {formatLongDate(composition.data_since ?? null)}. Bron:
							<a href={composition.url} rel="external">{composition.attribution}</a>.
						</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

{#snippet dossierRow(d: DossierRow, member: boolean)}
	{@const bron = `dossiers/${d.number}`}
	{@const st = stand(d)}
	{@const who = d.initiative
		? 'Initiatief van Kamerleden'
		: d.ministry
			? ministryName(d.ministry)
			: ''}
	<IndexRow
		{bron}
		{member}
		title={member && d.title ? chapterTitle(d.title) : (d.short_title ?? d.title ?? d.number)}
		href={hrefOf(bron)}
		open={openId === bron}
		onToggle={() => toggleOpen(bron)}
	>
		{#snippet lead()}
			<span class="row-id-main">{d.number}</span>
			{#if d.kind && !member}
				<span class="row-id-sub">{d.kind}</span>
			{/if}
		{/snippet}
		{#snippet body()}
			{#if st?.zin}
				<span class="row-zin">{st.zin}</span>
			{/if}
			<!-- Sorted by its last activity, that day; else the day it was opened. -->
			{@const laatst = sortDef.id === 'last_activity' ? d.last_activity : null}
			{@const dag = laatst ?? d.opened_on}
			<span class="row-sub"
				>{who}{who && dag ? ', ' : ''}{#if dag}{laatst ? 'laatste activiteit' : 'geopend'}
					{datum(dag)}{/if}</span
			>
		{/snippet}
		{#snippet aside()}
			{#if st}
				<span
					class="stand"
					aria-label="Stand: {st.bodies
						.map(
							(b) =>
								`${b.name} ${b.state === 'done' ? 'klaar' : b.state === 'now' ? 'nu' : b.state === 'none' ? 'niet' : b.state === 'unknown' ? 'niet in de gegevens' : 'nog niet'}`
						)
						.join(', ')}"
				>
					{#each st.bodies as b (b.short)}
						<span class="stand-body stand-body--{b.state}"
							><abbr title={b.name}>{b.short}</abbr></span
						>
					{/each}
				</span>
			{/if}
		{/snippet}
		{#snippet detail()}
			<DossierOpen {d} />
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
		{@const remaining = (loaded.total ?? 0) - loaded.items.length}
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
		padding-top: var(--s-3);
	}
	.catgroup + .catgroup {
		margin-left: var(--s-2);
		padding-left: var(--s-2);
		box-shadow: inset 1px 0 0 var(--rule);
	}
	.catgroup__label {
		padding: 0 var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-label);
		font-weight: 500;
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
		font-weight: 500;
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
	/* The filters in a column beside the list; on a narrow screen above it. */
	.page {
		max-width: 1440px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-8);
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		column-gap: 40px;
		align-items: start;
	}
	.facet-col {
		position: sticky;
		/* As far from the top as the page padding, so it does not jump when it sticks;
		   as high as the scrolling box, so its last filter can be reached. */
		top: var(--s-6);
		max-height: calc(100cqh - var(--s-6));
		overflow-y: auto;
		scrollbar-gutter: stable;
		/* Een smalle, stille schuifbalk die de aantallen niet raakt. */
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
		/* Room for the focus ring: the column scrolls, so it clips what reaches its edge. */
		margin: 0 calc(-1 * var(--s-2));
		padding: var(--s-1) var(--s-2) var(--s-5);
	}
	.results {
		min-width: 0;
	}
	.facet-toggle {
		display: none;
		align-items: center;
		gap: var(--s-2);
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
		margin: 0 0 var(--s-4);
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
		margin-top: var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.years-axis span {
		flex: 1;
		min-width: 0;
		overflow: visible;
		white-space: nowrap;
	}

	.row-method {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.list-source {
		margin: var(--s-4) 0 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	/* Above the list: how many, then the filters that are on. */
	.result-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2) var(--s-3);
		margin: 0 0 var(--s-3);
	}
	.result-count {
		margin: 0 var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		line-height: 1.1;
		color: var(--ink);
	}
	.result-noun {
		margin-left: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}

	/* The heads of the columns, over the rows in the same grid. */
	.list-head {
		display: grid;
		grid-template-columns: var(--row-lead, 120px) minmax(0, 1fr) var(--row-aside, 190px);
		gap: var(--s-5);
		padding: 0 var(--s-2) var(--s-1);
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-sans);
		font-size: var(--t-label);
		font-weight: 500;
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
	.nums:not(.list-head .nums) {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		min-height: 24px;
		padding: var(--s-1) var(--s-2);
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
		padding: var(--s-1);
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
		margin: var(--s-1) 0 var(--s-5);
	}
	.cab-tools {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--s-2);
		margin-bottom: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.cab-tools span {
		margin-right: var(--s-2);
	}
	.cab-zoom {
		width: 28px;
		height: 28px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: transparent;
		font-family: var(--font-sans);
		font-size: var(--t-body-2);
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
		padding-bottom: var(--s-1);
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
		gap: var(--s-1);
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
		font-size: var(--t-label);
	}
	/* An end no source gives: the bar fades out. */
	.cab--unknown .cab-bar {
		background: linear-gradient(to right, var(--ink) 40%, transparent);
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
		margin-top: var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.cab-axis span {
		position: absolute;
		transform: translateX(-50%);
	}
	.party-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		margin-top: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.party-item {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
	}

	/* Bewindspersonen: the cabinet as the title of its chart. */
	.gov-title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 500;
	}
	.gov-title a {
		color: var(--ink);
		text-decoration: none;
	}
	.gov-title a:hover {
		color: var(--accent);
	}
	.gov-sub {
		margin: var(--s-1) 0 var(--s-4);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.row-sub--late {
		color: var(--accent);
	}

	/* Stemmingen: the sitting day over its votes, with the share that passed. */
	.day-head {
		display: flex;
		align-items: baseline;
		gap: var(--s-3);
		padding: var(--s-4) var(--s-2) var(--s-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	.day-head:first-of-type {
		padding-top: var(--s-1);
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
	/* De zaal zonder kader of vlak. */
	/* The hall and its legend side by side, using the width of the list; under each other
	   where the list is narrow. */
	.hemi-card {
		margin-bottom: var(--s-6);
	}
	.hemi-svg-wrap {
		display: grid;
		grid-template-columns: 456px minmax(0, 1fr);
		column-gap: var(--s-7);
		align-items: center;
		justify-items: center;
	}
	.hemi-svg-wrap :global(.leg) {
		margin: 0;
		justify-self: stretch;
	}
	.hemi-svg-wrap :global(.hemicycle) {
		justify-self: stretch;
	}
	/* Both halls exactly as high, whatever their shape; the width follows. */
	.hemi-svg-wrap :global(.hemicycle svg),
	.hemi-svg-wrap :global(.zaal svg) {
		width: auto;
		max-width: 100%;
		height: 300px;
		max-height: none;
	}
	@media (max-width: 1100px) {
		.hemi-svg-wrap {
			grid-template-columns: minmax(0, 1fr);
			row-gap: var(--s-4);
		}
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
		margin: var(--s-3) 0;
	}
	.status-line--error {
		color: var(--ink-2);
	}
	.empty {
		padding: 80px 40px;
		text-align: center;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
		color: var(--ink-3);
	}
	.empty p {
		margin: 0;
	}
	.empty-act {
		margin-top: var(--s-4);
		min-height: 32px;
		padding: 0 var(--s-4);
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
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 2px solid var(--ink);
	}
	/* What identifies the row (a number, a date, a kind): small and grey; the title is
	   what is read. */
	.row-id-main {
		display: block;
	}
	.row-id-main--inline {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
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
		margin-top: var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The inhoudsindicatie of a judgment, two lines at most. */
	.row-summary {
		margin: var(--s-1) 0 0;
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
	.row-zin {
		display: block;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
		line-height: var(--lh-snug);
		margin-top: var(--s-1);
	}
	.stand {
		display: inline-grid;
		grid-template-columns: repeat(3, var(--s-7));
		gap: var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
	}
	.stand-body {
		padding-top: var(--s-1);
		border-top: 4px solid var(--rule);
		color: var(--ink-3);
		text-align: left;
	}
	.stand-body abbr {
		text-decoration: none;
	}
	.stand-body--done {
		border-top-color: var(--ink-2);
		color: var(--ink-2);
	}
	.stand-body--now {
		border-top-color: var(--ink);
		color: var(--ink);
		font-weight: 600;
	}
	.stand-body--none {
		border-top-style: dotted;
	}
	.stage-aside {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	/* Qualities on a row are words: the outcome of a vote in ink-2, the rest in ink-3. */
	.tag {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-1);
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
		font-size: var(--t-body);
		color: var(--ink);
		font-feature-settings: 'lnum';
		line-height: 1;
	}
	.num-lbl {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		margin-left: var(--s-1);
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
		gap: var(--s-2);
		align-items: center;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		margin-top: var(--s-2);
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
		font-size: var(--t-body-2);
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
		padding: var(--s-4) var(--s-2) var(--s-3);
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
		gap: var(--s-2);
		padding: var(--s-5) 0 var(--s-3);
	}
	.load-more-error {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.load-more-btn {
		height: 32px;
		padding: 0 var(--s-4);
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
			padding: 0 var(--s-4);
		}
		.cat {
			padding: var(--s-2) var(--s-4) var(--s-3);
		}
		.catgroup__label {
			padding: 0 var(--s-4);
		}
		.page {
			padding: var(--s-4) var(--s-4) 60px;
			grid-template-columns: minmax(0, 1fr);
		}
		.facet-col {
			position: static;
			max-height: none;
			margin-bottom: var(--s-4);
			padding-bottom: 0;
		}
		.facet-toggle {
			display: flex;
		}
		.facet-body {
			display: none;
			padding-top: var(--s-3);
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
</style>
