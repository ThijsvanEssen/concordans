// Plain-Dutch glossary for the kind of a kamerstuk: each term termOfKind gives maps to a long
// form and a one-line explanation, which GlossaryPill shows in a popover. Keep the explanation
// under 140 characters.

export interface GlossaryEntry {
	/** Full expansion of the term. */
	full: string;
	/** One-line plain-Dutch explanation. */
	plain: string;
}

export const GLOSSARY = {
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
	Amendement: {
		full: 'Amendement',
		plain:
			'Voorstel van een lid van de Tweede Kamer om de tekst van een wetsvoorstel te wijzigen voordat erover gestemd wordt.'
	},
	Motie: {
		full: 'Motie',
		plain: 'Uitspraak van een Kamer waarmee zij de regering om iets vraagt; geen bindende wet.'
	},
	Initiatiefnota: {
		full: 'Initiatiefnota',
		plain:
			'Beleidsvoorstel van een of meer leden van de Tweede Kamer, zonder wetsvoorstel. Doorloopt geen wetgevingsfasen.'
	}
} satisfies Record<string, GlossaryEntry>;

export type GlossaryTerm = keyof typeof GLOSSARY;

/**
 * The glossary term for the kind of a kamerstuk, as the source words it: `Nota van wijziging
 * (initiatiefvoorstel)` is a nota van wijziging, not the nota naar aanleiding van het
 * verslag; a memorie van antwoord is no memorie van toelichting.
 */
export function termOfKind(kind: string | null | undefined): GlossaryTerm | null {
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
