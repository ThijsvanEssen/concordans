import type { Schema } from '$lib/api/types';

// A decision as the Tweede Kamer records it (API 0.52): `kind` the Zaak.Soort of what was
// decided (`Motie`, `Amendement`, `Wetgeving`, …, or none), `decision_kind` the BesluitSoort
// (`Stemmen - aangenomen`, `Stemmen - zonder stemming aannemen`, …). A hamerstuk is passed
// without a vote: no tally, no voters.

type Decision = Pick<Schema<'DecisionSummaryDTO'>, 'kind' | 'decision_kind' | 'passed'>;

/** A decision on no zaak: the former `overig`. */
export const NO_DECISION_KIND = 'Overig';

/** The kinds of API 0.51 and before, as a link from then names them in `?soort=`. */
const OLD_KIND: Record<string, string> = {
	motie: 'Motie',
	amendement: 'Amendement',
	wetsvoorstel: 'Wetgeving'
};

/** A kind from the URL: as the Kamer writes it, or by its name before API 0.52. */
export const decisionKindFromParam = (value: string): string | undefined =>
	value && value !== 'overig' ? (OLD_KIND[value] ?? value) : undefined;

const HAMMER = 'Stemmen - zonder stemming aannemen';

/** Passed without a vote: a hamerstuk. */
export const isHammer = (d: Pick<Decision, 'decision_kind'>) => d.decision_kind === HAMMER;

/**
 * The outcome in a word: `Aangenomen`, `Verworpen`, `Zonder stemming aangenomen`, or for a
 * decision that is no vote the Kamer's own word after the dash (`Stemmen - uitstellen`
 * gives `Uitstellen`).
 */
export function decisionOutcome(d: Decision): string | null {
	if (isHammer(d)) return 'Zonder stemming aangenomen';
	if (d.passed === true) return 'Aangenomen';
	if (d.passed === false) return 'Verworpen';
	const rest = d.decision_kind?.replace(/^Stemmen\s*-\s*/i, '').trim();
	return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null;
}
