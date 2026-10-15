// The Verkenner's state as its address holds it, as pure functions of the query the Verkenner
// reads (verkennerUrl: a readable address has its focus in the path). The page derives its
// state from these; writing the address stays with the page.
//
// ?mode=index (Bladeren, with ?kind), ?focus (the bron), ?lezen=1 (read at full width),
// ?tabel=1 (all verbindingen as a table), ?naast (a toelichting or judgment beside the
// article), ?overlay, ?diepte and ?alles=1 (how far the canvas reaches), the bronfilter
// (?bronnen, ?lid, ?rechter, ?van, ?tot, ?geldend, ?betrouwbaarheid, ?status, ?jaar, ?zoek),
// the netwerk of chosen bronnen (?netwerk, ?uit, ?tussen), ?paneel (a phone's tab, read once)
// and the position inside the text as the fragment.
import { isReadable } from '$lib/bron/href';
import { keyEcli, padHref, type Pad } from '$lib/bron/leesbaar';
import { kamerstukName } from '$lib/components/parliamentary/kamerstuk';
import { isIndexCategory, type IndexCategory } from '$lib/components/explore/index/categories';
import { isContainerKind } from '$lib/graph/container-membership';
import type { GraphNode, GraphNodeKind } from '$lib/graph/types';
import { filterParams, parseFilter } from '$lib/verbonden/filter';
import { parseNodeId, type Mode } from '$lib/vocabulary';

/** The bron of ?focus has a text of its own, to read at full width. */
export function hasReadableFocus(params: URLSearchParams): boolean {
	const target = parseNodeId(params.get('focus') ?? '');
	return target ? isReadable(target.collection) : false;
}

/**
 * The Verkenner is the network. A bron with a text of its own is read at full width
 * (?lezen=1); its verbindingen as a table are read so too, whatever the bron. Bladeren is
 * ?mode=index, whatever else the address holds.
 */
export function exploreMode(params: URLSearchParams): Mode {
	if (params.get('mode') === 'index') return 'index';
	if (!params.get('focus')) return 'graph';
	if (params.get('tabel') === '1') return 'read';
	return params.get('lezen') === '1' && hasReadableFocus(params) ? 'read' : 'graph';
}

/** The steps from the focus the canvas can show, and what an unreadable ?diepte means. */
export const DEPTH = { min: 1, max: 3, fallback: 2 } as const;

/** ?diepte within its bounds; null where the address does not say. */
export function explicitDepth(params: URLSearchParams): number | null {
	const value = params.get('diepte');
	if (!value) return null;
	return Math.min(DEPTH.max, Math.max(DEPTH.min, Number(value) || DEPTH.fallback));
}

/**
 * The steps the canvas shows around a bron of `kind`. ?alles=1 is one step with every direct
 * neighbour (Thijs, 10 Oct). Unset, a wet, fractie, commissie or dossier takes one step: its
 * own children are plenty (a fractie's members alone can be dozens); every other bron two.
 */
export function depthFor(
	kind: GraphNodeKind,
	{ explicit, all }: { explicit: number | null; all: boolean }
): number {
	if (all) return 1;
	return explicit ?? (isContainerKind(kind) ? 1 : DEPTH.fallback);
}

/** The netwerk's own three params, so that selecting a bron does not compose it again. */
export function netwerkQuery(params: URLSearchParams): string {
	const own = new URLSearchParams();
	for (const name of ['netwerk', 'uit', 'tussen']) {
		const value = params.get(name);
		if (value !== null) own.set(name, value);
	}
	return own.toString();
}

/**
 * The bronfilter's own params, in one order: a change elsewhere in the address (?versies,
 * ?naast) leaves it the same string, so the filter derived from it stays the same object.
 */
export function filterQuery(params: URLSearchParams): string {
	const own = new URLSearchParams();
	for (const [name, value] of Object.entries(filterParams(parseFilter(params))))
		if (value !== null) own.set(name, value);
	return own.toString();
}

/** The list Bladeren shows: ?kind, else the dossiers. */
export function indexCategory(params: URLSearchParams): IndexCategory {
	const kind = params.get('kind');
	return isIndexCategory(kind) ? kind : 'dossiers';
}

/**
 * The judgment of ?naast as its reader takes one: by its key, its ECLI from it. Null for
 * anything else beside the article.
 */
export function besideJudgment(beside: ReturnType<typeof parseNodeId>): GraphNode | null {
	if (beside?.collection !== 'judgments') return null;
	const id = `judgments/${beside.key}`;
	const ecli = keyEcli(beside.key);
	return {
		id,
		collection: 'judgments',
		key: beside.key,
		kind: 'judgment',
		label: ecli ?? 'Uitspraak',
		raw: {
			id,
			key: beside.key,
			collection: 'judgments',
			type: 'judgment',
			display_name: ecli,
			labels: [],
			props: { ecli },
			path: null
		}
	};
}

const SERIES_NAME = { stb: 'Stb.', stcrt: 'Stcrt.', trb: 'Trb.' } as const;

/** What a readable address names, as the page says it when the data lacks it. */
export function nameOfPad(p: Pad): string {
	switch (p.soort) {
		case 'artikel':
			return `Artikel ${p.nummer} van ${p.wet}`;
		case 'kamerstuk':
			return (
				kamerstukName({
					chamber: /^\d/.test(p.nummer) ? 'TK' : 'EK',
					dossier_number: p.dossier,
					number: p.nummer
				}) ?? padHref(p)
			);
		case 'publicatie':
			return `${SERIES_NAME[p.reeks]} ${p.jaar}, ${p.nummer}`;
		case 'lid':
			return `Lid ${p.slug}`;
		case 'commissie':
			return `Commissie ${p.slug}`;
		case 'toezegging':
			return `Toezegging ${p.nummer}`;
		case 'zaak':
			return `Zaak ${p.nummer}`;
		case 'bijlage':
			return `Bijlage ${p.label} van ${p.wet}`;
		default:
			return padHref(p);
	}
}
