// Why a row is in a followed topic or a search of Actueel. The API says per word where the
// item holds it (`matched`, API 0.79.55): its title, the whole title of its dossier, or of a
// publication the names of its laws. Where the row shows that text, the word is marked there;
// where it does not, the line under the row says where it is: `In dossier: … horizontale
// cyberbeveiligingsvereisten …`. Where in a text the word stands, and an item without
// `matched` (a fold of many), the front end finds by the API's rule ($lib/text/treffer).
import { markeer, rondTreffer, type Deel } from '$lib/text/treffer';
import { type FeedItem } from './feed';
import { dossierLabel } from '$lib/bron/dossier-naam';

/** Where the words are, when the row does not show them: the place, and the words around. */
export type Plek = { waar: 'In de titel' | 'In de tekst' | 'In dossier'; delen: Deel[] };

type Gevonden = Pick<FeedItem, 'kind' | 'title' | 'summary' | 'dossier'> &
	Partial<Pick<FeedItem, 'matched'>>;

/** The names a row of FeedDay shows under its headline (itemOnder), where a word can stand. */
export function getoondOnder(i: FeedItem): string[] {
	return [
		i.dossier ? dossierLabel(i.dossier) : null,
		i.kind !== 'inwerkingtreding' ? i.commencement?.instrument?.title : null,
		...(i.publication?.instruments ?? []).map((w) => w.title)
	].filter((t): t is string => !!t);
}

/**
 * The words to mark in a row: those the API found in the item (`matched`), else the words
 * asked (a fold, an answer without `matched`).
 */
export function termenVan(termen: readonly string[], i?: Partial<Pick<FeedItem, 'matched'>>) {
	const gevonden = [...new Set((i?.matched ?? []).map((m) => m.term))];
	return gevonden.length ? gevonden : termen;
}

/** The whole title of the item where it holds the words: of a toezegging its text. */
function inTitel(termen: readonly string[], i: Gevonden): Plek | null {
	// A toezegging is its text (`summary`); its title is that text cut.
	const toezegging = i.kind === 'toezegging';
	const delen = rondTreffer(termen, (toezegging && i.summary) || i.title);
	return delen ? { waar: toezegging ? 'In de tekst' : 'In de titel', delen } : null;
}

function inDossier(termen: readonly string[], i: Gevonden): Plek | null {
	const delen = rondTreffer(termen, i.dossier?.title);
	return delen ? { waar: 'In dossier', delen } : null;
}

/**
 * Where the words of `termen` are in an item whose row shows `getoond` (its headline and the
 * names under it): null where one of those holds them, and they are marked there. Else by
 * the field the API names: an excerpt of its title (of a toezegging its text) or of its
 * dossier's title; the names of a publication's laws stand under its row already. Without
 * `matched`, its title, then its dossier's title, by the API's rule.
 */
export function plekVan(
	termen: readonly string[],
	i: Gevonden,
	getoond: readonly (string | null | undefined)[]
): Plek | null {
	const woorden = termenVan(termen, i);
	if (!woorden.length || getoond.some((t) => markeer(woorden, t))) return null;
	const matched = i.matched ?? [];
	if (!matched.length) return inTitel(woorden, i) ?? inDossier(woorden, i);
	for (const m of matched) {
		const p =
			m.field === 'title'
				? inTitel([m.term], i)
				: m.field === 'dossier_title'
					? inDossier([m.term], i)
					: null;
		if (p) return p;
	}
	return null;
}
