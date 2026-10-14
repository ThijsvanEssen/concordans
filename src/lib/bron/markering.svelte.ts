// The words a reader marks where a row, a card or a link opened it: the citation of the bron
// it was read for (`doel`) or the words a verbinding names by their offsets (`bereik`, of a
// Kamerstuk). Set by the click that opens the reader, read by the reader at that anchor; the
// address carries only the anchor, so a shared link lands on the place without the mark.
import type { Bereik } from '$lib/text/voetnoten';

export type Markering = {
	/** The bron the reader opens: `judgments/ecli_nl_hr_2019_2006`. */
	bron: string;
	/** The anchor it opens at: `fn-35`, `s-12`. */
	at: string;
	doel?: string | null;
	bereik?: Bereik | null;
};

let wacht = $state<Markering | null>(null);

/** Before the link is followed: what the reader marks at its anchor. */
export function zetMarkering(m: Markering | null) {
	wacht = m;
}

/** What to mark in `bron` at `at`, where the last click asked for it. */
export function markeringVoor(bron: string, at: string | null): Markering | null {
	const m = wacht;
	return m && at && m.bron === bron && m.at === at ? m : null;
}
