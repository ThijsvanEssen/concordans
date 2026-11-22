// The names of the bronnen in the list for the keyboard, each one telling its bron apart (UX
// review N4): where two names are the same, what tells them apart: a judgment by its ECLI ("Hof Amsterdam 2 april 2024,
// GHAMS:2024:812", not eight times the court and the day).
import { textOf } from '$lib/text/words';
import { dossierNumberText } from '$lib/bron/dossier-naam';
import { korteDatum } from '$lib/text/datum';

type Bron = {
	id: string;
	collection: string;
	key: string;
	raw?: {
		props?: Record<string, unknown> | null;
	} | null;
};

/** `36600 VIII`: the dossier of a stuk as a citation writes it, or null. */
function paperDossier(props: Record<string, unknown> | null | undefined): string | null {
	const number = textOf(props?.dossier_number);
	return number ? dossierNumberText(number, textOf(props?.dossier_suffix)) : null;
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
