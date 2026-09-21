// Plain-Dutch glossary for the Verkenner readers. Each entry maps a short
// term (acronym / jargon as it appears in the corpus) to a long form and a
// one-liner that a non-specialist can read. GlossaryPill.svelte wraps any
// occurrence of a term with a popover that surfaces both.
//
// Add entries here as new abbreviations appear in dossier/commissie/lid/
// fractie readers. Keep the plain-Dutch line under 140 chars; this is read
// in a popover, not a textbook.

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
	Nota: {
		full: 'Nota naar aanleiding van het verslag',
		plain: 'Antwoord van de regering op vragen die de Tweede Kamer in een verslag stelde.'
	},
	Verslag: {
		full: 'Verslag van een Kamercommissie',
		plain: 'Schriftelijke vragen en commentaar van de Kamer op een wetsvoorstel.'
	},
	Amendement: {
		full: 'Amendement',
		plain:
			'Voorstel van een Kamerlid om de tekst van een wetsvoorstel te wijzigen voordat erover gestemd wordt.'
	},
	Motie: {
		full: 'Motie',
		plain: 'Uitspraak van de Kamer waarmee zij de regering om iets vraagt; geen bindende wet.'
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
		full: 'Basis Wetten Bestand',
		plain:
			'Identifier van de Nederlandse overheid voor wetten en regelingen — bv. BWBR0001854 = Wetboek van Strafrecht.'
	},
	ECLI: {
		full: 'European Case Law Identifier',
		plain:
			'Standaard-identificatie voor uitspraken van Europese en nationale rechtbanken, bv. ECLI:NL:HR:2024:123.'
	},

	// Kamer / Procedure
	Kamerstuk: {
		full: 'Kamerstuk',
		plain:
			'Officieel parlementair document; per dossier doorgenummerd (bv. 36500-7 = 7e stuk in dossier 36500).'
	},
	Stemming: {
		full: 'Stemming',
		plain:
			'Beslissingsmoment waarop de Kamer voor of tegen een voorstel stemt; uitkomst is aangenomen of verworpen.'
	},
	Toezegging: {
		full: 'Toezegging',
		plain:
			'Belofte van een minister aan de Kamer om iets te doen; wordt later opgevolgd door dezelfde commissie.'
	},

	// Trajecten
	Initiatiefwet: {
		full: 'Initiatiefwetsvoorstel',
		plain:
			'Wetsvoorstel dat door één of meer Kamerleden wordt ingediend in plaats van door de regering.'
	},
	Begroting: {
		full: 'Begroting',
		plain:
			'Jaarlijks wetsvoorstel waarin de regering vastlegt hoeveel geld een ministerie het komende jaar mag uitgeven.'
	}
};

export function lookupGlossary(term: string): GlossaryEntry | null {
	return ENTRIES[term] ?? ENTRIES[term.trim()] ?? null;
}

export function hasGlossary(term: string): boolean {
	return lookupGlossary(term) !== null;
}
