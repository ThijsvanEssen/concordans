// A parliamentary paper at its source: one of the Tweede Kamer on tweedekamer.nl, one of the
// Eerste Kamer on officielebekendmakingen.nl (its text is not taken in, so the source is where
// the reader goes for it).

type DocumentSource = {
	source?: string | null;
	tk_url?: string | null;
	external_id?: string | null;
};

/** A paper of the Eerste Kamer by its id at officielebekendmakingen.nl: `kst-1274216`. */
const OFFICIAL_ID = /^kst-\d+$/;

/**
 * The page of the paper at its source, as a link says it; null where the API gives none and
 * its id names none.
 */
export function documentSource(d: DocumentSource): { label: string; href: string } | null {
	if (d.tk_url) return { label: 'tweedekamer.nl', href: d.tk_url };
	if (d.source === 'eerstekamer' && d.external_id && OFFICIAL_ID.test(d.external_id))
		return {
			label: 'officielebekendmakingen.nl',
			href: `https://zoek.officielebekendmakingen.nl/${d.external_id}`
		};
	return null;
}
