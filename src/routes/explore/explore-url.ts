// The Verkenner's state as its address holds it, as pure functions of the query the Verkenner
// reads (exploreUrl: a readable address has its focus in the path). The page derives its
// state from these; writing the address stays with the page.
//
// ?mode=index (Bladeren, with ?kind), ?focus (the bron), ?lezen=1 (read at full width),
// ?tabel=1 (all verbindingen as a table; ?soort narrows it to kinds, from the werkplek's
// Tonen, which ?mode=netwerk leads back to), ?naast (a toelichting or judgment beside the
// article), ?overlay, ?diepte and ?alles=1 (how far the canvas reaches), the bronfilter
// (?bronnen, ?lid, ?rechter, ?van, ?tot, ?geldend, ?betrouwbaarheid, ?status, ?jaar, ?zoek),
// the netwerk of chosen bronnen (?netwerk, ?uit), ?paneel (a phone's tab, read once)
// and the position inside the text as the fragment.
import { padHref, type Pad } from '$lib/bron/address';
import { keyEcli } from '$lib/text/ecli';
import { dossierNumberLabel } from '$lib/bron/dossier-naam';
import { citationRecord, enactedLawPlace } from '$lib/text/citation-record';
import { isIndexCategory, type IndexCategory } from '$lib/components/explore/index/categories';
import { isContainerKind } from '$lib/graph/container-membership';
import type { GraphNode, DrawClass } from '$lib/graph/types';
import { filterParams, parseFilter } from '$lib/verbonden/filter';
import { parseNodeId } from '$lib/vocabulary';
import { offOf } from '$lib/selection/off';

/**
 * The steps from the chosen bronnen the canvas can show, and what an unreadable ?diepte means.
 * 0 is Alleen gekozen: only the netwerk's own bronnen and what ties them; a bron alone has no 0.
 */
export const DEPTH = { min: 0, max: 3, fallback: 2 } as const;

/** ?diepte within its bounds; null where the address does not say. */
export function explicitDepth(params: URLSearchParams): number | null {
	const value = params.get('diepte');
	if (!value) return null;
	const steps = Number(value);
	if (!Number.isFinite(steps)) return DEPTH.fallback;
	return Math.min(DEPTH.max, Math.max(DEPTH.min, Math.trunc(steps)));
}

/**
 * The steps the canvas shows around a bron of `kind`. ?alles=1 is one step with every direct
 * neighbour (Thijs, 10 Oct). Unset, a wet, fractie, commissie or dossier takes one step: its
 * own children are plenty (a fractie's members alone can be dozens); every other bron two.
 */
export function depthFor(
	drawClass: DrawClass,
	{ explicit, all }: { explicit: number | null; all: boolean }
): number {
	if (all) return 1;
	return explicit ?? (isContainerKind(drawClass) ? 1 : DEPTH.fallback);
}

/**
 * The netwerk's own params, so that selecting a bron does not compose it again. Of ?uit only
 * the chosen bronnen: a relation switched off in the legend does not compose it again.
 */
export function netwerkQuery(params: URLSearchParams): string {
	const own = new URLSearchParams();
	for (const name of ['netwerk', 'uit']) {
		const value = name === 'uit' ? offOf(params.get(name)).chosen.join(',') : params.get(name);
		if (value !== null && (value || name !== 'uit')) own.set(name, value);
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
		drawClass: 'judgment',
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

/**
 * What a readable address names, as the page says it when the data lacks it or it failed: a
 * law by its name where the page knows it (`lawNameOf`), not by its BWB id.
 */
/** The law of an address of an article or a bijlage, by its id: the way to it from a 404. */
export const lawOfPad = (p: Pad): string | null =>
	p.soort === 'artikel' || p.soort === 'bijlage' ? p.wet : null;

export function nameOfPad(p: Pad, lawNameOf: (bwb: string) => string | null = () => null): string {
	switch (p.soort) {
		case 'artikel':
			return `Artikel ${p.nummer} van ${enactedLawPlace(p.wet) ?? lawNameOf(p.wet) ?? p.wet}`;
		case 'wet':
			return enactedLawPlace(p.wet) ?? lawNameOf(p.wet) ?? `Wet ${p.wet}`;
		case 'kamerstuk':
			return (
				citationRecord({
					kind: 'kamerstuk',
					chamber: /^\d/.test(p.nummer) ? 'TK' : 'EK',
					dossier_number: p.dossier,
					number: p.nummer
				})?.short ?? padHref(p)
			);
		case 'dossier':
			return dossierNumberLabel(p.nummer);
		case 'uitspraak':
			return p.ecli;
		case 'publicatie':
			return (
				citationRecord({ kind: 'publication', series: p.reeks, year: p.jaar, number: p.nummer })
					?.short ?? padHref(p)
			);
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
		case 'activiteit':
			return `Activiteit ${p.nummer}`;
		case 'kabinet':
			return `Kabinet ${p.key}`;
		case 'ministry':
			return `Ministerie ${p.key}`;
		case 'fractie':
			return `Fractie ${p.key}`;
		case 'stemming':
			return 'Deze stemming';
		default:
			return padHref(p);
	}
}
