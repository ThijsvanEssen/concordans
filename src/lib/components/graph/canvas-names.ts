// The names of the bronnen on the canvas and in its list for the keyboard, each one telling
// its bron apart (UX review N4): a Kamerstuk with its dossier ("Memorie van toelichting,
// 34710, nr. 3", not fifteen times "nr. 3" around Boek 6 BW), and where two names are still
// the same, what tells them apart: a judgment by its ECLI ("Hof Amsterdam 2 april 2024,
// GHAMS:2024:812", not eight times the court and the day).
import { textOf } from '$lib/text/words';
import { dossierNumberText, dossierNummer, officialNumber } from '$lib/bron/dossier-naam';
import { korteDatum, maandJaar } from '$lib/text/datum';

type Bron = {
	id: string;
	collection: string;
	key: string;
	raw?: {
		props?: Record<string, unknown> | null;
	} | null;
};

/** `36600 VIII`: the dossier of a stuk as a citation writes it, or null. */
export function paperDossier(props: Record<string, unknown> | null | undefined): string | null {
	const number = textOf(props?.dossier_number);
	return number ? dossierNumberText(number, textOf(props?.dossier_suffix)) : null;
}

/** `36600 VIII`: the number of a dossier bron, as `paperDossier` writes a stuk's. */
export const dossierOfBron = (b: Bron): string | null => {
	const num = dossierNummer(b.raw?.props, b.key);
	return num ? officialNumber(num) : null;
};

/**
 * A Kamerstuk's short name with its dossier before its number: `Memorie van toelichting, nr. 3`
 * becomes `Memorie van toelichting, 34710, nr. 3`. Not for a stuk of a dossier that is itself
 * the focus or chosen (`own`): its hull names it.
 */
export function withDossier(
	name: string,
	props: Record<string, unknown> | null | undefined,
	own: ReadonlySet<string>
): string {
	const dossier = paperDossier(props);
	if (!dossier || own.has(dossier) || name.includes(dossier)) return name;
	// Its place in the dossier as `stukLabel` writes it: its number, else its month.
	const number =
		textOf(props?.number) ?? (props?.sequence != null ? textOf(String(props.sequence)) : null);
	const nr = number ? (/^\d/.test(number) ? `nr. ${number}` : number) : null;
	const date = textOf(props?.date);
	const place = nr ?? (date ? maandJaar(date) : null);
	const tail = place ? `, ${place}` : null;
	return tail && name.endsWith(tail)
		? `${name.slice(0, -tail.length)}, ${dossier}${tail}`
		: `${name}, ${dossier}`;
}

const ECLI = /ECLI:[A-Z]{2}:([A-Z0-9]+):(\d{4}):([A-Z0-9.]+)/i;

/** `GHAMS:2024:812`: the part of a judgment's ECLI after its country, from its props or its key. */
export function ecliTail(b: Bron): string | null {
	const ecli = textOf(b.raw?.props?.ecli) ?? b.key.replace(/_/g, ':');
	const m = ecli.match(ECLI);
	return m ? `${m[1]}:${m[2]}:${m[3]}`.toUpperCase() : null;
}

/** What tells a bron apart from another of the same name: its ECLI, its dossier, its day. */
function distinction(b: Bron): string | null {
	if (b.collection === 'judgments') return ecliTail(b);
	if (b.collection === 'documents') return paperDossier(b.raw?.props);
	const date = textOf(b.raw?.props?.date);
	return date ? korteDatum(date) : null;
}

/**
 * The names of `bronnen`, each one its own: where `name` gives two or more the same name, each
 * of them gets what tells it apart after a comma. A name that stays the same (two bronnen
 * with nothing in the data to tell them apart) stays as it is.
 */
export function distinctNames<B extends Bron>(
	bronnen: readonly B[],
	name: (b: B) => string
): Map<string, string> {
	const names = new Map<string, string>();
	const byName = new Map<string, B[]>();
	for (const b of bronnen) {
		const n = name(b);
		names.set(b.id, n);
		const list = byName.get(n);
		if (list) list.push(b);
		else byName.set(n, [b]);
	}
	for (const [n, group] of byName) {
		if (group.length < 2 || !n) continue;
		for (const b of group) {
			const extra = distinction(b);
			if (extra && !n.includes(extra)) names.set(b.id, `${n}, ${extra}`);
		}
	}
	return names;
}
