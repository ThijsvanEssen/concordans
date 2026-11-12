// The filters of Actueel, each once: its name in the address (which shared links keep), how
// it is read from there, and what it asks the feed. Reading, clearing, the feed's query and
// the day counts all follow from this table, so a new filter is one row.
import { dayParam } from '$lib/text/periode';
import type { paths } from '$lib/api/generated/openapi-types';
import { PARAM, listParam } from '$lib/url/filters';
import type { Chamber } from '$lib/components/parliamentary/chamber';
import { TIERS, TIER_LABEL, type Tier } from '$lib/vocabulary';
import { capitalize } from '$lib/text/words';
import { FEED_KINDS, isFeedKind, type FeedKind } from './feed';
import { NO_AREA, NO_AREA_LABEL } from './lower-courts';
import type { Schema } from '$lib/api/types';
import { facetMap, type FacetGroup } from '$lib/components/explore/index/facets';

export type FeedQuery = NonNullable<paths['/api/feed']['get']['parameters']['query']>;

/** What the coalition did on a vote (API 0.79.45): the site's word, the API's, the label. */
export const COALITION = {
	eensgezind: { api: 'together', label: 'Eensgezind' },
	verdeeld: { api: 'split', label: 'Verdeeld' },
	wisselmeerderheid: { api: 'wissel', label: 'Wisselmeerderheid' },
	doorslaggevend: { api: 'decisive', label: 'Doorslaggevend' }
} as const;
export type CoalitionWord = keyof typeof COALITION;

/** How a faction voted (API: `vote` with `party`): the site's word is the API's, voor or tegen. */
export const VOTES = ['voor', 'tegen'] as const;

/** The names of Stemde and its Stem in the address. */
export const VOTED_PARAM = 'stemde';
export const VOTE_PARAM = 'stem';
type VoteWord = (typeof VOTES)[number];

/** The names of Instantie and Rechtsgebied in the address. */
export const TIER_PARAM = 'instantie';
export const AREA_PARAM = 'rechtsgebied';

const isTier = (v: string): v is Tier => (TIERS as readonly string[]).includes(v);

/** A law the feed follows by its BWB id: a law or a regulation (BWBR), or a treaty (BWBV). */
export const isFeedLaw = (value: string) => /^BWB[RV]\d+$/i.test(value);

/**
 * The kinds a filter has nothing to say about: who submitted or voted, the coalition and the
 * Kamer are of the papers, votes and commitments of the Kamer; a dossier is not of a
 * commencement or a judgment; a ministry not of a judgment; the court and the area of law of
 * nothing but a judgment. A filter stands where the kinds chosen (none: every kind) hold one
 * it speaks of.
 */
export const NOT_OF = {
	chamber: ['publicatie', 'inwerkingtreding', 'uitspraak'],
	dossier: ['inwerkingtreding', 'uitspraak'],
	ministry: ['uitspraak'],
	judgment: FEED_KINDS.filter((k) => k !== 'uitspraak')
} as const satisfies Record<string, readonly FeedKind[]>;

/** Whether a filter that says nothing about `not` speaks of any of the kinds chosen. */
export const speaksOf = (kinds: readonly FeedKind[], not: readonly FeedKind[]) =>
	!kinds.length || kinds.some((k) => !not.includes(k));

/**
 * Which filters of Actueel stand, by their id: those that speak of the kinds chosen, and a
 * filter with a value chosen, to be undone. Under Uitspraak alone no Ingediend door, Stemde,
 * Coalitie or Kamer, nor with an Instantie or a Rechtsgebied chosen; those two only where
 * judgments may be.
 */
export function shownFilters(f: ActueelFilters): (id: string) => boolean {
	// A court or an area of law keeps judgments alone, whatever the kinds chosen.
	const kinds: FeedKind[] = f.tiers.length || f.area ? ['uitspraak'] : f.kinds;
	const ofChamber = speaksOf(kinds, NOT_OF.chamber);
	const ofJudgment = speaksOf(kinds, NOT_OF.judgment);
	const shown = new Map<string, boolean>([
		['kamer', ofChamber || !!f.chamber],
		['fractie', ofChamber || !!f.faction],
		['stemde', ofChamber || !!f.voted],
		['coalitie', ofChamber || !!f.coalition],
		['ministerie', speaksOf(kinds, NOT_OF.ministry) || !!f.ministry],
		['dossier', speaksOf(kinds, NOT_OF.dossier) || !!f.dossier],
		[TIER_PARAM, ofJudgment || !!f.tiers.length],
		[AREA_PARAM, ofJudgment || !!f.area],
		['komend', !kinds.length || kinds.includes('inwerkingtreding') || f.ahead]
	]);
	return (id) => shown.get(id) ?? true;
}

