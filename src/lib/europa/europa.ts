// What the page Europa reads from a title, and the official addresses it leads to. A link is
// built only where the title names the act: no number, no link, never a guess.

/** The title of an EU dossier without the Kamer's label: "EU-voorstel: Omnibus …" is "Omnibus …". */
export const euTitle = (title: string): string =>
	title
		.replace(/^EU-voorstel(?:len)?:\s*/i, '')
		.replace(/\s+/g, ' ')
		.trim();

/** The first COM document a title names (`COM (2026) 560`, `COM(2026)101`), or null. */
export function comOf(title: string): { year: string; number: string } | null {
	const m = /COM\s*\(\s*(\d{4})\s*\)\s*(\d+)/i.exec(title);
	return m ? { year: m[1], number: m[2] } : null;
}

/** The first act of the form `Richtlijn (EU) 2024/1640` or `Verordening (EU) 2022/2065`, or null. */
export function actOf(title: string): { kind: 'dir' | 'reg'; year: string; number: string } | null {
	const m = /(richtlijn|verordening)\s*\(EU\)\s*(\d{4})\/(\d+)/i.exec(title);
	return m
		? { kind: m[1].toLowerCase() === 'richtlijn' ? 'dir' : 'reg', year: m[2], number: m[3] }
		: null;
}

/** The proposal on EUR-Lex, by its COM number. */
export const eurLexCom = (c: { year: string; number: string }) =>
	`https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=COM:${c.year}:${c.number}:FIN`;

/** The act on EUR-Lex, by its ELI. */
export const eurLexAct = (a: { kind: 'dir' | 'reg'; year: string; number: string }) =>
	`https://eur-lex.europa.eu/eli/${a.kind}/${a.year}/${a.number}/oj/nld`;

/** The Parliament's tracker of proposals, where it follows them (one address: no page per proposal is known). */
export const LEGISLATIVE_TRAIN = 'https://www.europarl.europa.eu/legislative-train/';

/** The court of a judgment of the Union by its code in the ECLI (`ECLI:EU:C:…`, `ECLI:EU:T:…`). */
export const courtName = (code: string | null | undefined): string =>
	code === 'T' ? 'Gerecht van de EU' : code === 'C' ? 'Hof van Justitie' : 'Europese rechter';
