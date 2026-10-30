// The one register of the keys of Concordans: what each key is, where it works, what it does
// and which handler answers it. /docs/sneltoetsen and the window on Ctrl / are drawn from it, the
// dispatcher (dispatch.svelte.ts) reads it, and the e2e (e2e/reizen/sneltoetsen.spec.ts)
// presses every key in it. A key that is not here is not promised and not bound.
//
// Three kinds of key (WCAG 2.1.4, Character Key Shortcuts; Thijs, 29 Oct: "Met alt"):
// - `pagina`: works on the page, always with Alt or with Ctrl/⌘ (a combination, never a letterKey
//   alone). Matched on `event.code`, because Alt plus a key gives another character on macOS.
// - `focus`: a plain key that only works while the focus is in the list, field or canvas it
//   belongs to (J and K in a row, the arrows in the canvas). 2.1.4 allows that.
// - `gereserveerd`: held for what is not built yet.
//
// Free of the browsers: Alt D, Alt F, Alt E and Alt Home are Chrome's and Edge's, the letters of
// the menus (Alt F, E, V, S, B, T, H) are Firefox's on Windows, and Alt 1 to 8 switch tabs in
// Firefox on Linux. So the keys of `pagina` are Alt with L, J, K, W, the brackets and the
// slash, and Ctrl/⌘ with K and the slash. A phone has no keyboard and gets no keys of its own
// (Thijs, 29 Oct); a tablet with one keeps these. Ctrl+Alt is AltGr on Windows and gives a character: it is never a key of ours.

export type KeyContext =
	| 'overal'
	| 'zoeken'
	| 'lezer'
	| 'paneel'
	| 'netwerk'
	| 'bladeren'
	| 'vergelijken';

/** The order and the names under which docs and the window on Ctrl / set the keys. */
export const CONTEXTS: readonly { id: KeyContext; name: string }[] = [
	{ id: 'overal', name: 'Overal' },
	{ id: 'zoeken', name: 'Zoeken' },
	{ id: 'lezer', name: 'In de lezer' },
	{ id: 'paneel', name: 'Bij het Leespaneel' },
	{ id: 'netwerk', name: 'In het netwerk' },
	{ id: 'bladeren', name: 'Bij een lijst' },
	{ id: 'vergelijken', name: 'Bij Vergelijken' }
];

/** One key press: `code` is the physical key, `cap` what the page shows on its cap. */
export type Combo = {
	code: string;
	cap: string;
	/** Also matched on this `event.key`, for a punctuation key that moves on other layouts. */
	key?: string;
	/** Ctrl, or ⌘ on a Mac. */
	mod?: boolean;
	alt?: boolean;
};

export type Shortcut = {
	id: string;
	kind: 'page' | 'focus' | 'reserved';
	context: KeyContext;
	keys: readonly Combo[];
	/** How the keys of a row stand: together (the arrows) or one or the other (Ctrl K, Alt /). */
	join: 'together' | 'or';
	description: string;
	/** The handler that answers it (dispatch.svelte.ts), or where it lives for a `focus` key. */
	handler: string;
	/** For a `focus` key: where the focus must be, as the docs say it. */
	focusIn?: string;
	/** Works in a window that holds the page (a Blad, the search): only a key to leave it. */
	inDialog?: boolean;
};

const letterKey = (c: string, extra: Partial<Combo> = {}): Combo => ({
	code: `Key${c}`,
	cap: c,
	...extra
});
const arrow = (name: 'Left' | 'Right' | 'Up' | 'Down', cap: string): Combo => ({
	code: `Arrow${name}`,
	cap
});
const ALT = { alt: true } as const;
const MOD = { mod: true } as const;

