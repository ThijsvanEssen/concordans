// The procesgang of a judgment in the band: eerdere aanleg › this uitspraak › hoger beroep or
// cassatie, the instances before the eerdere aanleg asked one by one; for a translation its
// original's; and the ids Verbonden leaves out.
import { capitalize, textOf } from '$lib/text/words';
import { findBucket, type NodeGraph, type Neighbor } from '$lib/api/nodes';
import { getNodeFirst } from '$lib/api/records';
import { ifExists } from '$lib/api/errors';
import { langeDatum } from '$lib/text/datum';
import { ecliKey } from './address';
import { inbound, laagVan, outbound, uitkomstVan, type Laag, type Regel } from './behoort-layer';

export const EARLIER = outbound('APPEAL_OF', 'judgments');
export const LATER = inbound('APPEAL_OF', 'judgments');
/** The conclusie on a judgment, and the arrest a conclusie is for. */
export const CONCLUSION = inbound('ADVISES_ON', 'judgments');
export const ADVISED = outbound('ADVISES_ON', 'judgments');

const first = (light: NodeGraph | null, bak: typeof EARLIER) => findBucket(light, bak)?.items?.[0];

/**
 * An eerdere aanleg the source names but the data lacks (`unresolved_appeal_targets`), as
 * text: "Rechtbank Gelderland, 9 juli 2025, 24/6811".
 */
function notInData(props: Record<string, unknown>): Laag[] {
	const targets = Array.isArray(props.unresolved_appeal_targets)
		? (props.unresolved_appeal_targets as Record<string, unknown>[])
		: [];
	return targets.map((t) => {
		const naam = [
			capitalize(textOf(t.court) ?? ''),
			textOf(t.date) ? langeDatum(textOf(t.date)!) : null,
			textOf(t.case_number)
		]
			.filter(Boolean)
			.join(', ');
		return { soort: 'Eerdere aanleg, niet in de gegevens', naam };
	});
}

/** The chain of the light node, this uitspraak in its place; empty without instances. */
function chain(props: Record<string, unknown>, light: NodeGraph | null) {
	const earlier = [...notInData(props), ...laagOf(first(light, EARLIER), 'Eerdere aanleg')];
	const later = laagOf(first(light, LATER), 'Hoger beroep of cassatie');
	if (earlier.length + later.length === 0) return { earlier, gang: [] };
	// This one's outcome, after the remedy its edge to the eerdere aanleg names.
	const eigen = uitkomstVan(props.outcome, first(light, EARLIER)?.meta?.procedure_type);
	const self: Laag = {
		soort: 'Deze uitspraak',
		naam: 'deze uitspraak',
		kort: 'deze',
		huidig: true,
		...(eigen ? { uitkomst: eigen } : {})
	};
	return { earlier, gang: [...earlier, self, ...later] };
}

const laagOf = (n: Neighbor | undefined, soort: string): Laag[] => (n ? [laagVan(n, soort)] : []);

/** The line Procesgang, the instances before the eerdere aanleg asked when the band is there. */
export function procesgangLine(props: Record<string, unknown>, light: NodeGraph | null): Regel[] {
	const { earlier, gang } = chain(props, light);
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
	if (!original || !key || chain(props, light).gang.length) return [];
	return [
		{
			id: 'vertaling',
			label: 'Vertaling van',
			lagen: [{ soort: 'Origineel', naam: original, ref: { collection: 'judgments', key } }],
			laad: async () => {
				const l = await ifExists(getNodeFirst('judgments', key));
				return l?.node
					? [laagVan({ ...l.node, collection: 'judgments' } as Neighbor, 'Origineel')]
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
async function eerdereAanleg(key: string): Promise<Laag[]> {
	const keten: Laag[] = [];
	let k = key;
	for (let i = 0; i < 3; i++) {
		const n = first(await ifExists(getNodeFirst('judgments', k)), EARLIER);
		if (!n) break;
		keten.unshift(laagVan(n, 'Eerdere aanleg'));
		k = n.key;
	}
	return keten;
}

/**
 * The procesgang of another judgment, with that judgment as a link in its place: for a
 * translation, its original's. Its light node and those before it, cached.
 */
async function procesgangVan(key: string): Promise<Laag[]> {
	const light = await ifExists(getNodeFirst('judgments', key));
	if (!light?.node) return [];
	const eerder = first(light, EARLIER);
	const later = first(light, LATER);
	if (!eerder && !later) return [];
	const zelf = laagVan({ ...light.node, collection: 'judgments' } as Neighbor, 'Het origineel');
	return [
		...(eerder ? [...(await eerdereAanleg(eerder.key)), laagVan(eerder, 'Eerdere aanleg')] : []),
		zelf,
		...laagOf(later, 'Hoger beroep of cassatie')
	];
}

const ids = (lagen: Laag[]) =>
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
