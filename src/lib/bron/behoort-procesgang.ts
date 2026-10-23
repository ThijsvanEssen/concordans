// The procesgang of a judgment in the band: eerdere aanleg › this uitspraak › hoger beroep or
// cassatie, the instances before the eerdere aanleg asked one by one; for a translation its
// original's; and the ids Verbonden leaves out.
import { textOf } from '$lib/text/words';
import type { NodeGraph, Neighbor } from '$lib/api/nodes';
import { getNodeFirst } from '$lib/api/records';
import { ifExists } from '$lib/api/errors';
import { ecliKey } from '$lib/text/ecli';
import { layerOf, type Layer, type Regel } from './behoort-layer';
import { appealChain, EARLIER, first, asLayers, LATER } from './appeal-chain';

/** The line Procesgang, the instances before the eerdere aanleg asked when the band is there. */
export function procesgangLine(props: Record<string, unknown>, light: NodeGraph | null): Regel[] {
	const { earlier, gang } = appealChain(props, light);
	if (!gang.length) return [];
	const before = earlier.at(-1)?.ref?.key;
	return [
		{
			id: 'procesgang',
			label: 'Procesgang',
			lagen: gang,
			laad: before ? async () => [...(await eerdereAanleg(before)), ...gang] : undefined
		}
	];
}

/**
 * A translation the Rechtspraak published under its own ECLI has no instances of its own: it
 * names its original (`translation_of`, a source value), and the procesgang is the original's,
 * asked when the band is there (audit L4).
 */
export function translationLines(props: Record<string, unknown>, light: NodeGraph | null): Regel[] {
	const original = textOf(props.translation_of);
	const key = original ? ecliKey(original) : null;
	if (!original || !key || appealChain(props, light).gang.length) return [];
	return [
		{
			id: 'vertaling',
			label: 'Vertaling van',
			lagen: [{ soort: 'Origineel', naam: original, ref: { collection: 'judgments', key } }],
			laad: async () => {
				const l = await ifExists(getNodeFirst('judgments', key));
				return l?.node
					? [layerOf({ ...l.node, collection: 'judgments' } as Neighbor, 'Origineel')]
					: [];
			}
		},
		{ id: 'procesgang', label: 'Procesgang', lagen: [], laad: () => procesgangVan(key) }
	];
}

/**
 * The instances before an eerdere aanleg, the earliest first: up to three steps down
 * `APPEAL_OF`, each a light node (cached), each asked only after the one before. A step
 * the data lacks ends the chain; a failed one throws, for the band to mark its line.
 */
async function eerdereAanleg(key: string): Promise<Layer[]> {
	const keten: Layer[] = [];
	let k = key;
	for (let i = 0; i < 3; i++) {
		const n = first(await ifExists(getNodeFirst('judgments', k)), EARLIER);
		if (!n) break;
		keten.unshift(layerOf(n, 'Eerdere aanleg'));
		k = n.key;
	}
	return keten;
}

/**
 * The procesgang of another judgment, with that judgment as a link in its place: for a
 * translation, its original's. Its light node and those before it, cached.
 */
async function procesgangVan(key: string): Promise<Layer[]> {
	const light = await ifExists(getNodeFirst('judgments', key));
	if (!light?.node) return [];
	const eerder = first(light, EARLIER);
	const later = first(light, LATER);
	if (!eerder && !later) return [];
	const zelf = layerOf({ ...light.node, collection: 'judgments' } as Neighbor, 'Het origineel');
	return [
		...(eerder ? [...(await eerdereAanleg(eerder.key)), layerOf(eerder, 'Eerdere aanleg')] : []),
		zelf,
		...asLayers(later, 'Hoger beroep of cassatie')
	];
}

const ids = (lagen: Layer[]) =>
	lagen.flatMap((l) => (l.ref ? [`${l.ref.collection}/${l.ref.key}`] : []));

/**
 * The ids of the instances before a judgment's eerdere aanleg (the Rechtbank before the
 * Hof), which its procesgang names but no bucket of its own holds: Verbonden does not list
 * them again under what the judgment cites (Thijs, 9 Oct). The same cached light nodes as
 * the band's line.
 */
export async function procesgangIds(key: string): Promise<string[]> {
	const light = await ifExists(getNodeFirst('judgments', key));
	const eerder = first(light, EARLIER);
	// A translation: its original's procesgang, the original included.
	const origineel = textOf(
		(light?.node as { props?: Record<string, unknown> } | undefined)?.props?.translation_of
	);
	if (origineel && !eerder && !first(light, LATER))
		return ids(await procesgangVan(ecliKey(origineel)));
	return eerder ? ids(await eerdereAanleg(eerder.key)) : [];
}
