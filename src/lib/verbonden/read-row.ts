// A row of an article in Verbonden reads in the Leespaneel, at the lid it names, in one click
// (studie-artikel-peek, Verbonden-rij); not where its group is read beside the selected bron.
// Its title stays the page. One rule for the rows of the summary and of the groups.
import type { ReadRef } from '$lib/reading/param';
import { parseAnchor } from '$lib/text/anchor';
import type { Row } from './rows';

/** What the panel reads for this row; null for any other bron, or a group read in place. */
export function readOfRow(
	row: Pick<Row, 'ref' | 'at' | 'missing'>,
	inPlace: boolean
): ReadRef | null {
	if (row.ref.collection !== 'articles' || inPlace || row.missing) return null;
	// The part of the article it names (a lid, an onderdeel), not a place of another kind.
	const at = row.at && parseAnchor(row.at)?.kind === 'part' ? row.at : null;
	return { key: row.ref.key, at };
}
