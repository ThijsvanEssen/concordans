// The filters of Actueel, each once: its name in the address (which shared links keep), how
// it is read from there, and what it asks the feed. Reading, clearing, the feed's query and
// the day counts all follow from this table, so a new filter is one row.
import type { paths } from '$lib/api/generated/openapi-types';
import { PARAM } from '$lib/url/filters';
import type { Chamber } from '$lib/components/parliamentary/chamber';
import { isFeedKind, type FeedKind } from './feed';

export type FeedQuery = NonNullable<paths['/api/feed']['get']['parameters']['query']>;

/** What the coalition did on a vote (API 0.79.45): the site's word, the API's, the label. */
export const COALITION = {
	eensgezind: { api: 'together', label: 'Eensgezind' },
	verdeeld: { api: 'split', label: 'Verdeeld' },
	wisselmeerderheid: { api: 'wissel', label: 'Wisselmeerderheid' },
	doorslaggevend: { api: 'decisive', label: 'Doorslaggevend' }
} as const;
export type CoalitionWord = keyof typeof COALITION;

/** A law the feed follows by its BWB id: a law or a regulation (BWBR), or a treaty (BWBV). */
export const isFeedLaw = (value: string) => /^BWB[RV]\d+$/i.test(value);

type ActueelFilters = {
	kinds: FeedKind[];
	since: string;
	until: string;
	cabinet: string;
	ministry: string;
	dossier: string;
	member: string;
	faction: string;
	coalition: CoalitionWord | '';
	/** Every word searched, each a `q` of its own: any of them counts. */
	q: string[];
	chamber: Chamber | '';
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
		read: (p) => [...new Set((p.get(PARAM.kind) ?? '').split(',').filter(isFeedKind))],
		ask: (v) => (v.length ? { kind: v.join(',') } : {})
	},
	since: plain(PARAM.since, 'since'),
	// Only a day in the past: with `until` the API counts apart and took 100+ s (prod, 9 Oct),
	// without it 0.25 s. What lies ahead is left out by the page instead.
	until: {
		...plain(PARAM.until, 'until'),
		ask: (v, today) => (v && v < today ? { until: v } : {})
	},
	cabinet: plain(PARAM.cabinet, 'cabinet'),
	ministry: plain(PARAM.ministry, 'ministry'),
	dossier: plain(PARAM.dossier, 'dossier'),
	member: plain(PARAM.member, 'member'),
	faction: plain(PARAM.party, 'faction'),
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
export const feedQuery = (filters: ActueelFilters, today: string): FeedQuery =>
	Object.assign({}, ...ENTRIES.map(([k, f]) => f.ask?.(filters[k], today) ?? {}));

/** The filters of a feed query for its day counts, which ask a period of their own. */
export function summaryQuery(query: FeedQuery) {
	const { since: _since, until: _until, limit: _limit, cursor: _cursor, ...filters } = query;
	return filters;
}
