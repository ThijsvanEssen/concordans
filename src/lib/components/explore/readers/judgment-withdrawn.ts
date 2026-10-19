// A judgment the Rechtspraak withdrew (API 0.79.62, #761): a stub with the facts of the decision
// that name no one, without text, parties or citations of its own. The reader says why
// instead of showing empty blocks; what cites it stays in Verbonden.
import type { Schema } from '$lib/api/types';
import { ecliKey } from '$lib/bron/address';

type Judgment = Pick<
	Schema<'JudgmentDTO'>,
	'withdrawn' | 'withdrawn_on' | 'replaced_by' | 'replaced_by_id'
>;

type Withdrawal = {
	/** Ingetrokken door de bron op 3 oktober 2026; ECLI vervallen. */
	text: string;
	/** The ECLI the source names instead of one given in error, with its node id. */
	replacement: { ecli: string; ref: string } | null;
};

/**
 * What the reader says of a withdrawn judgment, its day as `longDate` writes it (langeDatum);
 * null for one that is published.
 */
export function withdrawal(
	j: Judgment,
	longDate: (iso: string | null) => string
): Withdrawal | null {
	if (!j.withdrawn) return null;
	if (j.withdrawn === 'ecli') {
		const ecli = j.replaced_by?.trim() || null;
		return {
			text: 'ECLI vervallen',
			replacement: ecli ? { ecli, ref: j.replaced_by_id ?? `judgments/${ecliKey(ecli)}` } : null
		};
	}
	const day = j.withdrawn_on ? longDate(j.withdrawn_on) : '';
	return {
		text: day ? `Ingetrokken door de bron op ${day}` : 'Ingetrokken door de bron',
		replacement: null
	};
}