export const SHORTCUTS: readonly Shortcut[] = [
	{
		id: 'search',
		kind: 'page',
		context: 'overal',
		keys: [letterKey('K', MOD), { code: 'Slash', key: '/', cap: '/', alt: true }],
		join: 'or',
		description: 'Zoeken',
		handler: 'search',
		inDialog: true
	},
	{
		id: 'help',
		kind: 'page',
		context: 'overal',
		keys: [{ code: 'Slash', key: '/', cap: '/', mod: true }],
		join: 'together',
		description: 'Dit overzicht van de sneltoetsen',
		handler: 'help',
		inDialog: true
	},
	{
		id: 'close',
		kind: 'focus',
		context: 'overal',
		keys: [{ code: 'Escape', cap: 'Esc' }],
		join: 'together',
		description: 'Een venster, kaart, menu of opengeklapte rij sluiten',
		handler: 'close'
	},
	{
		id: 'search-results',
		kind: 'focus',
		context: 'zoeken',
		keys: [arrow('Up', '↑'), arrow('Down', '↓'), { code: 'Enter', cap: 'Enter' }],
		join: 'together',
		description: 'Door de zoekresultaten; Enter opent er een',
		handler: 'Search',
		focusIn: 'in het zoekveld'
	},
	{
		id: 'search-clear',
		kind: 'focus',
		context: 'zoeken',
		keys: [{ code: 'Escape', cap: 'Esc' }],
		join: 'together',
		description: 'Het zoekveld wissen, of het zoeken sluiten',
		handler: 'Search',
		focusIn: 'in het zoekveld'
	},
	{
		id: 'toggle-view',
		kind: 'page',
		context: 'lezer',
		keys: [letterKey('L', ALT)],
		join: 'together',
		description: 'Bij een bron: wisselen tussen de lezer en het netwerk',
		handler: 'toggle-view'
	},
	{
		id: 'article-prev',
		kind: 'page',
		context: 'lezer',
		keys: [{ code: 'BracketLeft', key: '[', cap: '[', alt: true }],
		join: 'together',
		description: 'Het vorige artikel van de wet; in het Leespaneel het vorige daar',
		handler: 'article-prev'
	},
	{
		id: 'article-next',
		kind: 'page',
		context: 'lezer',
		keys: [{ code: 'BracketRight', key: ']', cap: ']', alt: true }],
		join: 'together',
		description: 'Het volgende artikel van de wet; in het Leespaneel het volgende daar',
		handler: 'article-next'
	},
	{
		id: 'panel-toggle',
		kind: 'page',
		context: 'paneel',
		keys: [letterKey('W', ALT)],
		join: 'together',
		description: 'Wisselen tussen de lezer en het Leespaneel',
		handler: 'panel-toggle'
	},
	{
		id: 'row-focus',
		kind: 'focus',
		context: 'bladeren',
		keys: [letterKey('J'), letterKey('K'), { code: 'Enter', cap: 'Enter' }],
		join: 'together',
		description: 'Volgende of vorige rij onder Bronnen en in Verbonden; Enter opent haar',
		handler: 'rows',
		focusIn: 'in de lijst'
	},
	{
		id: 'row-page',
		kind: 'page',
		context: 'bladeren',
		keys: [letterKey('J', ALT), letterKey('K', ALT)],
		join: 'together',
		description: 'Vanaf elke plek naar de volgende of vorige rij van de lijst op de pagina',
		handler: 'rows'
	},
	{
		id: 'network-point',
		kind: 'focus',
		context: 'netwerk',
		keys: [arrow('Left', '←'), arrow('Right', '→')],
		join: 'together',
		description: 'De volgende of vorige bron aanwijzen; Enter kiest haar',
		handler: 'GraphView',
		focusIn: 'op het netwerk'
	},
	{
		id: 'network-list',
		kind: 'focus',
		context: 'netwerk',
		keys: [
			arrow('Up', '↑'),
			arrow('Down', '↓'),
			{ code: 'Home', cap: 'Home' },
			{ code: 'End', cap: 'End' }
		],
		join: 'together',
		description: 'Door de bronnen in de lijst van het netwerk',
		handler: 'CanvasNodeList',
		focusIn: 'in de lijst van het netwerk'
	},
	{
		id: 'network-add',
		kind: 'focus',
		context: 'netwerk',
		keys: [letterKey('N')],
		join: 'together',
		description: 'De bron in die lijst aan het netwerk toevoegen of eruit halen',
		handler: 'CanvasNodeList',
		focusIn: 'in de lijst van het netwerk'
	},
	{
		id: 'compare',
		kind: 'focus',
		context: 'vergelijken',
		keys: [arrow('Left', '←'), arrow('Right', '→')],
		join: 'together',
		description: 'Bij Vergelijken: de vorige of volgende wijziging',
		handler: 'VersionCompare'
	}
];

