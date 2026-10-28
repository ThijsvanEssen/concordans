// How a judgment that cites an article ended, in the words of its row (`cited-by`: `outcome`,
// `outcome_text`, `conclusion_outcome`). Source values only; where the data says none, the row
// says so (`Uitkomst niet vastgesteld`), never nothing. In a strafzaak the first clause of the
// dictum of a hof or the Hoge Raad (`vernietigd`) or a rechtbank (`niet-ontvankelijk`) is no verdict: it is
// shown as what it is, with the words that say it says nothing of a conviction.
import { strekking } from '$lib/text/judgment-outcome';
import { capitalize } from '$lib/text/words';

export const NIET_VASTGESTELD = 'Uitkomst niet vastgesteld';

/** The outcome of a row: its words, the clause that says it (hover), and whether the data says one. */
export type CitedOutcome = { text: string; title: string | null; vastgesteld: boolean };

type Bron = {
	outcome?: string | null;
	outcome_text?: string | null;
	conclusion_outcome?: string | null;
	tier?: string | null;
};

/** In a strafzaak, per tier, the outcome that is no verdict and the words that say what it is. */
const STRAF_NEUTRAAL: Record<string, Record<string, string>> = {
	gerechtshof: { vernietigd: 'Vonnis vernietigd, zegt niets over veroordeling' },
	hoge_raad: {
		vernietigd: 'Uitspraak vernietigd, zegt niets over veroordeling',
		'vernietigd en verwezen': 'Uitspraak vernietigd en verwezen, zegt niets over veroordeling',
		'gedeeltelijk vernietigd': 'Uitspraak gedeeltelijk vernietigd, zegt niets over veroordeling'
	},
	rechtbank: { 'niet-ontvankelijk': 'Begint met niet-ontvankelijk, zegt niets over veroordeling' }
};

/** Whether the judgments of a group are strafzaken: the filter Strafrecht, else most of them by the facet. */
export function isStrafGroep(
	area: string | null | undefined,
	facet: readonly { value?: string | null; count: number }[] | null | undefined,
	total: number
): boolean {
	if (area) return area === 'Strafrecht';
	const straf = (facet ?? []).find((f) => f.value === 'Strafrecht')?.count ?? 0;
	return total > 0 && straf * 2 > total;
}

export function citedOutcome(j: Bron, straf: boolean): CitedOutcome {
	const title = j.outcome_text?.trim() || null;
	if (j.outcome) {
		const neutraal = straf ? STRAF_NEUTRAAL[j.tier ?? '']?.[j.outcome] : undefined;
		return { text: neutraal ?? capitalize(j.outcome), title, vastgesteld: true };
	}
	const conclusie = strekking(j.conclusion_outcome);
	if (conclusie) return { text: capitalize(conclusie), title, vastgesteld: true };
	return { text: NIET_VASTGESTELD, title: null, vastgesteld: false };
}
