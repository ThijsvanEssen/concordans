// A version of a law (`instrument_versions/bwbr0005537_2022_05_01`) has no reader of its own:
// what a lawyer wants of it is the text as it stood on its first day, the law at that
// peildatum. The key names both, so a link to a version needs no request.
import { parseNodeId } from '$lib/vocabulary';

const VERSION_KEY = /^(bwb[rv]\d{7})_(\d{4})_(\d{2})_(\d{2})$/i;

/** The law and the day a version's key names, or null for a key of another shape. */
export function versieDoel(
	collection: string,
	key: string
): { law: string; peildatum: string } | null {
	if (collection !== 'instrument_versions') return null;
	const m = VERSION_KEY.exec(key);
	return m ? { law: m[1].toLowerCase(), peildatum: `${m[2]}-${m[3]}-${m[4]}` } : null;
}

/** The same for a `collection/key` name (a focus). */
export function versieDoelOfFocus(focus: string): { law: string; peildatum: string } | null {
	const t = parseNodeId(focus);
	return t ? versieDoel(t.collection, t.key) : null;
}
