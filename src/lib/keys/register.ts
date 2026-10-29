// The one register of the keys of Concordans: what each key is, where it works, what it does
// and which handler answers it. /docs/sneltoetsen and the window on ? are drawn from it, the
// dispatcher (dispatch.svelte.ts) reads it, and the e2e (e2e/reizen/sneltoetsen.spec.ts)
// presses every key in it. A key that is not here is not promised and not bound.
//
// Three kinds of key (WCAG 2.1.4, Character Key Shortcuts; Thijs, 29 Oct: "Met alt"):
// - `pagina`: works on the page, always with Alt or with Ctrl/⌘ (a combination, never a letter
//   alone). Matched on `event.code`, because Alt plus a key gives another character on macOS.
// - `focus`: a plain key that only works while the focus is in the list, field or canvas it
//   belongs to (J and K in a row, the arrows in the canvas). 2.1.4 allows that.
// - `gereserveerd`: held for what is not built yet (Alt W, between the reader and the panel).
//
// Free of the browsers: Alt D, Alt F, Alt E and Alt Home are Chrome's and Edge's, the letters of
// the menus (Alt F, E, V, S, B, T, H) are Firefox's on Windows, and Alt 1 to 8 switch tabs in
// Firefox on Linux. So the keys of `pagina` are Alt with L, J, K, W, 1, 2, the brackets and the
// slash, and Ctrl/⌘ with K and the slash. Alt 1 and Alt 2 only act on a phone, where the tabs
// are. Ctrl+Alt is AltGr on Windows and gives a character: it is never a key of ours.

export type Context = 'overal' | 'zoeken' | 'lezer' | 'netwerk' | 'bladeren' | 'vergelijken';

/** The order and the names under which docs and the window on ? set the keys. */
export const CONTEXTS: readonly { id: Context; naam: string }[] = [
	{ id: 'overal', naam: 'Overal' },
	{ id: 'zoeken', naam: 'Zoeken' },
	{ id: 'lezer', naam: 'In de lezer' },
	{ id: 'netwerk', naam: 'In het netwerk' },
	{ id: 'bladeren', naam: 'Bij een lijst' },
	{ id: 'vergelijken', naam: 'Bij Vergelijken' }
];

/** One key press: `code` is the physical key, `teken` what the page shows on its cap. */
export type Combo = {
	code: string;
	teken: string;
	/** Also matched on this `event.key`, for a punctuation key that moves on other layouts. */
	key?: string;
	/** Ctrl, or ⌘ on a Mac. */
	mod?: boolean;
	alt?: boolean;
};

export type Toets = {
	id: string;
	soort: 'pagina' | 'focus' | 'gereserveerd';
	context: Context;
	keys: readonly Combo[];
	/** How the keys of a row stand: together (the arrows) or one or the other (Ctrl K, Alt /). */
	sep: 'samen' | 'of';
	omschrijving: string;
	/** The handler that answers it (dispatch.svelte.ts), or where it lives for a `focus` key. */
	handler: string;
	/** For a `focus` key: where the focus must be, as the docs say it. */
	waar?: string;
	/** Works in a window that holds the page (a Blad, the search): only a key to leave it. */
	inDialoog?: boolean;
};

const letter = (c: string, extra: Partial<Combo> = {}): Combo => ({
	code: `Key${c}`,
	teken: c,
	...extra
});
const cijfer = (c: string, extra: Partial<Combo> = {}): Combo => ({
	code: `Digit${c}`,
	teken: c,
	...extra
});
const pijl = (naam: 'Left' | 'Right' | 'Up' | 'Down', teken: string): Combo => ({
	code: `Arrow${naam}`,
	teken
});
const ALT = { alt: true } as const;
const MOD = { mod: true } as const;