// ── The words of ⌘K ─────────────────────────────────────────────────────────
// ⌘K searches and does (Thijs, 30 Oct: "de combinatie van zoeken en doen wel sterk"): a word of
// this list at the start of what is typed puts a row Doen above the results, which Enter does.
// The word, a prefix of it of three letters or more, or a short form (`kt`). What follows the
// word is its object: a bron as the search finds it, a number of steps, a soort or relatie as
// Tonen and Relatie name them (commands.ts). The page that can do it says so (doen.svelte.ts);
// where none does, the search alone answers.

/** What follows the word: a bron the search finds, a bron of the netwerk, steps, a soort. */
type CommandArg = 'bron' | 'gekozen' | 'stappen' | 'soort';

export type Command = {
	id: string;
	/** The words that call it, the first its name. */
	words: readonly string[];
	/** Short forms that are not a prefix of a word: `kt` for keten. */
	short?: readonly string[];
	/** A sign that calls it before its object: `+uitspraken`, `- wwke`. */
	sign?: '+' | '-';
	context: KeyContext;
	arg?: CommandArg;
	/** The key of SHORTCUTS that does the same, shown beside the row. */
	key?: string;
	description: string;
	/** The flow of the report it answers (docs/claude/ux-review/toetsenbordflows-20261030.md). */
	flow: string;
};

export const COMMANDS: readonly Command[] = [
	{
		id: 'omgeving',
		words: ['omgeving'],
		short: ['om'],
		context: 'netwerk',
		description: 'Weergave Omgeving',
		flow: 'F2'
	},
	{
		id: 'keten',
		words: ['keten'],
		short: ['kt'],
		context: 'netwerk',
		arg: 'bron',
		description: 'Weergave Keten, van deze bron of van de bron die je typt',
		flow: 'F2'
	},
	{
		id: 'verband',
		words: ['verband'],
		short: ['vb'],
		context: 'netwerk',
		arg: 'bron',
		description: 'Weergave Verband; de bron die je typt komt erbij',
		flow: 'F2'
	},
	{
		id: 'stappen',
		words: ['stappen'],
		short: ['s1', 's2', 's3'],
		context: 'netwerk',
		arg: 'stappen',
		description: 'Aantal stappen: hoe ver het netwerk reikt',
		flow: 'F3'
	},
	{
		id: 'gekozen',
		words: ['gekozen'],
		short: ['s0'],
		context: 'netwerk',
		description: 'Alleen de gekozen bronnen en hun onderlinge verbindingen',
		flow: 'F3'
	},
	{
		id: 'tonen',
		words: ['met'],
		sign: '+',
		context: 'netwerk',
		arg: 'soort',
		description: 'Een soort (Tonen) of relatie (Relatie) aan: +uitspraken',
		flow: 'F4'
	},
	{
		id: 'zonder',
		words: ['zonder'],
		sign: '-',
		context: 'netwerk',
		arg: 'soort',
		description: 'Een soort of relatie uit: -stukken',
		flow: 'F4'
	},
	{
		id: 'alleen',
		words: ['alleen'],
		context: 'netwerk',
		arg: 'soort',
		description: 'Alleen deze soort of relatie',
		flow: 'F14'
	},
	{
		id: 'alles',
		words: ['alles'],
		context: 'netwerk',
		description: 'Alle soorten en relaties weer aan',
		flow: 'F4'
	}
];

/** Clicks that are not keys: a link opened at once. In docs and the window, not in the e2e. */
export const MOUSE = {
	id: 'klik',
	keys: 'klik met ⌘ of Ctrl, of de middelste muisknop',
	description: 'Een verwijzing direct openen, zonder kaart'
} as const;

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

/** The key of kind `page` this press is, if any. */
export function shortcutOfEvent(e: KeyLike): { shortcut: Shortcut; combo: Combo } | null {
	for (const shortcut of SHORTCUTS) {
		if (shortcut.kind !== 'page') continue;
		const combo = shortcut.keys.find((c) => isCombo(e, c));
		if (combo) return { shortcut, combo };
	}
	return null;
}
