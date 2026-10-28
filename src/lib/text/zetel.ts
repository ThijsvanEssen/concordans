// How the Kamer's role of a seat reads in a sentence; one place for a member's page, Verbonden and
// the keten.
/**
 * A seat on a committee in words, where it is more than a seat (API 0.75): "voorzitter",
 * "ondervoorzitter" for the Kamer's `OnderVz`, "plaatsvervangend lid" for a substitute or
 * `Plv. lid`; null for a plain seat (`Lid`, none).
 */
export function seatWord(role: string | null | undefined, substitute = false): string | null {
	const r = (role ?? '').trim();
	if (substitute || /^plv\.?\s*lid$/i.test(r)) return 'plaatsvervangend lid';
	if (!r || /^lid$/i.test(r)) return null;
	if (/^ondervz\.?$/i.test(r)) return 'ondervoorzitter';
	return r.replace(/^plv\.\s*/i, 'plaatsvervangend ').toLowerCase();
}
