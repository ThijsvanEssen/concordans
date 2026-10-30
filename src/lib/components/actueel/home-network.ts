// The small network of the start page: the changed article as Verbonden draws its network
// (Netwerk tonen), with the dossier that changes it as a hull round its stukken and the
// ministerie and commissie that lead it. One step from the article, within a budget: past it a
// soort is one circle with its count. The same layout as Verbonden (verbonden/sketch); the
// light node of Verbonden (five per bucket and the counts), asked after the first paint.
import { getNodeVerbonden } from '$lib/api/records';
import { rowOfNeighbor, type Row } from '$lib/verbonden/rows';
import { sketch, type Sketch, type SketchGroup } from '$lib/verbonden/sketch';
import { bronPlural, isCollection, type Collection } from '$lib/vocabulary';
import { neighborsOf, type Neighbor, type NodeGraph } from '$lib/api/nodes';
import { capitalize, textOf } from '$lib/text/words';
import { refOf } from '$lib/bron/ref';
import { dossierNumberLabel } from '$lib/bron/dossier-naam';
import { bwCode } from '$lib/text/bw';
import { lawIdOf } from '$lib/graph/types';
import type { Schets } from './wetsnetwerk';

/** Who leads a dossier: drawn in its hull, as on the canvas. */
const LEIDT = new Set(['ministries', 'committees']);

/** Who leads the dossier, one of each kind: the ministerie, the commissie of the Tweede Kamer
 *  (the first the API sends) before the Eerste. */
function leidersVan(dos: NodeGraph): Row[] {
	const eerste = new Map<string, Neighbor>();
	for (const n of neighborsOf(dos))
		if (n.relation === 'LED_BY' && LEIDT.has(n.collection) && !eerste.has(n.collection))
			eerste.set(n.collection, n);
	return [...eerste.values()].map(rowOfNeighbor).filter((r): r is Row => r !== null);
}

/** The dossier with whom leads it (ministerie, commissie), standing in its hull. */
function dossierGroep(s: Schets, leiders: Row[]): SketchGroup[] {
	const nummer = s.kandidaat.number;
	const dossier: Row = {
		ref: refOf('dossiers', nummer, { number: nummer }),
		title: dossierNumberLabel(nummer),
		context: null,
		filterGroup: 'dossiers'
	};
	const groepen: SketchGroup[] = [
		{ id: 'dossier', name: 'Dossiers', collection: 'dossiers', count: 1, rows: [dossier] }
	];
	// Each on its own: a group of one stands as a bron before a bigger one becomes a circle.
	for (const r of leiders)
		groepen.push({
			id: r.ref.collection,
			name: capitalize(bronPlural(r.ref.collection)),
			collection: r.ref.collection,
			count: 1,
			rows: [{ ...r, props: { ...r.props, dossier_number: nummer } }]
		});
	return groepen;
}

/** Not drawn as a bron: the law the article stands in is its hull, a version is the article. */
const isHull = (b: NonNullable<NodeGraph['neighbors']['buckets']>[number]) =>
	(b.relation === 'PART_OF' && b.direction === 'outbound') || b.collection === 'article_versions';

/** The neighbours of the article per kind, as the canvas draws them one step out: each kind
 *  with what the API counts, its rows the few it sends. */
function soorten(art: NodeGraph): SketchGroup[] {
	const per = new Map<Collection, SketchGroup>();
	for (const b of art.neighbors.buckets ?? []) {
		if (isHull(b) || !isCollection(b.collection)) continue;
		const rows = b.items.map(rowOfNeighbor).filter((r): r is Row => r !== null);
		const g = per.get(b.collection);
		if (g) {
			g.count += b.total;
			g.rows.push(...rows);
			g.capped ||= rows.length < b.total;
		} else
			per.set(b.collection, {
				id: b.collection,
				name: capitalize(bronPlural(b.collection)),
				collection: b.collection,
				count: b.total,
				rows,
				capped: rows.length < b.total
			});
	}
	return [...per.values()];
}

/** The bronnen that stand on their own, on a phone too: past them a soort is one circle with
 *  its count (Thijs, 29 Oct: "A: rustig, 10"). */
export const HOME_LIMIT = 10;

export async function homeNetwork(s: Schets): Promise<Sketch> {
	const key = s.centrum.id.slice(s.centrum.id.indexOf('/') + 1);
	const [art, dos] = await Promise.all([
		getNodeVerbonden('articles', key),
		getNodeVerbonden('dossiers', s.kandidaat.number)
	]);
	const leiders = leidersVan(dos);
	const props = art.node.props as Record<string, unknown> | undefined;
	const home = textOf(props?.['instrument_abbreviation']) ?? bwCode(lawIdOf(props));
	return sketch(
		[...dossierGroep(s, leiders), ...soorten(art)],
		s.centrum.naam,
		HOME_LIMIT,
		'article',
		{ home, centre: { collection: 'articles', key } }
	);
}
