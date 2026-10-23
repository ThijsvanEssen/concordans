// How an instance of a procesgang ended, in the band's words; one source for the band
// (behoort-layer, behoort-procesgang) and the first paint of a judgment ($lib/first-paint).
import { textOf } from '$lib/text/words';

/**
 * How a judgment ended, as the band names it beside the instance: its `outcome`, after the
 * remedy that brought it there where the edge names one (`cassatie verworpen`). Null while the
 * data says none.
 */
export function outcomeOf(outcome: unknown, procedure?: unknown): string | null {
	const o = textOf(outcome);
	if (!o) return null;
	const p = textOf(procedure)?.toLowerCase();
	return p ? `${p} ${o}` : o;
}
