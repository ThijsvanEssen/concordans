// A parliamentary paper at its source: one of the Tweede Kamer on tweedekamer.nl, any other the
// API places on officielebekendmakingen.nl (`official_url`); where it places none, no link.

type DocumentSource = {
	tk_url?: string | null;
	official_url?: string | null;
};

/** The page of the paper at its source, as a link says it; null where the API gives none. */
export function documentSource(d: DocumentSource): { label: string; href: string } | null {
	if (d.tk_url) return { label: 'tweedekamer.nl', href: d.tk_url };
	if (d.official_url) return { label: 'officielebekendmakingen.nl', href: d.official_url };
	return null;
}
