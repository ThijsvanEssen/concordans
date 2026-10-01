// The name of a stemming in a list, where its title is a link and cannot be empty. The
// subject comes first; without one, the dossier it was held in; without that, the plain fact.
export function stemmingNaam(subject: string | null | undefined, dossier?: string | null): string {
	if (subject?.trim()) return subject;
	if (dossier) return `Stemming over ${dossier}`;
	return 'Stemming, onderwerp niet in de gegevens';
}
