// A judgment as a lawyer cites it, as the API gives it on every judgment (`cite`, API
// 0.79.60): HR 20 december 2019, ECLI:NL:HR:2019:2006; Conclusie A-G Hartlief 8 mei 2020.
// The reader's head, the tab, the canvas and Behoort bij show that one form; an overweging
// is cited after it.
import type { Schema } from '$lib/api/types';
import { bewaarItem, type MapItem } from '$lib/map/map';
import { paragraphCite } from './ecli';

export type Cite = Schema<'JudgmentCiteDTO'>;

/** What a judgment gives to cite it and its overwegingen. */
type UitspraakVoorCitaat = {
	ecli?: string | null;
	cite?: Cite | null;
	names?: string[] | null;
};

/** The judgment as its heading cites it (HR 19 juli 2019, …); null where the API gives none. */
export const uitspraakKop = (j: { cite?: Cite | null }): Cite | null => j.cite ?? null;

/** A judgment as Gemarkeerd groups under it: as its heading cites it, with its names. */
export const zaakNaam = (kort: string, namen: string[] | null | undefined) =>
	namen?.length ? `${kort} (${namen.join(', ')})` : kort;

/**
 * An overweging as its menu cites and keeps it: kort and voluit with `r.o. 3.1`, the link to
 * its place, and the item Bewaar keeps (with the bron's id). The reader and a map's item
 * (MapInhoud) offer the same menu from it. Null without a citation.
 */
export function overwegingCitaat(
	j: UitspraakVoorCitaat,
	num: string,
	anker: string,
	link: string,
	bronId: string | null
): {
	kort: string;
	voluit: string;
	link: string;
	bewaar: MapItem | null;
} | null {
	const kop = uitspraakKop(j);
	if (!kop || !j.ecli) return null;
	const at = paragraphCite(j.ecli, num);
	const kort = `${kop.short}, ${at}`;
	const voluit = `${kop.full}, ${at}`;
	return {
		kort,
		voluit,
		link,
		bewaar: bronId
			? bewaarItem(bronId, { at: anker, kort, voluit }, { groep: zaakNaam(kop.short, j.names) })
			: null
	};
}
