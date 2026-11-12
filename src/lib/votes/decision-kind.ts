import { outcomeWord } from '$lib/text/outcome';
import { capitalize } from '$lib/text/words';
import type { Outcome } from '$lib/votes/stages';

// A decision as the Tweede Kamer records it (API 0.52): `kind` the Zaak.Soort of what was
// decided (`Motie`, `Amendement`, `Wetgeving`, …, or none), `decision_kind` the BesluitSoort
// (`Stemmen - aangenomen`, `Stemmen - zonder stemming aannemen`, …). A hamerstuk is passed
// without a vote: no tally, no voters.

/** A decision on no zaak: the former `overig`. */
export const NO_DECISION_KIND = 'Overig';

const HAMMER = 'Stemmen - zonder stemming aannemen';

/** Passed without a vote: a hamerstuk. */
export const isHammer = (d: DecisionSource) => d.decision_kind === HAMMER;

/** The BesluitSoort that says the outcome where `passed` does not. */
const KIND_RESULT: Record<string, boolean> = {
	'Stemmen - aangenomen': true,
	'Stemmen - verworpen': false
};

/**
 * The word of a decision that is no vote, as the Kamer names it in its BesluitSoort
 * (`Stemmen - uitstellen`, `Aanhouden`): a participle like aangenomen and verworpen, so it reads
 * alone ("Uitgesteld") and in a sentence ("uitgesteld op 22 september") alike. The API's own
 * `outcome` uses the same words.
 */
const NO_VOTE_WORD: [RegExp, string][] = [
	[/ingetrokken|intrekken/, 'ingetrokken'],
	[/aangehouden|aanhouden/, 'aangehouden'],
	[/uitgesteld|uitstellen/, 'uitgesteld'],
	[/vervallen|vervalt/, 'vervallen']
];

/** The word of a decision that is no vote; another kind by the part after its dash. */
function noVoteWord(kind: string): string | null {
	const k = kind.trim().toLowerCase();
	const word = NO_VOTE_WORD.find(([re]) => re.test(k))?.[1];
	if (word) return word;
	const part = k.split(/\s*-\s*/).at(-1) ?? '';
	return part && !/gestemd|stemmen|aangenomen|verworpen/.test(part) ? part : null;
}

/** What the source gives of a decision, as the API, a timeline entry or a node's props carry it. */
type DecisionSource = { passed?: unknown; result?: unknown; decision_kind?: unknown };

type Reading = {
	/** Aangenomen (true, a hamerstuk too), verworpen (false), or no vote (null). */
	passed: boolean | null;
	/** Passed without a vote. */
	hammer: boolean;
	/** In lower case: `aangenomen`, `verworpen`, `aangenomen zonder stemming`, `uitgesteld`, … */
	word: string | null;
};

/**
 * The outcome of a decision, in one reading of all the source gives: `passed` (the Tweede
 * Kamer), `result` (the Eerste Kamer: `Aangenomen`, `Verworpen`) and the BesluitSoort
 * (`decision_kind`: a hamerstuk, or the word of a decision that is no vote). A missing value is
 * no "aangenomen".
 */
export function uitslag(d: DecisionSource): Reading {
	const kind = typeof d.decision_kind === 'string' ? d.decision_kind : '';
	const hammer = isHammer(d);
	const passed =
		hammer || d.passed === true || d.result === 'Aangenomen'
			? true
			: d.passed === false || d.result === 'Verworpen'
				? false
				: (KIND_RESULT[kind] ?? null);
	const word =
		passed === null
			? noVoteWord(kind)
			: outcomeWord(passed, hammer ? 'zonder stemming' : null, true);
	return { passed, hammer, word };
}

/**
 * What was decided: aangenomen (a hamerstuk too) or verworpen; null for a decision that is
 * no vote (`Stemmen - uitstellen`).
 */
export function decisionResult(d: DecisionSource): Outcome | null {
	const { passed } = uitslag(d);
	return passed === null ? null : passed ? 'aangenomen' : 'verworpen';
}

/**
 * The outcome in a word: `Aangenomen`, `Verworpen`, `Aangenomen zonder stemming`, or for a
 * decision that is no vote its own word (`Stemmen - uitstellen` gives `Uitgesteld`).
 */
export function decisionOutcome(d: DecisionSource): string | null {
	const { word } = uitslag(d);
	return word ? capitalize(word) : null;
}

/**
 * How the Eerste Kamer decided, in its own words without the outcome it adds after the comma:
 * `Stemming bij zitten en opstaan, aangenomen` gives `Stemming bij zitten en opstaan`.
 */
export const decisionMethod = (d: { method?: string | null }): string | null =>
	d.method?.replace(/,\s*(aangenomen|verworpen)\s*$/i, '').trim() || null;
