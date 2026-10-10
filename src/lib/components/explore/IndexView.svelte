<script lang="ts">
	import DossierNaam from '$lib/bron/DossierNaam.svelte';
	import { axisLabels } from './index/years-axis';
	import { korteDatum, weekdag } from '$lib/text/datum';
	import { uniqueBy } from '$lib/util/unique';
	import NameLink from '$lib/bron/NameLink.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { isEscape } from '$lib/actions/keys';
	import { rijen } from '$lib/actions/rijen';
	// Index: browse one category at a time. Beside the list a column of filters, each
	// option with the number of bronnen it holds under the other filters. A row says what
	// the bron is in its own lines; its title opens it, and at its end stand the ways on in
	// one click (Lezen, Netwerk; Openen for a bron read beside the network). No panel
	// opens beneath a row (Thijs, 10 Oct).
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
	import { getCabinet } from '$lib/api/records';
	import { besluiten, nogTeTellen, telling } from '$lib/api/decisions';
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
	import ZaalLegenda from './ZaalLegenda.svelte';
	import { kleurVan } from './partijkleuren.svelte';
	import Bepaalregel from '$lib/components/ui/Bepaalregel.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import IconKnop from '$lib/components/ui/IconKnop.svelte';
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
	import IndexRow from './index/IndexRow.svelte';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import { stemmingNaam } from '$lib/components/parliamentary/stemming';
	import { dossierLabel, dossierName } from '$lib/bron/dossier-naam';
	import {
		INDEX_CATEGORIES,
		INDEX_TABS,
		categoryLabel,
		collectionOf,
		type IndexCategory
	} from './index/categories';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { heeftParameter } from '$lib/api/heeft';
	import { formatCount } from '$lib/verbonden/filter';

	let { category }: { category: IndexCategory } = $props();

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
	// Which list routes take a period yet (the schema of this build).
	const PERIODE = {
		instruments: heeftParameter('/api/instruments', 'from', 'to'),
		commitments: heeftParameter('/api/commitments', 'from', 'to'),
		members: heeftParameter('/api/members', 'active_from', 'active_to'),
		factions: heeftParameter('/api/factions', 'active_from', 'active_to'),
		committees: heeftParameter('/api/committees', 'active_from', 'active_to')
	};
	const dateFrom = $derived(params.get('from') ?? '');
	/** Whether a list has a period chosen that its route takes. */
	const metPeriode = (k: keyof typeof PERIODE) => PERIODE[k] && !!(dateFrom || dateTo);
	const dateTo = $derived(params.get('to') ?? '');
	const dossierFilter = $derived(params.get('dossier') ?? '');
	const party = $derived(params.get('party') ?? '');
	const jurisdiction = $derived(oneOf(params.get('jurisdiction'), ['nl', 'eu'] as const));
	// A kind of wet as the source names it; the treaties for now (Thijs, 10 Oct: "ook
	// verdragen een plekje"): the BWBV and the Verdragenbank, kind `verdrag`.
	const instrumentSoort = $derived(oneOf(params.get('soort'), ['verdrag'] as const));
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
	// The registers of the BWB (TOOI): a legal area, main or specific, and a theme, by slug.
	const legalArea = $derived(params.get('legal_area') ?? '');
	const policyDomain = $derived(params.get('policy_domain') ?? '');
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
		'legal_area',
		'policy_domain',
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
			{ id: 'title', label: 'Citeertitel' },
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
		// Without a total (one still being counted), a full page says there is more; a list can
		// ask more than PAGE at a time (stemmingen: 200).
		const more = total === undefined ? items.length >= PAGE : all.length < total;
		return { items: all, total: total ?? (more ? null : all.length), more };
	}

	let pages = $state<Pages>({});
	let seats = $state<Schema<'ParliamentSeatsResponse'> | null>(null);
	// The cabinet in office on the day of the hall and its fracties (API 0.79.33): one line
	// to the cabinet, whose reader shows its seats (Thijs, 10 Oct: the coalition is the
	// cabinet's, not the Kamer's).
	const coalitieRegel = $derived.by(() => {
		const kabinet = seats?.cabinet;
		if (!seats || !kabinet?.key) return null;
		const fracties = [...seats.factions]
			.filter((f) => f.coalition === true)
			.sort((a, b) => b.seats - a.seats)
			.map((f) => f.abbreviation ?? f.name ?? f.key ?? '');
		return {
			naam: kabinet.name ?? kabinet.key,
			href: bronHref(`cabinets/${kabinet.key}`, { keepMode: false, mode: 'read' }),
			fracties
		};
	});
	/** The sitting factions, to filter members by, with their seats. */
	let parties = $state<{ abbreviation: string; seats: number | null }[]>([]);
	// The counts per filter option the API gives with a list, under the other filters.
	let dossierFacets = $state<Schema<'DossierFacetsDTO'> | null>(null);
	let decisionFacets = $state<Schema<'DecisionFacets'> | null>(null);
	/** The kinds of stukken under the other filters, as the list's facet counts them. */
	let documentKinds = $state<Map<string, number>>(new Map());
	let judgmentFacets = $state<Schema<'JudgmentFacets'> | null>(null);
	let instrumentFacets = $state<Schema<'InstrumentFacets'> | null>(null);
	/** The treaties under the filters chosen: asked apart, as the API counts no kinds yet. */
	let verdragTotaal = $state<number | null>(null);
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
					kind: instrumentSoort,
					article_count_min: withEmpty ? undefined : 1,
					legal_area: legalArea || undefined,
					policy_domain: policyDomain || undefined,
					...(PERIODE.instruments ? { from: dateFrom || undefined, to: dateTo || undefined } : {}),
					sort: oneOf(sortDef.id, ['title', 'article_count'] as const),
					limit
				};
				return async (offset, signal) => {
					const r = await unwrap(
						api.GET('/api/instruments', { params: { query: { ...query, offset } }, signal })
					);
					if (!offset) instrumentFacets = r.facets ?? null;
					pages.instruments = toPage(pages.instruments, r.items, offset, r.total);
					if (offset) return;
					// The count beside Verdragen: this list's own total where it is the treaties,
					// else one row asked under the same filters.
					if (instrumentSoort) verdragTotaal = r.total;
					else
						verdragTotaal = await unwrap(
							api.GET('/api/instruments', {
								params: { query: { ...query, kind: 'verdrag', limit: 1, offset: 0 } },
								signal
							})
						)
							.then((v) => v.total)
							.catch(() => null);
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
					// Only the first page asks for the facets (API 0.79.2); a further page, or
					// "meer laden", only for its rows and the total, which the API keeps.
					const r = await unwrap(
						api.GET('/api/judgments', {
							params: { query: { ...query, offset, facets: !offset } },
							signal
						})
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
					opened_from: dateFrom || undefined,
					opened_to: dateTo || undefined,
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
				const query = {
					chamber: kamer,
					...(PERIODE.committees
						? { active_from: dateFrom || undefined, active_to: dateTo || undefined }
						: {})
				};
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
					// With a period the period says who, not the seat of today.
					active: includeInactive || metPeriode('members') ? undefined : true,
					include_all: includeInactive || metPeriode('members'),
					...(PERIODE.members
						? { active_from: dateFrom || undefined, active_to: dateTo || undefined }
						: {}),
					sort: oneOf(sortDef.id, ['family_name', 'name'] as const),
					limit: includeInactive || metPeriode('members') ? limit : SEATED
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
					active: includeInactive || metPeriode('factions') ? undefined : true,
					...(PERIODE.factions
						? { active_from: dateFrom || undefined, active_to: dateTo || undefined }
						: {})
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
					// One q, as the API takes several since 0.79.30 (all of them must match).
					q: q ? [q] : undefined,
					dossier: dossierFilter || undefined,
					party: party || undefined,
					limit: 200
				};
				return async (offset, signal) => {
					const r = await besluiten({ ...query, offset }, signal);
					pages.decisions = toPage(pages.decisions, r.items, offset, r.total ?? undefined);
					if (offset) return;
					// The total and facets still being counted (API 0.79.41): the page stands, the
					// counts come from the same question asked once more.
					const t = await telling(r, { ...query, offset }, signal).catch(() => null);
					// Still counting after the last wait: the facets stay as they were, the total quiet.
					if (!t || !nogTeTellen(t)) decisionFacets = (t ?? r).facets ?? null;
					if (t && t.total !== null && pages.decisions)
						pages.decisions = {
							...pages.decisions,
							total: t.total,
							more: pages.decisions.items.length < t.total
						};
				};
			}
			case 'cabinets':
				return async () => {
					const items = await getCabinets();
					pages.cabinets = toPage(undefined, items, 0, items.length);
				};
			case 'ministers': {
				const key = cabinetParam;
				const [from, to] = [dateFrom, dateTo];
				return async (_offset, signal) => {
					const all = await getCabinets();
					const chosen = key || currentCabinet(all)?.key;
					if (!chosen) {
						pages.ministers = toPage(undefined, [], 0, 0);
						return;
					}
					const detail = await getCabinet(chosen);
					if (signal.aborted) return;
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
					// A post in the period: its own days meet it (a source value of the cabinet).
					const inPeriode = rows.filter(
						(p) =>
							(!from || !p.to_date || p.to_date >= from) &&
							(!to || !p.from_date || p.from_date <= to)
					);
					pages.ministers = toPage(undefined, inPeriode, 0, inPeriode.length);
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
					q: q || undefined,
					...(PERIODE.commitments ? { from: dateFrom || undefined, to: dateTo || undefined } : {})
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

	/** A main area with its specific areas, as a register gives them with their counts. */
	type Area = { id: string; label: string; count: number; narrower: Omit<Area, 'narrower'>[] };

	/**
	 * A choice the register does not hold (an old link, a value with no bronnen under the
	 * other filters) stays in the list with 0, so it can be seen and let go of.
	 */
	const keepChosen = (areas: Area[], key: string) => {
		if (!areas.some((a) => a.id === key || a.narrower.some((n) => n.id === key)))
			areas.unshift({ id: key, label: key, count: 0, narrower: [] });
	};

	/**
	 * Rechtsgebied as a tree: the main areas with their counts, and under the chosen one its
	 * specific areas, indented. A main area alone holds its specific areas; a specific area
	 * narrows it. Both registers give the tree themselves (`narrower`): the Rechtspraak for
	 * judgments, the TOOI thesaurus of the BWB for laws.
	 */
	function areaTree(
		areas: Area[],
		chosenMain: string,
		chosenSub: string,
		choose: (main: string | null, sub: string | null) => void,
		/** A long register (the 27 of the BWB) shows this many main areas, then Alle N. */
		preview?: number
	): FacetGroup[] {
		const options = areas.flatMap((a) => {
			const on = chosenMain === a.id;
			return [
				{
					id: `area-${a.id}`,
					label: a.label,
					count: a.count,
					// Chosen while one of its specific areas narrows it; a click lets go of both.
					on,
					onClick: () => choose(on ? null : a.id, null)
				},
				...(on
					? a.narrower.map((n) => ({
							id: n.id,
							label: n.label,
							count: n.count,
							indent: true as const,
							on: chosenSub === n.id,
							onClick: () => choose(a.id, chosenSub === n.id ? null : n.id)
						}))
					: [])
			];
		});
		return options.length
			? [{ id: 'area', label: 'Rechtsgebied', kind: 'list', preview, options }]
			: [];
	}

	/** The Rechtspraak's rechtsgebieden: `subject_area` the main area, `subject` the source value. */
	function judgmentAreas(): FacetGroup[] {
		const areas: Area[] = (judgmentFacets?.subject_area ?? []).flatMap((f) =>
			f.value
				? [
						{
							id: f.value,
							label: f.value,
							count: f.count,
							narrower: (f.narrower ?? []).flatMap((n) =>
								n.value ? [{ id: n.value, label: n.label ?? n.value, count: n.count }] : []
							)
						}
					]
				: []
		);
		const main =
			subjectArea || areas.find((a) => a.narrower.some((n) => n.id === subject))?.id || '';
		if (main) keepChosen(areas, main);
		return areaTree(areas, main, subject, (m, sub) => patchUrl({ subject_area: m, subject: sub }));
	}

	type Concept = { id?: string | null; slug?: string | null };
	/** A TOOI concept in the URL: its slug, else its id. */
	const conceptKey = (c: Concept | undefined) => c?.slug ?? c?.id ?? '';
	/** Every concept of a register by slug and by id, so a link with either finds it. */
	const byKey = <T extends Concept>(concepts: T[]) =>
		new Map(concepts.flatMap((c) => [c.slug, c.id].flatMap((k) => (k ? [[k, c] as const] : []))));
	const legalConcepts = $derived(
		byKey((instrumentFacets?.legal_area ?? []).flatMap((f) => [f, ...(f.narrower ?? [])]))
	);
	const themeConcepts = $derived(byKey(instrumentFacets?.policy_domain ?? []));

	/**
	 * The BWB's rechtsgebieden (TOOI) for laws. One parameter holds the main or the specific
	 * area, by slug; a link with the TOOI id finds it too.
	 */
	function lawAreas(): FacetGroup[] {
		const areas: Area[] = (instrumentFacets?.legal_area ?? []).flatMap((f) =>
			conceptKey(f)
				? [
						{
							id: conceptKey(f),
							label: f.label,
							count: f.count,
							narrower: (f.narrower ?? []).flatMap((n) =>
								conceptKey(n) ? [{ id: conceptKey(n), label: n.label, count: n.count }] : []
							)
						}
					]
				: []
		);
		if (legalArea && !legalConcepts.has(legalArea)) keepChosen(areas, legalArea);
		const chosen = (key: string) =>
			legalArea !== '' && key === (conceptKey(legalConcepts.get(legalArea)) || legalArea);
		const main = areas.find((a) => chosen(a.id) || a.narrower.some((n) => chosen(n.id)));
		const sub = main?.narrower.find((n) => chosen(n.id));
		return areaTree(
			areas,
			main?.id ?? '',
			sub?.id ?? '',
			(m, s) => patchUrl({ legal_area: s ?? m }),
			8
		);
	}

	/** The government themes of the BWB (TOOI), one at a time. */
	function lawThemes(): FacetGroup[] {
		const chosen = conceptKey(themeConcepts.get(policyDomain)) || policyDomain;
		const themes = [...(instrumentFacets?.policy_domain ?? [])];
		if (policyDomain && !themeConcepts.has(policyDomain))
			themes.unshift({ slug: policyDomain, label: policyDomain, count: 0 });
		const options = themes.flatMap((f) => {
			const value = conceptKey(f);
			if (!value) return [];
			const on = value === chosen;
			return [
				{
					id: value,
					label: f.label,
					count: f.count,
					on,
					onClick: () => patchUrl({ policy_domain: on ? null : value })
				}
			];
		});
		return options.length
			? [{ id: 'theme', label: 'Thema', kind: 'list', preview: 6, options }]
			: [];
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

	/** The width of the year axis, for the labels that fit (`axisLabels`). */
	let yearsAxisWidth = $state(0);
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

	const facetGroupsBasis = $derived.by<FacetGroup[]>(() => {
		switch (category) {
			case 'instruments':
				return [
					...lawAreas(),
					...lawThemes(),
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
						id: 'soort',
						label: 'Soort',
						kind: 'list',
						options: [
							{
								id: 'verdrag',
								label: 'Verdragen',
								count: verdragTotaal ?? undefined,
								on: instrumentSoort === 'verdrag',
								onClick: toggle('soort', instrumentSoort, 'verdrag')
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
					...judgmentAreas(),
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
					},
					// When the dossier was opened (`opened_from`/`opened_to`), as every list with
					// dates has its period (Thijs, 9 Oct).
					{
						id: 'period',
						label: 'Geopend',
						kind: 'range',
						unit: 'date',
						from: dateFrom,
						to: dateTo,
						onChange: (from, to) => patchUrl({ from: from || null, to: to || null })
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
	// The period of a list whose route takes one only once the API has it (Back-end #2,
	// 0.79.30+; $lib/api/heeft), and of the bewindspersonen, whose posts carry their own days.
	const PERIODE_LABEL: Partial<Record<string, string>> = {
		instruments: PERIODE.instruments ? 'In werking getreden' : undefined,
		commitments: PERIODE.commitments ? 'Gedaan' : undefined,
		members: PERIODE.members ? 'Actief' : undefined,
		factions: PERIODE.factions ? 'Actief' : undefined,
		committees: PERIODE.committees ? 'Actief' : undefined,
		ministers: 'In functie'
	};
	const facetGroupsAll = $derived.by<FacetGroup[]>(() => {
		const label = PERIODE_LABEL[category];
		return label
			? [
					...facetGroupsBasis,
					{
						id: 'period',
						label,
						kind: 'range',
						unit: 'date',
						from: dateFrom,
						to: dateTo,
						onChange: (from: string, to: string) => patchUrl({ from: from || null, to: to || null })
					}
				]
			: facetGroupsBasis;
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

	// ── Result count above the list ──────────────────
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
	/** Another Kamer: its own list, without the filters that belonged to the other. */
	const kiesKamer = (c: Chamber) =>
		patchUrl({ kamer: c === 'TK' ? null : c, open: null, party: null });
	// Kamer stands in the choose-line (Bepaalregel), with the search and the period.
	const facetGroups = $derived(facetGroupsAll);
	// The period stands in the choose-line, the other groups in the facet column.
	const periode = $derived(
		facetGroups.find((g): g is Extract<FacetGroup, { kind: 'range' }> => g.kind === 'range') ?? null
	);
	const facetten = $derived(facetGroups.filter((g) => g.kind !== 'range'));
	const columns = $derived(noDossiers ? { ...COLUMNS.committees, aside: '' } : COLUMNS[category]);

	// ── Opening a source ────────────────────────────────────────────────────
	// The title of a row opens the bron as Lezen in the detail does: a text of its own at
	// full width, the rest beside the network.
	// A row opens its bron in the network (Thijs, 10 Oct: "laten we standaard navigeren naar
	// Netwerk"); Lezen at the end of the row is the way to the text.
	const hrefOf = (bron: string) => bronHref(bron, { keepMode: false, mode: 'graph' });

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
	/** The numbered places of each hall, as the Kamers' own plans name them. */
	const PLAATSEN_EK = ['Voorzitter', 'Griffie', 'Regering', 'Verslag en redactie'];
	const PLAATSEN_TK = [
		'Voorzitter',
		'Griffier',
		'Kabinet (vak-K)',
		'Verslag en redactie',
		'Spreekgestoelte',
		'Interruptiemicrofoons',
		'Bodedienst'
	];

	const openSearch = useSearchOpener();

	const fmtDateShort = (iso: string | null | undefined) => korteDatum(iso) || null;
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
							placeholder: PLACEHOLDER[category],
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
						kamer={CHAMBER_CATEGORIES.includes(category)
							? {
									waarde: kamer,
									opties: CHAMBERS.map((c) => ({ waarde: c, label: CHAMBER_NAME[c] })),
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
						<IndexFacets groups={facetten} pending={!pages[category] && !error} />
						{#if chips.length}
							<p class="wis"><TekstLink onclick={clearFilters}>Wis alle filters</TekstLink></p>
						{/if}
					</div>
				</aside>
				<div
					class="results"
					use:rijen={'a.row-title'}
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
											kleurVan('TK', f.abbreviation ?? f.name ?? f.key ?? '', i, f.color ?? null)}
									/>
								{/if}
								<ZaalLegenda
									data={seats}
									kolommen={2}
									rijen={10}
									coalitie={coalitieRegel}
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
									plaatsen={seats.chamber === 'EK' ? PLAATSEN_EK : PLAATSEN_TK}
									ruimte={seats.chamber === 'EK' ? PLAATSEN_TK : PLAATSEN_EK}
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
							<figcaption class="years-axis" bind:clientWidth={yearsAxisWidth}>
								{#each axisLabels( judgmentYears.map((y) => y.year), yearsAxisWidth ) as label, i (judgmentYears[i].year)}
									<span>{label}</span>
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
								data-zijscroll
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
												acties
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
																? 'Publicatie in het Staatsblad; tekst niet in de gegevens'
																: 'geen artikelen in de gegevens'}</span
													>
												{/snippet}
												{#snippet aside()}
													<span class="tag tag--outline" class:tag--eu={w.jurisdiction === 'eu'}>
														{jurisdictionTag(w)}
													</span>
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
											<IndexRow {bron} title={judgmentRowTitle(j)} href={hrefOf(bron)} acties>
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
											<IndexRow {bron} title={c.name ?? c.key} href={hrefOf(bron)} acties>
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
											<IndexRow {bron} title={m.name ?? m.key} href={hrefOf(bron)} acties>
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
											<IndexRow {bron} title={f.name ?? f.key} href={hrefOf(bron)} acties>
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
													{#if (f.seats != null && totalSeats > 0) || f.member_count}
														<span class="row-sub"
															>{[
																f.seats != null && totalSeats > 0
																	? `${((f.seats / totalSeats) * 100).toLocaleString('nl-NL', {
																			maximumFractionDigits: 1
																		})}% van de zetels`
																	: null,
																f.member_count
																	? `${f.member_count} ${f.member_count === 1 ? 'lid' : 'leden'}`
																	: null
															]
																.filter(Boolean)
																.join(', ')}</span
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
													title={stemmingNaam(s.subject, s.dossiers?.[0] ?? s.dossier_numbers?.[0])}
													href={hrefOf(bron)}
													acties
												>
													{#snippet lead()}
														{#if !day.date || kindLabel}
															<span class="row-id-main"
																><Waarde
																	value={day.date ? kindLabel : fmtDateShort(s.date)}
																/></span
															>
															{#if s.dossiers?.[0] ?? s.dossier_numbers?.[0]}
																{@const d = s.dossiers?.[0] ?? { number: s.dossier_numbers![0] }}
																<span class="row-id-sub row-id-naam" title={d.title ?? undefined}
																	>{dossierLabel(d)}</span
																>
															{/if}
														{:else if s.dossiers?.[0] ?? s.dossier_numbers?.[0]}
															{@const d = s.dossiers?.[0] ?? { number: s.dossier_numbers![0] }}
															<span class="row-id-main">{d.number}</span>
															{#if dossierName(d) !== d.number}
																<span class="row-id-sub row-id-naam" title={d.title ?? undefined}
																	>{dossierName(d)}</span
																>
															{/if}
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
											<IndexRow {bron} title={c.name} href={hrefOf(bron)} acties="titel">
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
												acties
											>
												{#snippet lead()}
													<span class="row-id-main"><Waarde value={label} /></span>
													<!-- The dossier by name under its number (API 0.79.30). -->
													{#if doc.dossiers?.[0] && dossierName(doc.dossiers[0]) !== doc.dossiers[0].number}
														<span
															class="row-id-sub row-id-naam"
															title={doc.dossiers[0].title ?? undefined}
															>{dossierName(doc.dossiers[0])}</span
														>
													{/if}
												{/snippet}
												{#snippet body()}
													{#if doc.kind}<span class="row-sub">{doc.kind}</span>{/if}
												{/snippet}
												{#snippet aside()}
													{#if doc.date}<span class="row-sub">{fmtDateShort(doc.date)}</span>{/if}
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
												acties
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
														{/if}<!-- A dossier by number and name, the name asked once in view; no space before the comma. -->{#each t.dossiers?.flatMap( (d) => (d.number ? [{ ...d, number: d.number }] : []) ) ?? [] as d (d.number)},
															<DossierNaam dossier={d} />{/each}
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
		acties
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
	   its grid are the shared .blad and .blad__indeling (AppShell). */
	/* The shared .blad__facetten (AppShell), as high as this scrolling box rather than the
	   window, so its last filter can be reached. */
	.facet-col {
		max-height: calc(100cqh - var(--s-6));
	}
	.results {
		min-width: 0;
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
		font-family: var(--font-serif);
		font-size: var(--t-label); /* a chart's own labels, below the ladder: docs/typografie.md */
		color: var(--ink-3);
	}
	.years-axis span {
		flex: 1;
		min-width: 0;
		overflow: visible;
		white-space: nowrap;
	}
	/* The last year ends at the edge and runs inward, never past it. */
	.years-axis span:last-child {
		display: flex;
		justify-content: flex-end;
	}

	.row-method {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.list-source {
		margin: var(--s-4) 0 0;
		font-family: var(--font-serif);
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
		grid-template-columns: var(--row-lead, 120px) minmax(0, 1fr) var(--row-aside, 190px);
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
	.nums:not(.list-head .nums) {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
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
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.cab-zoom {
		width: 28px;
		height: 28px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: transparent;
		font-family: var(--font-serif);
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
		font-family: var(--font-serif);
		font-size: var(--t-label); /* a chart's own labels, below the ladder: docs/typografie.md */
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
		font-family: var(--font-serif);
		font-size: var(--t-label); /* a chart's own labels, below the ladder: docs/typografie.md */
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
		font-family: var(--font-serif);
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
		font-weight: 600;
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
		font-family: var(--font-serif);
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
		font-weight: 800;
	}
	.day-title::first-letter {
		text-transform: uppercase;
	}
	.day-meta {
		font-family: var(--font-serif);
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
	/* On a phone both halls in the box of the Tweede Kamer's (440 by 291) as wide as the
	   column: as high as each other, at one scale, no empty band. */
	@media (max-width: 520px) {
		.hemi-svg-wrap :global(.hemicycle svg),
		.hemi-svg-wrap :global(.zaal svg) {
			width: 100%;
			height: auto;
			aspect-ratio: 440 / 291;
		}
		.hemi-svg-wrap :global(.zaal) {
			justify-self: stretch;
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
		font-family: var(--font-serif);
		font-style: normal;
		font-size: var(--t-micro);
		font-weight: 600;
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
	/* One heavy rule per list, the count's above it (docs/bediening.md); the heads of the
	   columns hang under it on a thin rule of their own. */
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
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
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		margin-top: 2px;
	}
	/* A dossier by name in the narrow lead: two lines at most, the whole on hover. */
	.row-id-naam {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		overflow-wrap: break-word;
	}

	.row-sub {
		display: block;
		margin-top: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The inhoudsindicatie of a judgment, two lines at most. */
	.row-summary {
		margin: var(--s-1) 0 0;
		font-family: var(--font-serif);
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
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
		line-height: var(--lh-snug);
		margin-top: var(--s-1);
	}
	.stand {
		display: inline-grid;
		grid-template-columns: repeat(3, var(--s-7));
		gap: var(--s-1);
		font-family: var(--font-serif);
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
		font-family: var(--font-serif);
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
		font-weight: 600;
	}

	.num-strong {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink);
		font-feature-settings: 'lnum';
		line-height: 1;
	}
	.num-lbl {
		font-family: var(--font-serif);
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
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		margin-top: var(--s-2);
	}
	.stem-mini__v {
		color: var(--ink-2);
		text-align: right;
		font-weight: 600;
	}
	.stem-mini__t {
		color: var(--ink-2);
		text-align: left;
		font-weight: 600;
	}
	.stem-mini__unit {
		font-family: var(--font-serif);
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
		font-family: var(--font-serif);
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
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
		border-bottom: 1px solid var(--rule);
	}

	/* Load more */

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
	.verfijnen-knop {
		display: none;
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
	@media (max-width: 767px) {
		.regel {
			margin-bottom: var(--s-3);
		}
		.verfijnen-knop {
			display: inline;
			padding: var(--s-2) 0;
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
	}
</style>
