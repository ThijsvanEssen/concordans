// The hulls of the scene (Omgeving as lanes): a dossier holds its stukken, activiteiten, toezeggingen
// and stemmingen in rows in the order of the procedure, a wet its articles in a row per hoofdstuk.
// A stuk belongs to its dossier by `dossier_number` (only some carry the edge); an activity about
// several dossiers sits in one of them and bridges none: the others only count (`bridged`).
import { textOf } from '$lib/text/words';
import { officialNumber } from '$lib/bron/dossier-naam';
import { isLetter, motionOrAmendment } from '$lib/text/document-kind';
import { nodeId, type Relation } from '$lib/vocabulary';
import { holdsInHull } from './container-membership';
import { instrumentLawId, lawIdOf, type GraphEdge, type GraphNode } from './types';

/** A dossier is drawn as a hull from this many bronnen on (or when it is chosen); a wet always. */
export const HULL_MIN = 4;

const PAPER_COLLECTIONS: ReadonlySet<string> = new Set([
	'documents',
	'activities',
	'decisions',
	'commitments',
	'cases'
]);
const ARTICLE_COLLECTIONS: ReadonlySet<string> = new Set(['articles', 'annexes']);

type Ends = Pick<GraphNode, 'collection'> | undefined;

/** Whether an edge puts its source in the hull of its target: an article in its wet, a stuk in its dossier. */
export function isHullEdge(from: Ends, to: Ends, relation: Relation): boolean {
	if (!from || !to) return false;
	if (to.collection === 'instruments')
		return (
			ARTICLE_COLLECTIONS.has(from.collection) && holdsInHull('instrument', relation, 'inbound')
		);
	return (
		to.collection === 'dossiers' &&
		PAPER_COLLECTIONS.has(from.collection) &&
		holdsInHull('dossier', relation, 'inbound')
	);
}

/** The node id of a dossier by its number as a stuk carries it: `21501-02` is `dossiers/21501_02`. */
const dossierIdOf = (number: string): string =>
	nodeId('dossiers', number.toLowerCase().replace(/[^a-z0-9]+/g, '_'));

/** A row of a hull: the bronnen of one stuksoort, or the articles of one hoofdstuk. */
export type HullRow = {
	id: string;
	/** As the hull shows it: "Moties", "Hoofdstuk 2"; empty for the one row of a wet without. */
	label: string;
	members: string[];
};

const DOSSIER_ROWS = [
	['bill', 'Wetsvoorstel en behandeling'],
	['letters', 'Brieven'],
	['commitments', 'Toezeggingen'],
	['activities', 'Activiteiten'],
	['amendments', 'Amendementen'],
	['motions', 'Moties'],
	['votes', 'Stemmingen']
] as const;

type DossierRow = (typeof DOSSIER_ROWS)[number][0];

/** The row of a bron in its dossier, by its collection and, for a stuk, its kind. */
function dossierRowOf(node: GraphNode): DossierRow {
	if (node.collection === 'activities') return 'activities';
	if (node.collection === 'decisions') return 'votes';
	if (node.collection === 'commitments') return 'commitments';
	const kind = node.raw?.props?.kind;
	const motion = motionOrAmendment(kind);
	if (motion) return motion === 'motie' ? 'motions' : 'amendments';
	return isLetter(kind) ? 'letters' : 'bill';
}

/** The hoofdstuk of an article: what stands before the dot in `2.3`; none for `14` or `6:162`. */
const chapterOf = (node: GraphNode): string => {
	if (node.collection === 'annexes') return 'annexes';
	const number = textOf(node.raw?.props?.article_number) ?? '';
	const dot = number.indexOf('.');
	return dot > 0 ? number.slice(0, dot) : '';
};

const byChapter = (a: string, b: string) =>
	(a === 'annexes' ? 1 : 0) - (b === 'annexes' ? 1 : 0) ||
	(parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) ||
	a.localeCompare(b);

const chapterLabel = (chapter: string) =>
	chapter === 'annexes' ? 'Bijlagen' : chapter ? `Hoofdstuk ${chapter}` : '';

