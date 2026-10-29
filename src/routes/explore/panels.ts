// The two layers of a bron in the read view, in one list: the tabs on a phone.

export const PANELS = [
	{ id: 'tekst', label: 'Tekst' },
	{ id: 'verbonden', label: 'Verbonden' }
] as const;

export type Panel = (typeof PANELS)[number]['id'];

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
