/**
 * What the Verkenner does when its focus, the canvas's visibility or the depth changes:
 * load the focus, deepen the canvas around a bron that is already there, or nothing.
 *
 * The anchor of a deepening is the bron the canvas was last drawn around, or else the
 * selected bron, but only when that is the focus itself. A phone that opens its Netwerk
 * tab on a link to another bron (?paneel=netwerk) shows the canvas while the old bron is
 * still selected: that bron is no anchor for the new address (#48, 12 Oct 2026).
 */
type FocusStap = { soort: 'laden' } | { soort: 'verdiepen'; anker: string } | null;

export interface FocusStand {
	focus: string;
	/** The focus the last load was started for. */
	loadedFocus: string;
	/** A focus double clicked: drawn anew even when it is the loaded one. */
	replaceNext: string | null;
	/** The canvas is on the screen. */
	zichtbaar: boolean;
	/** The focus loaded as its light node only, while the canvas was not shown. */
	lichtGeladen: string | null;
	withNetwerk: boolean;
	/** The bron the canvas was last drawn around, when it is still on the canvas. */
	verdiept: string | null;
	/** The selected bron, its node id and the focus id its link names; read only when needed. */
	geselecteerd: () => { id: string; linkId: string | null } | null;
}

export function focusStap(s: FocusStand): FocusStap {
	if (
		s.focus !== s.loadedFocus ||
		s.replaceNext === s.focus ||
		(s.zichtbaar && s.lichtGeladen === s.focus)
	)
		return { soort: 'laden' };
	if (!s.zichtbaar || s.withNetwerk) return null;
	if (s.verdiept) return { soort: 'verdiepen', anker: s.verdiept };
	const g = s.geselecteerd();
	if (g && (g.id === s.focus || g.linkId === s.focus)) return { soort: 'verdiepen', anker: g.id };
	return null;
}
