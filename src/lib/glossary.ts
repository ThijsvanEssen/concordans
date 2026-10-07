// Plain-Dutch glossary for the readers. Each entry maps a short term (acronym
// or jargon as it appears in the corpus) to a long form and a one-line
// explanation. GlossaryPill.svelte wraps a term with a popover that shows both.
// Keep the explanation under 140 characters.

export interface GlossaryEntry {
	/** Full expansion of the term. */
	full: string;
	/** One-line plain-Dutch explanation. */
	plain: string;
}

const ENTRIES: Record<string, GlossaryEntry> = {
	// Wetgevingsfasen
	MvT: {
		full: 'Memorie van Toelichting',
		plain:
			'Toelichtende tekst die de regering bij een wetsvoorstel meestuurt om de bedoeling en achtergrond uit te leggen.'
	},
	Verslag: {
		full: 'Verslag van een Kamercommissie',
		plain: 'Schriftelijke vragen en commentaar van een Kamer op een wetsvoorstel.'
	},
	Nota: {
		full: 'Nota naar aanleiding van het verslag',
		plain:
			'Antwoord van de indiener, regering of Kamerlid, op de vragen die een Kamer in een verslag stelde.'
	},
	'Nota van wijziging': {
		full: 'Nota van wijziging',
		plain: 'Wijziging van de tekst van een wetsvoorstel door de indiener, tijdens de behandeling.'
	},
	Behandeling: {
		full: 'Mondelinge behandeling',
		plain:
			'Wetgevingsoverleg of plenair debat over het wetsvoorstel, waarin ook moties worden ingediend.'
	},
	Amendement: {
		full: 'Amendement',
		plain:
			'Voorstel van een lid van de Tweede Kamer om de tekst van een wetsvoorstel te wijzigen voordat erover gestemd wordt.'
	},
	Motie: {
		full: 'Motie',
		plain: 'Uitspraak van een Kamer waarmee zij de regering om iets vraagt; geen bindende wet.'
	},

	// Adviesorganen
	RvS: {
		full: 'Raad van State',
		plain:
			'Hoogste algemene adviseur van de regering over wetsvoorstellen; brengt verplicht advies uit voor indiening.'
	},
	'Advies RvS': {
		full: 'Advies Raad van State',
		plain:
			'Schriftelijk advies van de Raad van State over een wetsvoorstel, voordat het naar de Tweede Kamer gaat.'
	},

	// Identifiers
	BWB: {
		full: 'Basiswettenbestand',
		plain:
			'Nummer waarmee het Basiswettenbestand een regeling aanduidt, bijvoorbeeld BWBR0001854 voor het Wetboek van Strafrecht.'
	},
	ECLI: {
		full: 'European Case Law Identifier',
		plain: 'Europees nummer van een rechterlijke uitspraak, bijvoorbeeld ECLI:NL:HR:2019:1278.'
	},

	// Kamer / Procedure
	Stemming: {
		full: 'Stemming',
		plain: 'Besluit van een Kamer over een voorstel: aangenomen of verworpen.'
	},
	Toezegging: {
		full: 'Toezegging',
		plain:
			'Belofte van een bewindspersoon aan een Kamer; de Kamer houdt bij of zij wordt nagekomen.'
	},

	// Trajecten
	Initiatiefwet: {
		full: 'Initiatiefwetsvoorstel',
		plain:
			'Wetsvoorstel dat door één of meer leden van de Tweede Kamer wordt ingediend in plaats van door de regering.'
	},
	Begroting: {
		full: 'Begroting',
		plain:
			'Jaarlijks wetsvoorstel waarin de regering vastlegt hoeveel geld een ministerie het komende jaar mag uitgeven.'
	},
	Verdrag: {
		full: 'Goedkeuringswet van een verdrag',
		plain: 'Wetsvoorstel waarmee het parlement een verdrag goedkeurt.'
	},
	Initiatiefnota: {
		full: 'Initiatiefnota',
		plain:
			'Beleidsvoorstel van een of meer leden van de Tweede Kamer, zonder wetsvoorstel. Doorloopt geen wetgevingsfasen.'
	}
};

/**
 * The glossary term for the kind of a kamerstuk, as the source words it: `Nota van wijziging
 * (initiatiefvoorstel)` is a nota van wijziging, not the nota naar aanleiding van het
 * verslag; a memorie van antwoord is no memorie van toelichting.
 */
export function termOfKind(kind: string | null | undefined): string | null {
	const k = kind?.toLowerCase().trim();
	if (!k) return null;
	if (k.startsWith('memorie van toelichting') || k === 'mvt') return 'MvT';
	if (k.startsWith('nota van wijziging')) return 'Nota van wijziging';
	if (/^nota n(aar )?\.?a(anleiding )?\.?v(an )?\.?/.test(k)) return 'Nota';
	if (/^(nader |tweede nader )?verslag( \(|$)/.test(k)) return 'Verslag';
	if (k.includes('amendement')) return 'Amendement';
	if (k.includes('motie')) return 'Motie';
	if (k.startsWith('initiatiefnota')) return 'Initiatiefnota';
	return null;
}

export function lookupGlossary(term: string): GlossaryEntry | null {
	return ENTRIES[term] ?? ENTRIES[term.trim()] ?? null;
}

export function hasGlossary(term: string): boolean {
	return lookupGlossary(term) !== null;
}
