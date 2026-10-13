// Why a row is in a followed topic or a search of Actueel: the API finds a word of `q` in
// the title of the item or in the full title of its dossier (lawgraph `routes/feed.py`), and
// the row shows neither whole. Where the row shows the word, it is marked there; where it
// does not, the line under the row says where it is: `In dossier: … horizontale
// cyberbeveiligingsvereisten …` (onderzoek samenhang, GGN 3.1).
import { markeer, rondTreffer, type Deel } from '$lib/text/treffer';
import { dossierLabel, type FeedItem } from './feed';

export type { Deel };

/** Where the words are, when the row does not show them: the place, and the words around. */
export type Plek = { waar: 'In de titel' | 'In de tekst' | 'In dossier'; delen: Deel[] };

/** The names a row of FeedDay shows under its headline (itemOnder), where a word can stand. */
export function getoondOnder(i: FeedItem): string[] {
	return [
		i.dossier ? dossierLabel(i.dossier) : null,
		i.kind !== 'inwerkingtreding' ? i.commencement?.instrument?.title : null,
		...(i.publication?.instruments ?? []).map((w) => w.title)
	].filter((t): t is string => !!t);
}

/**
 * Where the words of `termen` were found in an item whose row shows `getoond` (its headline
 * and the names under it): null where one of those holds them, and they are marked there;
 * else its whole title (of a toezegging its text), then the whole title of its dossier. Null as well where neither
 * holds them: the API found them in a text the feed does not give (a publication's title).
 */
export function plekVan(
	termen: readonly string[],
	i: Pick<FeedItem, 'kind' | 'title' | 'summary' | 'dossier'>,
	getoond: readonly (string | null | undefined)[]
): Plek | null {
	if (!termen.length || getoond.some((t) => markeer(termen, t))) return null;
	// A toezegging is its text (`summary`); its title is that text cut.
	const toezegging = i.kind === 'toezegging';
	const titel = rondTreffer(termen, (toezegging && i.summary) || i.title);
	if (titel) return { waar: toezegging ? 'In de tekst' : 'In de titel', delen: titel };
	const dossier = rondTreffer(termen, i.dossier?.title);
	return dossier ? { waar: 'In dossier', delen: dossier } : null;
}
