// What names an instrument in a list when it has no BWB id: the CELEX number of an act of the
// EU, the publication that enacted a law of the Staatsblad, the number of a treaty in the
// Verdragenbank (API 0.81). A row without any of them stands with its title alone.
import type { Schema } from '$lib/api/types';
import { enactedLawId, stbCitation } from '$lib/text/enacted-law';

type Row = Pick<Schema<'InstrumentListItemDTO'>, 'bwb_id' | 'celex' | 'jurisdiction' | 'kind'> &
	Partial<Pick<Schema<'InstrumentListItemDTO'>, 'official_id' | 'treaty_number'>>;

/** `BWBR0001840`, `32016R0679`, `Stb. 2019, 33` or `Verdragsnr. 010783`; empty for none. */
export function instrumentKenmerk(w: Row): string {
	if (w.bwb_id ?? w.celex) return (w.bwb_id ?? w.celex ?? '').toUpperCase();
	const stb = enactedLawId(w.official_id);
	if (stb) return stbCitation(stb) ?? stb;
	if (w.official_id) return w.official_id.toUpperCase();
	return w.treaty_number ? `Verdragsnr. ${w.treaty_number}` : '';
}

/** The kinds of an act of the EU, by its CELEX letter as the API gives them (API 0.81). */
const EU_KINDS: readonly (readonly [string, string])[] = [
	['richtlijn', 'Richtlijn'],
	['verordening', 'Verordening'],
	['besluit', 'Besluit'],
	['kaderbesluit', 'Kaderbesluit']
];

/** An act of the EU by its kind (Richtlijn, Verordening); null for another or none. */
export const euKind = (w: Pick<Row, 'jurisdiction' | 'kind'>): string | null =>
	w.jurisdiction === 'eu' ? (EU_KINDS.find(([kind]) => kind === w.kind)?.[1] ?? null) : null;
