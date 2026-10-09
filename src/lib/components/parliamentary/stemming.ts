import { dossierLabel, type DossierNaamBron } from '$lib/bron/dossier-naam';

// The name of a stemming in a list, where its title is a link and cannot be empty. The
// subject comes first; without one, the dossier it was held in, by number and name; without
// that, the plain fact.
export function stemmingNaam(
	subject: string | null | undefined,
	dossier?: DossierNaamBron | string | null
): string {
	if (subject?.trim()) return subject;
	if (dossier)
		return `Stemming over ${dossierLabel(typeof dossier === 'string' ? { number: dossier } : dossier)}`;
	return 'Stemming, onderwerp niet in de gegevens';
}
