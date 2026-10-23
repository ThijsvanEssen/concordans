import { outcomeWord } from '$lib/text/outcome';
import { capitalize } from '$lib/text/words';
import type { Schema } from '$lib/api/types';
import { OUTCOME_LABEL, type Outcome } from '$lib/votes/stages';

// A decision as the Tweede Kamer records it (API 0.52): `kind` the Zaak.Soort of what was
// decided (`Motie`, `Amendement`, `Wetgeving`, …, or none), `decision_kind` the BesluitSoort
// (`Stemmen - aangenomen`, `Stemmen - zonder stemming aannemen`, …). A hamerstuk is passed
// without a vote: no tally, no voters.

type Decision = Pick<Schema<'DecisionSummaryDTO'>, 'kind' | 'decision_kind' | 'passed'>;

/** A decision on no zaak: the former `overig`. */
export const NO_DECISION_KIND = 'Overig';

const HAMMER = 'Stemmen - zonder stemming aannemen';

/** Passed without a vote: a hamerstuk. */
export const isHammer = (d: Partial<Pick<Decision, 'decision_kind'>>) => d.decision_kind === HAMMER;

/** The BesluitSoort that says the outcome where `passed` does not. */
const KIND_RESULT: Record<string, Outcome> = {
	'Stemmen - aangenomen': 'aangenomen',
	'Stemmen - verworpen': 'verworpen'
};

/**
 * What was decided: aangenomen (a hamerstuk too) or verworpen, by `passed` or else the
 * BesluitSoort; null for a decision that is no vote (`Stemmen - uitstellen`).
 */
export function decisionResult(d: Partial<Decision>): Outcome | null {
	if (isHammer(d) || d.passed === true) return 'aangenomen';
	if (d.passed === false) return 'verworpen';
	return KIND_RESULT[d.decision_kind ?? ''] ?? null;
}

/**
 * The outcome in a word: `Aangenomen`, `Verworpen`, `Aangenomen zonder stemming`, or for a
 * decision that is no vote the Kamer's own word after the dash (`Stemmen - uitstellen`
 * gives `Uitstellen`).
 */
export function decisionOutcome(d: Decision): string | null {
	if (isHammer(d)) return outcomeWord(true, 'zonder stemming');
	const result = decisionResult(d);
	if (result) return OUTCOME_LABEL[result];
	const rest = d.decision_kind?.replace(/^Stemmen\s*-\s*/i, '').trim();
	return rest ? capitalize(rest) : null;
}

/**
 * How the Eerste Kamer decided, in its own words without the outcome it adds after the comma:
 * `Stemming bij zitten en opstaan, aangenomen` gives `Stemming bij zitten en opstaan`.
 */
export const decisionMethod = (d: { method?: string | null }): string | null =>
	d.method?.replace(/,\s*(aangenomen|verworpen)\s*$/i, '').trim() || null;
