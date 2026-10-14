// How a judgment or conclusion ended, in the words of its status line (API 0.79.55): what a
// conclusion proposes ("strekt tot verwerping") and what the ECHR found per article
// ("geen schending van art. 8"). Source values only; nothing when the data says none.

/** What a conclusion of the A-G or P-G proposes: `strekt tot verwerping`. */
export const strekking = (outcome: string | null | undefined): string | null =>
	outcome?.trim() ? `strekt tot ${outcome.trim()}` : null;

export type Bevinding = {
	article: string;
	protocol?: string | null;
	combined_with?: string | null;
	finding: string;
	aspect?: string | null;
};

/** One finding: `schending van art. 13 in samenhang met art. 8`, `geen schending van art. 1
 *  van Protocol nr. 1`, `schending van art. 2 (procedureel)`. */
export function bevinding(b: Bevinding): string {
	const artikel = `art. ${b.article}${b.protocol ? ` van Protocol nr. ${b.protocol}` : ''}`;
	const samen = b.combined_with ? ` in samenhang met art. ${b.combined_with}` : '';
	const aspect = b.aspect ? ` (${b.aspect})` : '';
	return `${b.finding} van ${artikel}${samen}${aspect}`;
}

/** What the ECHR found, in the order of HUDOC: `schending van art. 8; geen schending van art. 6`. */
export const bevindingen = (bs: readonly Bevinding[] | null | undefined): string | null =>
	(bs ?? []).map(bevinding).join('; ') || null;

/** The first letter up, for the start of a sentence. */
