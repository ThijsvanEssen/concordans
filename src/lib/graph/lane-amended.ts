// What the lanes know of a chosen wet from GET /api/instruments/{bwb}/amended-by (B82): an enacted
// change runs from the Staatsblad to an article, so the neighbourhood of the wet itself holds no
// publication. One request per chosen wet says whether she is changed, by which dossiers, and
// whether a change is pending. Pure: LanesView asks, the scene (withChange) marks.
import type { Schema } from '$lib/api/types';

export type LawAmended = {
	/** A publication changed, introduced or repealed an article of her. */
	enacted: boolean;
	/** A paper of the Tweede Kamer proposes a change that is still pending. */
	proposed: boolean;
	/** The dossiers of those publications, by their id in lower case (`dossiers/36264`). */
	dossiers: ReadonlySet<string>;
};

/** Per chosen wet, by her id in lower case (`instruments/bwbr0006622`). */
export type Amended = ReadonlyMap<string, LawAmended>;

export const NOT_AMENDED: Amended = new Map();

/** The key a canvas id is looked up by: the API writes `BWBR`, the canvas `bwbr`. */
export const amendedKey = (id: string) => id.toLowerCase();

/** What one answer of `amended-by` says of her. */
export function lawAmended(data: Schema<'AmendedByResponse'>): LawAmended {
	return {
		enacted: data.total > 0,
		proposed: data.proposals_total > 0,
		dossiers: new Set(
			data.items.flatMap((i) => (i.dossiers ?? []).flatMap((d) => (d.id ? [amendedKey(d.id)] : [])))
		)
	};
}
