// The outcome of a vote in words, in one place: `Aangenomen`, `Verworpen`, and how it was
// decided after it: `Aangenomen zonder stemming`, `Aangenomen als hamerstuk` (E9 E). A
// capital at the start of a line, lower case in a sentence; the way never before the word.
export type Uitkomst = 'aangenomen' | 'verworpen' | 'ingetrokken';

export const OUTCOME_LABELS: Record<Uitkomst, string> = {
	aangenomen: 'Aangenomen',
	verworpen: 'Verworpen',
	// Withdrawn by letter (API 0.80.1, #857): `withdrawal_letter`, its day `closed_on`.
	ingetrokken: 'Ingetrokken'
};

/**
 * The word of a vote that passed (true) or failed (false), with the way it was decided
 * after it (`zonder stemming`); null where the source says neither.
 */
export function outcomeWord(
	passed: boolean | null | undefined,
	how?: string | null,
	lower = false
): string | null {
	if (passed == null) return null;
	const word = OUTCOME_LABELS[passed ? 'aangenomen' : 'verworpen'];
	const text = [word, how].filter(Boolean).join(' ');
	return lower ? text.toLowerCase() : text;
}
