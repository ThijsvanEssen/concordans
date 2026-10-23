// The order of a group's rows in Verbonden where the API does not rank them: the most
// important first, so the three a closed group shows are the three to read (besluit 32).
// Only from fields the rows already carry:
//
// - cited: an article, a law or a judgment by how often it is cited
//   (`inbound_citation_count`), then the newest;
// - papers: a Kamerstuk by its place in the making of a law (voorstel van wet, memorie van
//   toelichting, nota van wijziging, nota naar aanleiding van het verslag, verslag,
//   amendement, motie, brief, the rest), then the newest;
// - current: a seat or a post that is still held first (a commissie's leden), then the one that
//   ended last;
// - office: a bewindspersoon of a kabinet by the highest post (minister-president, viceminister-
//   president, minister, minister zonder portefeuille, staatssecretaris), then the one still
//   serving;
// - newest: by the date of the bron.
//
// A group the API orders (`orders`, the judgments of an article by `citation_count`), or whose
// order says something (a course of changes, a vote by its choice), keeps its own.
import type { Collection } from '$lib/vocabulary';
import { kindRank } from '$lib/text/document-kind';
import type { Row } from './rows';

type Importance = 'cited' | 'papers' | 'current' | 'office' | 'newest';

/** The groups ranked here, per kind of bron: group id to the rule. */
const IMPORTANCE: Partial<Record<Collection, Record<string, Importance>>> = {
	articles: {
		'cited-by': 'cited',
		'based-on': 'cited',
		'refers-to': 'cited',
		documents: 'papers'
	},
	instruments: {
		'based-on': 'cited',
		related: 'cited',
		'implemented-by': 'cited',
		changes: 'newest',
		'explained-by': 'papers'
	},
	judgments: { articles: 'cited', judgments: 'cited', 'cited-by': 'cited' },
	documents: {
		names: 'papers',
		'named-by': 'papers',
		explains: 'cited',
		'refers-to': 'cited'
	},
	dossiers: {
		'documents-tk': 'papers',
		'documents-ek': 'papers',
		commitments: 'newest',
		'decisions-ek': 'newest',
		activities: 'newest'
	},
	cases: { documents: 'papers', decisions: 'newest' },
	committees: { members: 'current' },
	cabinets: { bewindspersonen: 'office' },
	factions: { authored: 'newest' },
	members: {
		'authored-kamerlid': 'newest',
		'authored-bewindspersoon': 'newest',
		'authored-overig': 'newest',
		votes: 'newest',
		commitments: 'newest'
	}
};

const citations = (r: Row): number => {
	const n = r.props?.inbound_citation_count;
	return typeof n === 'number' ? n : 0;
};

/** Newest first; a row without a date after the dated ones. */
const newest = (a: Row, b: Row) => (b.date ?? '').localeCompare(a.date ?? '');

/** Held now first (no end), then the end that lies last, then the start that lies last. */
const current = (a: Row, b: Row) =>
	Number(!!a.period?.to) - Number(!!b.period?.to) ||
	(b.period?.to ?? '').localeCompare(a.period?.to ?? '') ||
	(b.period?.from ?? '').localeCompare(a.period?.from ?? '');

/** The posts of a kabinet from the highest down (`meta.posts[].post` of SERVED_IN). */
const POSTS = [
	'minister-president',
	'viceminister-president',
	'minister',
	'minister_zonder_portefeuille',
	'staatssecretaris'
];
const postRank = (r: Row): number => {
	const posts = r.edge?.posts;
	const ranks = (Array.isArray(posts) ? posts : []).map((p) =>
		POSTS.indexOf(String((p as Record<string, unknown> | null)?.post ?? ''))
	);
	const found = ranks.filter((i) => i >= 0);
	return found.length ? Math.min(...found) : POSTS.length;
};

const COMPARE: Record<Importance, (a: Row, b: Row) => number> = {
	cited: (a, b) => citations(b) - citations(a) || newest(a, b),
	papers: (a, b) => kindRank(a.props?.kind) - kindRank(b.props?.kind) || newest(a, b),
	current,
	office: (a, b) => postRank(a) - postRank(b) || current(a, b),
	newest
};

/** The rule of a group of the bron of `collection`, or null where its order stands. */
export const importanceOf = (collection: Collection, groupId: string): Importance | null =>
	IMPORTANCE[collection]?.[groupId] ?? null;

/** The rows by importance under `belang`: a new array, a stable order between equals. */
export const byImportance = (rows: Row[], belang: Importance): Row[] =>
	[...rows].sort(COMPARE[belang]);
