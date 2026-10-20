// The judgment as its heading cites it, from the API's `cite` (API 0.79.60). Pure: the
// canvas, the previews and Behoort bij read it without the overwegingen of judgment-cite.
import type { Schema } from '$lib/api/types';
import { isEuCourt } from './ecli';
import { textOf } from './words';

export type Cite = Schema<'JudgmentCiteDTO'>;

/** What a judgment gives to cite it: its `cite`, and of a court of the EU its case number. */
export type HeadingSource = {
	ecli?: string | null;
	cite?: Cite | null;
	/** A light node or a list row has it in its props, the detail beside them. */
	case_number?: string | null;
	props?: Record<string, unknown> | null;
};

const caseNumberOf = (j: HeadingSource): string | null =>
	textOf(j.case_number) ?? textOf(j.props?.case_number);

/**
 * The judgment as its heading cites it (HR 19 juli 2019, …); null where the API gives none.
 * A judgment of the courts of the EU is cited with its case number after the day, as the
 * Court is cited in Dutch: `HvJ EU 22 juni 2023, C-160/20, ECLI:EU:C:2023:494`.
 */
export function headingCite(j: HeadingSource): Cite | null {
	const cite = j.cite ?? null;
	const ecli = j.ecli ?? textOf(j.props?.ecli);
	const caseNumber = cite && isEuCourt(ecli) ? caseNumberOf(j) : null;
	if (!cite || !caseNumber || cite.short.includes(caseNumber)) return cite;
	return {
		short: `${cite.short}, ${caseNumber}`,
		full: cite.full.startsWith(cite.short)
			? `${cite.short}, ${caseNumber}${cite.full.slice(cite.short.length)}`
			: cite.full
	};
}