/** The rows of a hull, in the order of the procedure or of the hoofdstukken; empty rows left out. */
export function hullRows(kind: HullKind, members: readonly GraphNode[]): HullRow[] {
	const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
	if (kind === 'dossier')
		return DOSSIER_ROWS.map(([id, label]) => ({
			id,
			label,
			members: sorted.filter((m) => dossierRowOf(m) === id).map((m) => m.id)
		})).filter((r) => r.members.length > 0);
	const chapters = [...new Set(sorted.map(chapterOf))].sort(byChapter);
	return chapters.map((c) => ({
		id: c ? `chapter:${c}` : 'articles',
		label: chapterLabel(c),
		members: sorted.filter((m) => chapterOf(m) === c).map((m) => m.id)
	}));
}

type HullKind = 'dossier' | 'law';

/** A hull before the scene decides whether it stands: its container and the bronnen that may go in. */
export type HullCandidate = {
	id: string;
	kind: HullKind;
	/** The container's node, when it is on the canvas. */
	container: GraphNode | undefined;
	members: GraphNode[];
};

/** The containers a bron may stand in: its wet, or the dossiers it is part of or about. */
function homesOf(
	node: GraphNode,
	out: readonly Out[],
	lawOf: (lawId: string) => string
): { kind: HullKind; id: string }[] {
	if (ARTICLE_COLLECTIONS.has(node.collection)) {
		const edge = out.find((e) => isHullEdge(node, e.to, e.relation));
		const lawId = lawIdOf(node.raw?.props);
		const id = edge?.to.id ?? (lawId ? lawOf(lawId) : null);
		return id ? [{ kind: 'law', id }] : [];
	}
	if (!PAPER_COLLECTIONS.has(node.collection)) return [];
	const ids = out.filter((e) => isHullEdge(node, e.to, e.relation)).map((e) => e.to.id);
	const number = textOf(node.raw?.props?.dossier_number);
	if (number) ids.unshift(dossierIdOf(number));
	return [...new Set(ids)].map((id) => ({ kind: 'dossier', id }));
}

type Out = { to: GraphNode; relation: Relation };

/** The edges from each bron, with the node they go to. */
function edgesOut(byId: ReadonlyMap<string, GraphNode>, edges: readonly GraphEdge[]) {
	const out = new Map<string, Out[]>();
	for (const e of edges) {
		const to = byId.get(e.target);
		if (to) out.set(e.source, [...(out.get(e.source) ?? []), { to, relation: e.relation }]);
	}
	return out;
}

/** The node id of a wet by its law id: the instrument on the canvas, else its id by the key. */
function lawsOf(nodes: readonly GraphNode[]): (lawId: string) => string {
	const laws = new Map<string, string>();
	for (const n of nodes)
		if (n.collection === 'instruments') laws.set(instrumentLawId(n.raw?.props, n.key), n.id);
	return (lawId) => laws.get(lawId) ?? nodeId('instruments', lawId.toLowerCase());
}

const containerKind = (n: GraphNode): HullKind | null =>
	n.collection === 'dossiers' ? 'dossier' : n.collection === 'instruments' ? 'law' : null;

/** Every bron's possible homes, and every container: those they name and those on the canvas. */
export function hullCandidates(
	nodes: readonly GraphNode[],
	edges: readonly GraphEdge[]
): { candidates: Map<string, HullCandidate>; homes: Map<string, string[]> } {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const lawOf = lawsOf(nodes);
	const out = edgesOut(byId, edges);
	const candidates = new Map<string, HullCandidate>();
	const homes = new Map<string, string[]>();
	for (const node of nodes) {
		const found = homesOf(node, out.get(node.id) ?? [], lawOf);
		if (found.length > 0)
			homes.set(
				node.id,
				found.map((h) => h.id)
			);
		for (const { kind, id } of found) {
			const c = candidates.get(id) ?? { id, kind, container: byId.get(id), members: [] };
			c.members.push(node);
			candidates.set(id, c);
		}
	}
	for (const n of nodes) {
		const kind = containerKind(n);
		if (kind && !candidates.has(n.id))
			candidates.set(n.id, { id: n.id, kind, container: n, members: [] });
	}
	return { candidates, homes };
}

/** The name of a hull: its container's, else the dossier's number or the wet's citation title. */
export function hullLabel(c: HullCandidate): string {
	if (c.container) return c.container.label;
	if (c.kind === 'dossier') return `Dossier ${officialNumber(c.id.replace(/^dossiers\//, ''))}`;
	const props = c.members[0]?.raw?.props;
	return textOf(props?.instrument_citation_title) ?? lawIdOf(props) ?? '';
}
