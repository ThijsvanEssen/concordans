// The names of the bronnen on the canvas and in its list for the keyboard, each one telling
// its bron apart (UX review N4): a Kamerstuk with its dossier ("Memorie van toelichting,
// 34710, nr. 3", not fifteen times "nr. 3" around Boek 6 BW), and where two names are still
// the same, what tells them apart: a judgment by its ECLI ("Hof Amsterdam 2 april 2024,
// GHAMS:2024:812", not eight times the court and the day).
import { textOf } from '$lib/text/words';
import { dossierNumberText, dossierNummer, officialNumber } from '$lib/bron/dossier-naam';
import { langeDatum, maandJaar } from '$lib/text/datum';

type Bron = {
	id: string;
	collection: string;
	key: string;
	raw?: {
		props?: Record<string, unknown> | null;
		cite?: { full?: string | null } | null;
	} | null;
};

/** `36600 VIII`: the dossier of a stuk as a citation writes it, or null. */
export function stukDossier(props: Record<string, unknown> | null | undefined): string | null {
	const number = textOf(props?.dossier_number);
	return number ? dossierNumberText(number, textOf(props?.dossier_suffix)) : null;
}

/** `36600 VIII`: the number of a dossier bron, as `stukDossier` writes a stuk's. */
export const dossierVan = (b: Bron): string | null => {
	const nummer = dossierNummer(b.raw?.props, b.key);
	return nummer ? officialNumber(nummer) : null;
};

/**
 * A Kamerstuk's short name with its dossier before its number: `Memorie van toelichting, nr. 3`
 * becomes `Memorie van toelichting, 34710, nr. 3`. Not for a stuk of a dossier that is itself
 * the focus or chosen (`eigen`): its hull names it.
 */
export function metDossier(
	naam: string,
	props: Record<string, unknown> | null | undefined,
	eigen: ReadonlySet<string>
): string {
	const dossier = stukDossier(props);
	if (!dossier || eigen.has(dossier) || naam.includes(dossier)) return naam;
	// Its place in the dossier as `stukLabel` writes it: its number, else its month.
	const number =
		textOf(props?.number) ?? (props?.sequence != null ? textOf(String(props.sequence)) : null);
	const nr = number ? (/^\d/.test(number) ? `nr. ${number}` : number) : null;
	const datum = textOf(props?.date);
	const waar = nr ?? (datum ? maandJaar(datum) : null);
	const tail = waar ? `, ${waar}` : null;
	return tail && naam.endsWith(tail)
		? `${naam.slice(0, -tail.length)}, ${dossier}${tail}`
		: `${naam}, ${dossier}`;
}

const ECLI = /ECLI:[A-Z]{2}:([A-Z0-9]+):(\d{4}):([A-Z0-9.]+)/i;

/** `GHAMS:2024:812`: the part of a judgment's ECLI after its country, from its cite or key. */
export function ecliStaart(b: Bron): string | null {
	const ecli = textOf(b.raw?.props?.ecli) ?? textOf(b.raw?.cite?.full) ?? b.key.replace(/_/g, ':');
	const m = ecli.match(ECLI);
	return m ? `${m[1]}:${m[2]}:${m[3]}`.toUpperCase() : null;
}

/** What tells a bron apart from another of the same name: its ECLI, its dossier, its day. */
function onderscheid(b: Bron): string | null {
	if (b.collection === 'judgments') return ecliStaart(b);
	if (b.collection === 'documents') return stukDossier(b.raw?.props);
	const datum = textOf(b.raw?.props?.date);
	return datum ? langeDatum(datum) : null;
}

/**
 * The names of `bronnen`, each one its own: where `naam` gives two or more the same name, each
 * of them gets what tells it apart after a comma. A name that stays the same (two bronnen
 * with nothing in the data to tell them apart) stays as it is.
 */
export function onderscheiden<B extends Bron>(
	bronnen: readonly B[],
	naam: (b: B) => string
): Map<string, string> {
	const namen = new Map<string, string>();
	const perNaam = new Map<string, B[]>();
	for (const b of bronnen) {
		const n = naam(b);
		namen.set(b.id, n);
		const al = perNaam.get(n);
		if (al) al.push(b);
		else perNaam.set(n, [b]);
	}
	for (const [n, groep] of perNaam) {
		if (groep.length < 2 || !n) continue;
		for (const b of groep) {
			const extra = onderscheid(b);
			if (extra && !n.includes(extra)) namen.set(b.id, `${n}, ${extra}`);
		}
	}
	return namen;
}
