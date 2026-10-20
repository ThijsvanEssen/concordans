// A judgment on its official site, and the credit its publisher asks under its text. The
// European courts alike: the EHRM on HUDOC, the courts of the EU on EUR-Lex.

type JudgmentSource = {
	source?: string | null;
	ecli?: string | null;
	official_url?: string | null;
};

/**
 * The official page as the API gives it (API 0.71: uitspraken.rechtspraak.nl, HUDOC, EUR-Lex);
 * without one, a judgment of the Rechtspraak by its deeplink and one of the courts of the EU
 * by its ECLI on EUR-Lex.
 */
export function officialPage(j: JudgmentSource): string | null {
	if (j.official_url) return j.official_url;
	if (!j.ecli) return null;
	const ecli = encodeURIComponent(j.ecli);
	if (j.source === 'rechtspraak') return `https://deeplink.rechtspraak.nl/uitspraak?id=${ecli}`;
	if (j.source === 'cjeu')
		return `https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=ecli:${ecli}`;
	return null;
}

/** The credit under a text of the Court: the terms of HUDOC and the legal notice of EUR-Lex. */
const CREDIT: Record<string, string> = {
	echr: 'Tekst: © ECHR-CEDH, uit HUDOC.',
	cjeu: 'Tekst: © Europese Unie, uit EUR-Lex.'
};

export const sourceCredit = (j: JudgmentSource): string | null =>
	(j.source && CREDIT[j.source]) || null;