type ActueelFilters = {
	kinds: FeedKind[];
	since: string;
	until: string;
	cabinet: string;
	ministry: string;
	dossier: string;
	member: string;
	/** Who submitted it (`faction`: what its Kamerleden signed). */
	faction: string;
	/** Who voted on it (`party`: how the fraction voted), with `vote` how it voted. */
	voted: string;
	vote: VoteWord | '';
	coalition: CoalitionWord | '';
	/** Every word searched, each a `q` of its own: any of them counts. */
	q: string[];
	chamber: Chamber | '';
	/** The courts of the judgments (`tier`): any of them; none, the feed's own. */
	tiers: Tier[];
	/** The main area of law of the judgments (`subject_area`), `none` for those without one. */
	area: string;
	instrument: string;
	/** An article of the law, only with the law. */
	article: string;
	/** What lies ahead (an inwerkingtreding): the page shows it, the feed always gives it. */
	ahead: boolean;
};

type Filter<T> = {
	param: string;
	read: (params: URLSearchParams) => T;
	/** What the filter asks the feed; none for one the page applies itself. */
	ask?: (value: T, today: string) => FeedQuery;
};

/** A filter whose value the feed takes as it stands in the address. */
const plain = (param: string, api: keyof FeedQuery): Filter<string> => ({
	param,
	read: (p) => p.get(param) ?? '',
	ask: (v) => (v ? ({ [api]: v } as FeedQuery) : {})
});

const readLaw = (p: URLSearchParams) => {
	const v = p.get('wet')?.trim() ?? '';
	return isFeedLaw(v) ? v.toUpperCase() : '';
};

const FILTERS: { [K in keyof ActueelFilters]: Filter<ActueelFilters[K]> } = {
	kinds: {
		param: PARAM.kind,
		read: (p) => listParam(p.get(PARAM.kind), isFeedKind),
		ask: (v) => (v.length ? { kind: v.join(',') } : {})
	},
	since: { ...plain(PARAM.since, 'since'), read: (p) => dayParam(p, PARAM.since) },
	// Only a day in the past: with `until` the API counts apart and took 100+ s (prod, 9 Oct),
	// without it 0.25 s. What lies ahead is left out by the page instead.
	until: {
		...plain(PARAM.until, 'until'),
		read: (p) => dayParam(p, PARAM.until),
		ask: (v, today) => (v && v < today ? { until: v } : {})
	},
	cabinet: plain(PARAM.cabinet, 'cabinet'),
	ministry: plain(PARAM.ministry, 'ministry'),
	dossier: plain(PARAM.dossier, 'dossier'),
	member: plain(PARAM.member, 'member'),
	faction: plain(PARAM.party, 'faction'),
	voted: plain(VOTED_PARAM, 'party'),
	// How it voted counts only for a faction (the API answers 422 for a vote alone).
	vote: {
		param: VOTE_PARAM,
		read: (p) => {
			const v = p.get(VOTE_PARAM) ?? '';
			return (VOTES as readonly string[]).includes(v) ? (v as VoteWord) : '';
		},
		ask: (v) => (v ? { vote: v } : {})
	},
	coalition: {
		param: PARAM.coalition,
		read: (p) => {
			const v = p.get(PARAM.coalition) ?? '';
			return Object.hasOwn(COALITION, v) ? (v as CoalitionWord) : '';
		},
		ask: (v) => (v ? { coalition: COALITION[v].api } : {})
	},
	q: {
		param: PARAM.q,
		read: (p) => [
			...new Set(
				p
					.getAll(PARAM.q)
					.map((v) => v.trim())
					.filter(Boolean)
			)
		],
		ask: (v) => (v.length ? { q: v } : {})
	},
	chamber: {
		param: PARAM.chamber,
		read: (p) => {
			const v = p.get(PARAM.chamber);
			return v === 'TK' || v === 'EK' ? v : '';
		},
		ask: (v) => (v ? { chamber: v } : {})
	},
	tiers: {
		param: TIER_PARAM,
		read: (p) => TIERS.filter((t) => listParam(p.get(TIER_PARAM), isTier).includes(t)),
		ask: (v) => (v.length ? { tier: v.join(',') } : {})
	},
	area: { ...plain(AREA_PARAM, 'subject_area'), read: (p) => p.get(AREA_PARAM)?.trim() ?? '' },
	instrument: { ...plain('wet', 'instrument'), read: readLaw },
	article: {
		...plain('artikel', 'article'),
		read: (p) => (readLaw(p) ? (p.get('artikel')?.trim() ?? '') : '')
	},
	ahead: { param: 'komend', read: (p) => p.get('komend') === '1' }
};

