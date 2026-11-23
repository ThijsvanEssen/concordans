// What the page Europa shows of the EU, and the official addresses it leads to. A link is built
// from what the API names (the COM number, the CELEX number): none named, no link, never a guess.

/** The title of an EU dossier without the Kamer's label: "EU-voorstel: Omnibus …" is "Omnibus …". */
export const euTitle = (title: string): string =>
	title
		.replace(/^EU-voorstel(?:len)?:\s*/i, '')
		.replace(/\s+/g, ' ')
		.trim();

/** The proposal on EUR-Lex, by its COM number as the API gives it (`COM(2025) 80`); null for another form. */
export function eurLexCom(com: string): string | null {
	const m = /^COM\s*\(\s*(\d{4})\s*\)\s*(\d+)$/i.exec(com.trim());
	return m ? `https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=COM:${m[1]}:${m[2]}:FIN` : null;
}

/** The act of a CELEX number (`32024L2811`): its kind and its number (`2024/2811`), or null for another sector. */
export function actOfCelex(
	celex: string
): { kind: 'Richtlijn' | 'Verordening'; number: string } | null {
	const m = /^3(\d{4})([LR])(\d{4})$/.exec(celex);
	return m
		? {
				kind: m[2] === 'L' ? 'Richtlijn' : 'Verordening',
				number: `${m[1]}/${Number(m[3])}`
			}
		: null;
}

/** The text of an act on EUR-Lex, by its CELEX number. */
export const eurLexCelex = (celex: string) =>
	`https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:${celex}`;

/** The Parliament's tracker of proposals, where it follows them (one address: no page per proposal is known). */
export const LEGISLATIVE_TRAIN = 'https://www.europarl.europa.eu/legislative-train/';

/** The court of a judgment of the Union by its code in the ECLI (`ECLI:EU:C:…`, `ECLI:EU:T:…`). */
export const unionCourt = (code: string | null | undefined): string =>
	code === 'T' ? 'Gerecht van de EU' : code === 'C' ? 'Hof van Justitie' : 'Europese rechter';

/**
 * What kind of act a proposal is, as its title says: a communication (`Commissiemededeling`,
 * `Gezamenlijke mededeling`), a decision of the Council, else a proposal, as the Kamer names it.
 */
export function proposalKind(title: string): 'Mededeling' | 'Raadsbesluit' | 'Voorstel' {
	const t = euTitle(title);
	if (/mededeling/i.test(t)) return 'Mededeling';
	if (/^besluit van de raad|^raadsbesluit/i.test(t)) return 'Raadsbesluit';
	return 'Voorstel';
}

/** The case number of a judgment of the Union as its citation gives it (`C-216/25`), or null. */
export const unionCaseNumber = (cite: string | null | undefined): string | null =>
	/\b([CT]-\d+\/\d+)\b/.exec(cite ?? '')?.[1] ?? null;

/** The judgment on EUR-Lex, by its ECLI. */
export const eurLexEcli = (ecli: string) =>
	`https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=ecli:${ecli}`;
