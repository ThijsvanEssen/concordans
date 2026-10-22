// One ritual for Bewaar, Volg and Kopieer (decision 33, A164). The button that acted changes
// its word; for two seconds a status line says what happened, and where it went, with a link
// there ("Bewaard in Bundel Huurrecht"); the navigation shows a sign at Bundels or Gevolgd until
// the reader has been there; and a screen reader hears the same line (aria-live, WCAG 4.1.3).
// Every action that keeps, follows or copies comes through `announce`, `keptIn` or `followedAt`
// (a guard reads the sources); the line itself is drawn once, by Bevestiging.
import { BUNDLES_PATH } from '$lib/map/page';

export const BEVESTIG_MS = 2000;

type Confirmation = {
	/** What was done, before the destination: `Bewaard in`, or all of it where there is none. */
	text: string;
	/** The destination, as the link's words, and where it leads. */
	to?: { label: string; href: string };
};

let current = $state<Confirmation | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

/** What the status line says now; null once the two seconds are over. */
export const confirmation = {
	get now() {
		return current;
	}
};

/** Says `text` for two seconds; with `to`, the way to where the thing went. */
export function announce(text: string, to?: Confirmation['to']) {
	// A link to the page the reader is on leads nowhere: the words alone.
	const here = typeof location !== 'undefined' && location.pathname === to?.href;
	current = { text, ...(to && !here ? { to } : {}) };
	clearTimeout(timer);
	timer = setTimeout(() => (current = null), BEVESTIG_MS);
}

/** Where the navigation shows a sign for something kept or followed since the reader was there. */
type Sign = 'bundels' | 'gevolgd';
const KEY = 'concordans.teken';
const FOLLOWED_PATH = '/onderwerpen';
const PATHS: Record<Sign, string> = { bundels: BUNDLES_PATH, gevolgd: FOLLOWED_PATH };

const onPage = (sign: Sign, path: string) =>
	path === PATHS[sign] || path.startsWith(`${PATHS[sign]}/`);

function read(): Sign[] {
	try {
		const r = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		return Array.isArray(r) ? r.filter((t): t is Sign => t in PATHS) : [];
	} catch (e) {
		if (import.meta.env.DEV) console.debug('localStorage (unreadable):', e);
		return [];
	}
}
let unseen = $state<Sign[]>(read());

function store(list: Sign[]) {
	unseen = list;
	try {
		if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
		else localStorage.removeItem(KEY);
	} catch (e) {
		if (import.meta.env.DEV) console.debug('localStorage (refused):', e);
	}
}

/** The sign at Bundels or Gevolgd, until the reader has been there. */
export const sign = {
	has: (s: Sign) => unseen.includes(s),
	/** The reader is on `path`: the sign of that page goes. */
	visited(path: string) {
		const rest = unseen.filter((s) => !onPage(s, path));
		if (rest.length !== unseen.length) store(rest);
	},
	set(s: Sign) {
		const here = typeof location !== 'undefined' && onPage(s, location.pathname);
		if (!here && !unseen.includes(s)) store([...unseen, s]);
	}
};

/** Kept in a bundle: the line with the bundle as link, and the sign at Bundels. */
export function keptIn(bundle: string, href: string) {
	announce('Bewaard in', { label: bundle, href });
	sign.set('bundels');
}

/** Taken out of a bundle: said, nothing to go to. */
export function removedFrom(bundle: string) {
	announce(`Weggehaald uit ${bundle}`);
}

/** Followed under Gevolgd: the line with Gevolgd as link, and the sign there. */
export function followedAt() {
	announce('Bewaard bij', { label: 'Gevolgd', href: FOLLOWED_PATH });
	sign.set('gevolgd');
}
