import { joinAnd } from '$lib/text/words';
// How a judgment or conclusion ended, in the words of its status line (API 0.79.55): what a
// conclusion proposes ("strekt tot verwerping") and what the ECHR found per article
// ("geen schending van art. 8"). Source values only; nothing when the data says none.

/** What a conclusion of the A-G or P-G proposes: `strekt tot verwerping`. */
export const strekking = (outcome: string | null | undefined): string | null =>
	outcome?.trim() ? `strekt tot ${outcome.trim()}` : null;

type Bevinding = {
	article: string;
	protocol?: string | null;
	combined_with?: string | null;
	finding: string;
	aspect?: string | null;
};

/** One finding: `schending van art. 13 in samenhang met art. 8`, `geen schending van art. 1
 *  van Protocol nr. 1`, `schending van art. 2 (procedureel)`. */
function bevinding(b: Bevinding): string {
	const artikel = `art. ${b.article}${b.protocol ? ` van Protocol nr. ${b.protocol}` : ''}`;
	const samen = b.combined_with ? ` in samenhang met art. ${b.combined_with}` : '';
	const aspect = b.aspect ? ` (${b.aspect})` : '';
	return `${b.finding} van ${artikel}${samen}${aspect}`;
}

/** What the ECHR found, in the order of HUDOC: `schending van art. 8; geen schending van art. 6`. */
export const bevindingen = (bs: readonly Bevinding[] | null | undefined): string | null =>
	(bs ?? []).map(bevinding).join('; ') || null;

/** The first letter up, for the start of a sentence. */

/**
 * What the Rechtspraak gives of the field a judgment is in, for its status line (API 0.80.7): the
 * main areas of law (`Strafrecht`, two as `Strafrecht en Civiel recht`), the procedure
 * (`Cassatie`) and the chamber the kop names (`Strafkamer`). Each only where the data has it.
 */
export const kenmerken = (j: {
	subject_areas?: readonly string[] | null;
	procedure?: string | null;
	chamber?: string | null;
}): string[] => {
	const areas = (j.subject_areas ?? []).filter((a) => a.trim());
	return [areas.length ? joinAnd(areas) : null, j.procedure?.trim(), j.chamber?.trim()].filter(
		(x): x is string => !!x
	);
};
