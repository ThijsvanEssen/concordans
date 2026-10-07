// A title that names only the kind of a bron says little: "Brief", "Verslag", "Motie",
// "Blanco verslag". Where it is all the source gives, a name adds what tells the bron apart
// (its number, its date). Deciding that is presentation, not a fact: the words stay the source's.

/** Titles that name a kind of paper, activity or decision, as the Kamers write them. */
const SOORTWOORDEN = new Set([
	'brief',
	'brief regering',
	'aanbiedingsbrief',
	'motie',
	'amendement',
	'verslag',
	'blanco verslag',
	'tweede verslag',
	'nota',
	'nota van wijziging',
	'nota naar aanleiding van het verslag',
	'nota naar aanleiding van het tweede verslag',
	'voorstel van wet',
	'gewijzigd voorstel van wet',
	'memorie van toelichting',
	'memorie van antwoord',
	'eindtekst',
	'bijgewerkte tekst',
	'sprekerslijst',
	'agenda procedurevergadering',
	'besluit',
	'besluitenlijst',
	'activiteit',
	'stemming',
	'stemmingen',
	'plenair debat',
	'plenaire vergadering',
	'commissiedebat',
	'procedurevergadering',
	'uitspraak',
	'stuk',
	'document',
	'overig',
	'overige kamerstukken'
]);

/** Lower case, without what is between brackets, a trailing number or punctuation. */
const kern = (s: string) =>
	s
		.toLowerCase()
		.replace(/\([^)]*\)/g, ' ')
		.replace(/[\s,.:;]*(nr\.?\s*)?[\w-]*\d[\w-]*$/, '')
		.replace(/[\s,.:;]+$/, '')
		.replace(/\s+/g, ' ')
		.trim();

/**
 * Whether a title only names the kind: empty, the kind itself (`Verslag` for a Verslag, `Nota
 * naar aanleiding van het verslag` for a Nota n.a.v. het verslag), or a word of a kind with at
 * most a number. A title with a subject, a sender or a submitter is not generic.
 */
export function isGeneriek(titel: string | null | undefined, soort?: string | null): boolean {
	const t = kern(titel ?? '');
	if (!t) return true;
	if (SOORTWOORDEN.has(t)) return true;
	const s = kern(soort ?? '');
	return !!s && (t === s || s.startsWith(`${t} `));
}

/**
 * The papers of a bill that carry the bill's own title: the voorstel, its toelichting, the
 * nota's and verslagen, the advies, the eindtekst. Within a dossier that title is the same for
 * all of them; the kind and the number tell them apart.
 */
const WETSTITEL =
	/^(gewijzigd |nader gewijzigd )?voorstel van wet|^memorie van|^nota (van wijziging|naar aanleiding|n\.a\.v\.)|^(eind|tweede |nader |blanco )?verslag|^advies (afdeling|raad van state)|^nader rapport|^eindtekst|^bijgewerkte tekst|^koninklijke boodschap/i;

export const draagtWetstitel = (soort: string | null | undefined): boolean =>
	!!soort && WETSTITEL.test(soort.trim());