export const TOETSEN: readonly Toets[] = [
	{
		id: 'zoeken',
		soort: 'pagina',
		context: 'overal',
		keys: [letter('K', MOD), { code: 'Slash', key: '/', teken: '/', alt: true }],
		sep: 'of',
		omschrijving: 'Zoeken',
		handler: 'zoeken',
		inDialoog: true
	},
	{
		id: 'hulp',
		soort: 'pagina',
		context: 'overal',
		keys: [{ code: 'Slash', key: '/', teken: '/', mod: true }],
		sep: 'samen',
		omschrijving: 'Dit overzicht van de sneltoetsen',
		handler: 'hulp',
		inDialoog: true
	},
	{
		id: 'sluit',
		soort: 'focus',
		context: 'overal',
		keys: [{ code: 'Escape', teken: 'Esc' }],
		sep: 'samen',
		omschrijving: 'Een venster, kaart, menu of opengeklapte rij sluiten',
		handler: 'sluiten'
	},
	{
		id: 'zoek-resultaten',
		soort: 'focus',
		context: 'zoeken',
		keys: [pijl('Up', '↑'), pijl('Down', '↓'), { code: 'Enter', teken: 'Enter' }],
		sep: 'samen',
		omschrijving: 'Door de zoekresultaten; Enter opent er een',
		handler: 'Search',
		waar: 'in het zoekveld'
	},
	{
		id: 'zoek-wis',
		soort: 'focus',
		context: 'zoeken',
		keys: [{ code: 'Escape', teken: 'Esc' }],
		sep: 'samen',
		omschrijving: 'Het zoekveld wissen, of het zoeken sluiten',
		handler: 'Search',
		waar: 'in het zoekveld'
	},
	{
		id: 'wissel',
		soort: 'pagina',
		context: 'lezer',
		keys: [letter('L', ALT)],
		sep: 'samen',
		omschrijving: 'Bij een bron: wisselen tussen de lezer en het netwerk',
		handler: 'wissel'
	},
	{
		id: 'tab-tekst',
		soort: 'pagina',
		context: 'lezer',
		keys: [cijfer('1', ALT), cijfer('2', ALT)],
		sep: 'samen',
		omschrijving: 'Op de telefoon: de tab Tekst of Verbonden',
		handler: 'paneel'
	},
	{
		id: 'artikel-vorig',
		soort: 'pagina',
		context: 'lezer',
		keys: [{ code: 'BracketLeft', key: '[', teken: '[', alt: true }],
		sep: 'samen',
		omschrijving: 'Het vorige artikel van de wet',
		handler: 'artikel-vorig'
	},
	{
		id: 'artikel-volgend',
		soort: 'pagina',
		context: 'lezer',
		keys: [{ code: 'BracketRight', key: ']', teken: ']', alt: true }],
		sep: 'samen',
		omschrijving: 'Het volgende artikel van de wet',
		handler: 'artikel-volgend'
	},
	{
		id: 'paneel-wissel',
		soort: 'gereserveerd',
		context: 'lezer',
		keys: [letter('W', ALT)],
		sep: 'samen',
		omschrijving: 'Wisselen tussen de lezer en het paneel',
		handler: 'paneel-wissel'
	},
	{
		id: 'rij-focus',
		soort: 'focus',
		context: 'bladeren',
		keys: [letter('J'), letter('K'), { code: 'Enter', teken: 'Enter' }],
		sep: 'samen',
		omschrijving: 'Volgende of vorige rij onder Bronnen en in Verbonden; Enter opent haar',
		handler: 'rijen',
		waar: 'in de lijst'
	},
	{
		id: 'rij-pagina',
		soort: 'pagina',
		context: 'bladeren',
		keys: [letter('J', ALT), letter('K', ALT)],
		sep: 'samen',
		omschrijving: 'Vanaf elke plek naar de volgende of vorige rij van de lijst op de pagina',
		handler: 'rijen'
	},
	{
		id: 'netwerk-aanwijzen',
		soort: 'focus',
		context: 'netwerk',
		keys: [pijl('Left', '←'), pijl('Right', '→')],
		sep: 'samen',
		omschrijving: 'De volgende of vorige bron aanwijzen; Enter kiest haar',
		handler: 'GraphView',
		waar: 'op het netwerk'
	},
	{
		id: 'netwerk-lijst',
		soort: 'focus',
		context: 'netwerk',
		keys: [
			pijl('Up', '↑'),
			pijl('Down', '↓'),
			{ code: 'Home', teken: 'Home' },
			{ code: 'End', teken: 'End' }
		],
		sep: 'samen',
		omschrijving: 'Door de bronnen in de lijst van het netwerk',
		handler: 'CanvasNodeList',
		waar: 'in de lijst van het netwerk'
	},
	{
		id: 'netwerk-n',
		soort: 'focus',
		context: 'netwerk',
		keys: [letter('N')],
		sep: 'samen',
		omschrijving: 'De bron in die lijst aan het netwerk toevoegen of eruit halen',
		handler: 'CanvasNodeList',
		waar: 'in de lijst van het netwerk'
	},
	{
		id: 'vergelijken',
		soort: 'focus',
		context: 'vergelijken',
		keys: [pijl('Left', '←'), pijl('Right', '→')],
		sep: 'samen',
		omschrijving: 'Bij Vergelijken: de vorige of volgende wijziging',
		handler: 'VersionCompare'
	}
];

/** Clicks that are not keys: a link opened at once. In docs and the window, not in the e2e. */
export const MUIS = {
	id: 'klik',
	keys: 'klik met ⌘ of Ctrl, of de middelste muisknop',
	omschrijving: 'Een verwijzing direct openen, zonder kaart'
} as const;

export const toetsVan = (id: string): Toets => {
	const t = TOETSEN.find((x) => x.id === id);
	if (!t) throw new Error(`Geen toets ${id} in het register`);
	return t;
};

type KeyLike = Pick<KeyboardEvent, 'code' | 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

/** Whether this key press is `c`. A Ctrl+Alt press is AltGr on Windows: a character, never ours. */
export function isCombo(e: KeyLike, c: Combo): boolean {
	if (e.shiftKey) return false;
	if (c.mod) {
		if (e.altKey || !(e.metaKey || e.ctrlKey)) return false;
	} else if (c.alt) {
		if (!e.altKey || e.ctrlKey || e.metaKey) return false;
	} else return false;
	return e.code === c.code || (!!c.key && e.key === c.key);
}

/** The key of `pagina` this press is, if any. */
export function toetsVanEvent(e: KeyLike): { toets: Toets; combo: Combo } | null {
	for (const toets of TOETSEN) {
		if (toets.soort !== 'pagina') continue;
		const combo = toets.keys.find((c) => isCombo(e, c));
		if (combo) return { toets, combo };
	}
	return null;
}
