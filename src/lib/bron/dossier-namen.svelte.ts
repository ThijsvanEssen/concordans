// The name of a dossier where the response on hand lacks its short title (a node's props, the
// dossiers of a wet): what `naamVanNummer` found, kept per number and read reactively, so a
// row, a card and the network panel name it alike once it has come.
import { SvelteMap } from 'svelte/reactivity';
import { dossierName, kentKorteNaam, naamVanNummer, type DossierNaamBron } from './dossier-naam';

const gevonden = new SvelteMap<string, string | null>();
const gevraagd = new Set<string>();

/** Ask the name of a dossier once, where the data on hand does not say it. */
export function vraagDossierNaam(d: DossierNaamBron) {
	const nr = d.number.trim();
	if (!nr || kentKorteNaam(d) || gevraagd.has(nr) || typeof window === 'undefined') return;
	gevraagd.add(nr);
	void naamVanNummer(nr).then((naam) => gevonden.set(nr, naam));
}

/**
 * The name of a dossier now: the short title on hand, else the one found by number, else
 * its title cut, else its number. Reactive: it changes once the name is found.
 */
export function dossierNaamNu(d: DossierNaamBron): string {
	if (kentKorteNaam(d)) return dossierName(d);
	return gevonden.get(d.number.trim()) ?? dossierName(d);
}