const ENTRIES = Object.entries(FILTERS) as [keyof ActueelFilters, Filter<unknown>][];

/** The names of the filters in the address: what clearing them removes. */
export const FEED_FILTER_PARAMS = ENTRIES.map(([, f]) => f.param);

/** The filters of an address. */
export const readFilters = (params: URLSearchParams): ActueelFilters =>
	Object.fromEntries(ENTRIES.map(([k, f]) => [k, f.read(params)])) as ActueelFilters;

/** The filters as the feed asks them, in the words of the API; none chosen asks nothing. */
export function feedQuery(filters: ActueelFilters, today: string): FeedQuery {
	const query: FeedQuery = Object.assign(
		{},
		...ENTRIES.map(([k, f]) => f.ask?.(filters[k], today) ?? {})
	);
	// How it voted is asked of a faction only.
	if (!filters.voted) delete query.vote;
	return query;
}

/** The filters of a feed query for its day counts, which ask a period of their own. */
export function summaryQuery(query: FeedQuery) {
	const { since: _since, until: _until, limit: _limit, cursor: _cursor, ...filters } = query;
	return filters;
}

type Option = { id: string; label: string; count: number; on: boolean; onClick: () => void };

/**
 * Instantie as the bar lists it: the courts the feed counts (`tier`, every tier, also those it
 * shows only when asked), in the order of the judiciary; a chosen one without a count with 0.
 * Any of them at once, as `soort`.
 */
export function tierOptions(
	counts: ReadonlyMap<string, number>,
	chosen: readonly Tier[],
	choose: (tiers: Tier[]) => void
): Option[] {
	return TIERS.filter((t) => counts.has(t) || chosen.includes(t)).map((t) => {
		const on = chosen.includes(t);
		return {
			id: t,
			label: TIER_LABEL[t],
			count: counts.get(t) ?? 0,
			on,
			onClick: () => choose(on ? chosen.filter((c) => c !== t) : [...chosen, t])
		};
	});
}

/**
 * Rechtsgebied as the bar lists it: the main areas of the judgments, most first, and last the
 * judgments without one, a gap in the source named "Onbekend" (`none`); one at a time.
 */
export function areaOptions(
	facet: readonly { value?: string | null; count: number }[] | null | undefined,
	chosen: string,
	choose: (area: string | null) => void
): Option[] {
	const areas = (facet ?? []).map((f) => ({ id: f.value || NO_AREA, count: f.count }));
	if (chosen && !areas.some((a) => a.id === chosen)) areas.push({ id: chosen, count: 0 });
	areas.sort((a, b) => Number(a.id === NO_AREA) - Number(b.id === NO_AREA));
	return areas.map(({ id, count }) => ({
		id,
		label: id === NO_AREA ? capitalize(NO_AREA_LABEL) : id,
		count,
		on: chosen === id,
		onClick: () => choose(chosen === id ? null : id)
	}));
}

/**
 * Instantie and Rechtsgebied as groups of the bar, each changing its name in the address; of
 * the judgments alone, so standing where they may be (`shownFilters`).
 */
export function judgmentGroups(
	facets: Schema<'FeedFacetsDTO'> | null,
	tiers: readonly Tier[],
	area: string,
	patch: (p: Record<string, string | null>) => void
): FacetGroup[] {
	return [
		{
			id: TIER_PARAM,
			label: 'Instantie',
			kind: 'list',
			options: tierOptions(facetMap(facets?.tier), tiers, (t) =>
				patch({ [TIER_PARAM]: t.join(',') || null })
			)
		},
		{
			id: AREA_PARAM,
			label: 'Rechtsgebied',
			chip: 'Rechtsgebied',
			kind: 'list',
			options: areaOptions(facets?.subject_area, area, (a) => patch({ [AREA_PARAM]: a }))
		}
	];
}
