// One ritual for Bewaar, Volg and Kopieer (decision 33, A164). The button that acted changes
// its word; for two seconds a status line says what happened, and where it went, with a link
// there ("Bewaard in Huurrecht. Ongedaan maken"); it stays while the pointer or the focus is
// in it, and a line with a way back stays longer; the navigation shows a sign at Bundels or Gevolgd until
// the reader has been there; and a screen reader hears the same line (aria-live, WCAG 4.1.3).
// Every action that keeps, follows or copies comes through `announce`, `keptIn` or `followedAt`
// (a guard reads the sources); the line itself is drawn once, by Bevestiging.
import { BUNDLES_PATH } from '$lib/map/page';

export const BEVESTIG_MS = 2000;
/** A line with a way back (Ongedaan maken) is read and answered, not only seen. */
const ONGEDAAN_MS = 5000;

type Confirmation = {
	/** What was done, before the destination: `Bewaard in`, or all of it where there is none. */
	text: string;
	/** The destination, as the link's words, and where it leads. */
	to?: { label: string; href: string };
	/** The way back: Ongedaan maken takes the thing back. */
	undo?: () => void;
};

let current = $state<Confirmation | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
let ms = BEVESTIG_MS;

/** What the status line says now; null once the two seconds are over. */
export const confirmation = {
	get now() {
		return current;
	}
};

/** Says `text` for two seconds; with `to`, the way to where the thing went. */
export function announce(text: string, to?: Confirmation['to'], undo?: () => void) {
	// A link to the page the reader is on leads nowhere: the words alone.
	const here = typeof location !== 'undefined' && location.pathname === to?.href;
	current = { text, ...(to && !here ? { to } : {}), ...(undo ? { undo } : {}) };
	ms = undo ? ONGEDAAN_MS : BEVESTIG_MS;
	start();
}

function start() {
	clearTimeout(timer);
	timer = setTimeout(() => (current = null), ms);
}

/** The pointer or the focus is in the line: it stays until they leave. */
export function hold(on: boolean) {
	if (on) clearTimeout(timer);
	else if (current) start();
}

/** Ongedaan maken: the way back, and the line is done. */
export function undo() {
	const back = current?.undo;
	clearTimeout(timer);
	current = null;
	back?.();
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

/** The first Bewaar of a session says where it stays (F17): once per session, not per page. */
const NOTICE_KEY = 'concordans.bewaarmelding';
let noticeSeen = false;

/** True the first time in a session; the page works without storage (then once per page load). */
function firstOfSession(): boolean {
	if (noticeSeen) return false;
	noticeSeen = true;
	try {
		if (sessionStorage.getItem(NOTICE_KEY)) return false;
		sessionStorage.setItem(NOTICE_KEY, '1');
	} catch (e) {
		if (import.meta.env.DEV) console.debug('sessionStorage (refused):', e);
	}
	return true;
}

let noticeNow = $state<{ bundle: string; href: string } | null>(null);

/** The notice of the first Bewaar: it stays until the reader closes it (BewaarMelding). */
export const notice = {
	get now() {
		return noticeNow;
	},
	close() {
		noticeNow = null;
	}
};

/** Kept in a bundle: the line with the bundle as link, and the sign at Bundels. The first
 *  Bewaar of a session gives the notice in its place, which also says where the bundle stays. */
export function keptIn(bundle: string, href: string, undo?: () => void) {
	if (firstOfSession()) noticeNow = { bundle, href };
	else announce('Bewaard in', { label: bundle, href }, undo);
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
