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
