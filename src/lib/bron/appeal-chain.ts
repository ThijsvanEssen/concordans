// The procesgang of a judgment as its light node gives it: eerdere aanleg › this uitspraak ›
// hoger beroep or cassatie, an eerdere aanleg the data lacks by its name. Without the client:
// the band asks the instances before the eerdere aanleg (behoort-procesgang), the first
// paint has them from the server.
import { NOT_IN_DATA } from '$lib/text/coverage';
import { capitalize, textOf } from '$lib/text/words';
import { findBucket } from '$lib/api/buckets';
import type { NodeGraph, Neighbor } from '$lib/api/nodes';
import { langeDatum } from '$lib/text/datum';
import { inbound, layerOf, outbound, type Layer } from './behoort-layer';
import { outcomeOf } from './outcome-words';

export const EARLIER = outbound('APPEAL_OF', 'judgments');
export const LATER = inbound('APPEAL_OF', 'judgments');
/** The conclusie on a judgment, and the arrest a conclusie is for. */
export const CONCLUSION = inbound('ADVISES_ON', 'judgments');
export const ADVISED = outbound('ADVISES_ON', 'judgments');

export const first = (light: NodeGraph | null, bak: typeof EARLIER) =>
	findBucket(light, bak)?.items?.[0];

/**
 * An eerdere aanleg the source names but the data lacks (`unresolved_appeal_targets`), as
 * text: "Rechtbank Gelderland, 9 juli 2025, 24/6811".
 */
function notInData(props: Record<string, unknown>): Layer[] {
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
		return { soort: `Eerdere aanleg, ${NOT_IN_DATA}`, naam };
	});
}

/** The chain of the light node, this uitspraak in its place; empty without instances. */
export function appealChain(props: Record<string, unknown>, light: NodeGraph | null) {
	const earlier = [...notInData(props), ...asLayers(first(light, EARLIER), 'Eerdere aanleg')];
	const later = asLayers(first(light, LATER), 'Hoger beroep of cassatie');
	if (earlier.length + later.length === 0) return { earlier, gang: [] };
	// This one's outcome, after the remedy its edge to the eerdere aanleg names.
	const own = outcomeOf(props.outcome, first(light, EARLIER)?.meta?.procedure_type);
	const self: Layer = {
		soort: 'Deze uitspraak',
		// Whole on a phone too: "deze" alone read as cut off (UX-toets B4).
		naam: 'deze uitspraak',
		huidig: true,
		...(own ? { uitkomst: own } : {})
	};
	return { earlier, gang: [...earlier, self, ...later] };
}

export const asLayers = (n: Neighbor | undefined, soort: string): Layer[] =>
	n ? [layerOf(n, soort)] : [];
