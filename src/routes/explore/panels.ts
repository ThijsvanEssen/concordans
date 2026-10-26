// The three layers of a bron in the Verkenner, in one list: the tabs on a phone and in the
// narrow read view, and the keys 1, 2 and 3 (Thijs, 10 Oct).

export const PANELS = [
	{ id: 'reader', label: 'Tekst', key: '1' },
	{ id: 'graph', label: 'Netwerk', key: '2' },
	{ id: 'verbonden', label: 'Verbonden', key: '3' }
] as const;

export type Panel = (typeof PANELS)[number]['id'];

/** The panel a key takes; undefined for any other key. */
export const panelOfKey = (key: string): Panel | undefined => PANELS.find((p) => p.key === key)?.id;

/**
 * Whether Verbonden is in view and so loads (Thijs, 9 Oct: "alles zo lazy mogelijk"): beside
 * the reader on a wide screen; on a phone when its tab or the table of all verbindingen is
 * open (F8: ?tabel=1 loaded directly said 0), for an article, whose counts per lid stand in
 * its text, and in the werkplek, whose legend counts as Verbonden does (N1).
 */
export const verbondenInView = (
	collection: string,
	o: { phone: boolean; table: boolean; panel: Panel; canvasOnly?: boolean }
): boolean =>
	!o.phone || o.table || o.panel === 'verbonden' || collection === 'articles' || !!o.canvasOnly;
