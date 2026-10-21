// Words in a text as an anchor (O4, besluit 24): a fragment lies within one place of a bron (a
// lid, an onderdeel, an r.o., an alinea `p-`, a passage `s-`), as its words, as much of the text
// before and after as makes them one, and their position in the place's text (a W3C
// TextQuoteSelector, the position deciding between equals). The text of a place is the one the
// reader shows, its spaces folded: `placeText` gives it to the reader that draws and to
// `resolve` that finds a fragment again, so both count alike. A fragment found elsewhere is
// shown there with its mark; the anchor as kept is never written back.
import type { Fragment } from '$lib/map/map';
import type { ArticlePart } from './article-parts';
import { paperParagraphs, paperSectionOf, type PaperSource } from './anchor';
import { followWords } from './version-diff';

/** A place in a bron: its id and its words in the bron's text, `[start, end)`. */
type Place = { id: string; start: number; end: number };

/** A bron as text: all its words in the order read, its spaces folded, and its places. */
export type Places = { text: string; places: Place[] };

/** The place an article is as a whole, where the selection holds more than one lid. */
export const WHOLE_ARTICLE = 'artikel';

/** The longest prefix or suffix a fragment keeps. */
const CONTEXT = 32;

/** The spaces of a text folded: one space for every run, a non-breaking one too. */
const WHITE = /[\s\u00a0\u202f]+/g;

/** A text built piece by piece with its spaces folded, a space between blocks. */
class Folded {
	text = '';
	#gap = false;
	/** Where the next word goes: after the space a block before it leaves. */
	get next() {
		return this.text && this.#gap ? this.text.length + 1 : this.text.length;
	}
	block() {
		this.#gap = true;
	}
	add(s: string) {
		const folded = s.replace(WHITE, ' ');
		const words = folded.trim();
		if (!words) {
			if (folded) this.#gap = true;
			return;
		}
		if (this.text && (this.#gap || folded.startsWith(' '))) this.text += ' ';
		this.text += words;
		this.#gap = folded.endsWith(' ');
	}
}

/**
 * An article as a places: the text of each part without its number, its parts in the order of
 * the law, the closing words of a lid its own; each part with an anchor a place, the article a
 * place as a whole (`artikel`).
 */
export function articlePlaces(source: string, parts: readonly ArticlePart[]): Places {
	const t = new Folded();
	const places: Place[] = [];
	const visit = (part: ArticlePart) => {
		t.block();
		const start = t.next;
		t.add(source.slice(part.textStart, part.textEnd));
		let at = part.textEnd;
		for (const child of part.children) {
			// Text between the own text and a child that is no number of it: the lid's own.
			if (child.start > at) t.add(source.slice(at, child.start));
			visit(child);
			at = child.end;
		}
		if (part.end > at && part.children.length) {
			t.block();
			t.add(source.slice(at, part.end));
		}
		if (part.id) places.push({ id: part.id, start, end: Math.max(start, t.text.length) });
	};
	for (const part of parts) visit(part);
	places.push({ id: WHOLE_ARTICLE, start: 0, end: t.text.length });
	return { text: t.text, places };
}

/**
 * A Kamerstuk as a places: its lines (`paperParagraphs`), an alinea a place by its anchor
 * (`p-…`, its lines together) and a section a place (`s-…`, the lines from its heading to
 * its end).
 */
export function paperPlaces(doc: PaperSource): Places {
	const t = new Folded();
	const lines = paperParagraphs(doc).map((line) => {
		t.block();
		const start = t.next;
		t.add(line.text);
		return { line, start, end: t.text.length };
	});
	const places: Place[] = [];
	const paragraphs = new Map<string, Place>();
	for (const { line, start, end } of lines) {
		if (!line.at) continue;
		const p = paragraphs.get(line.at);
		if (p) p.end = end;
		else paragraphs.set(line.at, { id: line.at, start, end });
	}
	places.push(...paragraphs.values());
	const sections = doc.sections ?? [];
	const text = doc.text ?? '';
	sections.forEach((s, i) => {
		const id = s.id ?? `s-${i + 1}`;
		if (paperSectionOf(sections, id) !== s) return;
		const own = lines.filter(
			(l) => l.line.start >= s.char_start && l.line.start < (s.char_end ?? text.length)
		);
		if (own.length) places.push({ id, start: own[0].start, end: own.at(-1)!.end });
	});
	return { text: t.text, places };
}

const findPlace = (places: Places, place: string) => places.places.find((p) => p.id === place);

/** The text of a place as the reader shows it; null for a place the bron does not have. */
export function placeText(places: Places, place: string): string | null {
	const p = findPlace(places, place);
	return p ? places.text.slice(p.start, p.end) : null;
}

/** The smallest place that holds `[start, end)` of the bron's text; none where none does. */
export function smallestPlace(places: Places, start: number, end: number): Place | null {
	let best: Place | null = null;
	for (const p of places.places)
		if (p.start <= start && end <= p.end && (!best || p.end - p.start < best.end - best.start))
			best = p;
	return best;
}

/** Every position of `exact` in `text`. */
function positions(text: string, exact: string): number[] {
	const found: number[] = [];
	if (!exact) return found;
	for (let i = text.indexOf(exact); i !== -1; i = text.indexOf(exact, i + 1)) found.push(i);
	return found;
}

/**
 * The fragment of the words `[start, end)` of a place: its words without the space around
 * them, and a prefix and suffix only as long as it takes to make them one in the place (at
 * most 32 signs; the position decides where that is not enough). Null for no words.
 */
export function fragmentOf(
	places: Places,
	place: string,
	start: number,
	end: number
): Fragment | null {
	const text = placeText(places, place);
	if (text === null) return null;
	let s = Math.max(0, Math.min(start, end));
	let e = Math.min(text.length, Math.max(start, end));
	while (s < e && text[s] === ' ') s++;
	while (e > s && text[e - 1] === ' ') e--;
	if (s === e) return null;
	const exact = text.slice(s, e);
	let k = 0;
	const unique = (n: number) => positions(text, text.slice(Math.max(0, s - n), e + n)).length === 1;
	while (k < CONTEXT && !unique(k)) k++;
	const prefix = text.slice(Math.max(0, s - k), s);
	const suffix = text.slice(e, e + k);
	return {
		waar: place,
		exact,
		...(prefix ? { prefix } : {}),
		...(suffix ? { suffix } : {}),
		start: s
	};
}

/**
 * How a fragment was found in the text on screen (besluit 23), its place now and its words
 * there, `[start, end)` of the place's text: `found` on its place or elsewhere in it (no mark),
 * `moved` to another place (`Nu in lid 3`), `changed` with a new tekstversie (`Tekst gewijzigd
 * per …`), `lapsed` struck by one (`Vervallen per …`), `lost` nowhere (`Fragment niet
 * teruggevonden`).
 */
export type Hit =
	| { state: 'found' | 'moved'; place: string; start: number; end: number }
	| { state: 'changed'; place: string; start: number; end: number; since: string }
	| { state: 'lapsed'; place: string; since: string }
	| { state: 'lost'; place: string };

/** How many signs before and after `exact` at `at` agree with the prefix and the suffix. */
function contextScore(text: string, at: number, f: Fragment): number {
	let n = 0;
	const before = f.prefix ?? '';
	const after = f.suffix ?? '';
	while (n < before.length && text[at - 1 - n] === before[before.length - 1 - n]) n++;
	let m = 0;
	const end = at + f.exact.length;
	while (m < after.length && text[end + m] === after[m]) m++;
	return n + m;
}

/** Step 1 and 2: `exact` at its position in the place, or elsewhere in it. */
function inPlace(places: Places, f: Fragment): Hit | null {
	const text = placeText(places, f.waar);
	if (text === null) return null;
	if (text.startsWith(f.exact, f.start))
		return { state: 'found', place: f.waar, start: f.start, end: f.start + f.exact.length };
	const found = positions(text, f.exact);
	if (!found.length) return null;
	const best = found.reduce((a, b) => {
		const d = contextScore(text, b, f) - contextScore(text, a, f);
		return d > 0 || (d === 0 && Math.abs(b - f.start) < Math.abs(a - f.start)) ? b : a;
	});
	return { state: 'found', place: f.waar, start: best, end: best + f.exact.length };
}

/** `[start, end)` of the bron's text as a hit in the smallest place that holds it. */
function hitAt(places: Places, start: number, end: number) {
	const p = smallestPlace(places, start, end);
	return p ? { place: p.id, start: start - p.start, end: end - p.start } : null;
}

/** Step 3: `exact` once in the whole places, in another place. */
function elsewhere(places: Places, f: Fragment): Hit | null {
	const found = positions(places.text, f.exact);
	if (found.length !== 1) return null;
	const hit = hitAt(places, found[0], found[0] + f.exact.length);
	return hit && { state: 'moved', ...hit };
}

/** The fragment's words in the bron's text, `[start, end)`, by step 1 to 3; null where not. */
function locate(places: Places, f: Fragment): [number, number] | null {
	const t = inPlace(places, f) ?? elsewhere(places, f);
	if (!t || !('start' in t)) return null;
	const p = findPlace(places, t.place)!;
	return [p.start + t.start, p.start + t.end];
}

/** The text the fragment was kept in (`MapItem.versie`) and the day the text on screen took
 *  effect: the words are followed from the one to the other. */
type Earlier = { places: Places; since: string };

/**
 * Step 4: the words of the kept text followed into the text on screen word by word
 * (`followWords`). What stands of them, or what replaced them, is the hit; where all of them
 * were struck, none.
 */
function through(places: Places, f: Fragment, earlier: Earlier): Hit | null {
	const was = locate(earlier.places, f);
	if (!was) return null;
	const now = followWords(earlier.places.text, places.text, was[0], was[1]);
	if (now === 'struck') return { state: 'lapsed', place: f.waar, since: earlier.since };
	let [from, to] = now;
	while (from < to && places.text[from] === ' ') from++;
	while (to > from && places.text[to - 1] === ' ') to--;
	const hit = hitAt(places, from, to);
	if (!hit) return null;
	if (places.text.slice(from, to) !== f.exact)
		return { state: 'changed', ...hit, since: earlier.since };
	return { state: hit.place === f.waar ? 'found' : 'moved', ...hit };
}

/**
 * The fragment in the text on screen, by the first of four steps that finds it: on its
 * position in its place; elsewhere in its place (prefix and suffix, then the nearest); once in
 * another place of the bron (`moved`); through the kept tekstversie (`earlier`), its words
 * changed or struck. Else `lost`: never a guess, never words that are only alike.
 */
export function resolve(places: Places, f: Fragment, earlier: Earlier | null = null): Hit {
	return (
		inPlace(places, f) ??
		elsewhere(places, f) ??
		(earlier ? through(places, f, earlier) : null) ?? { state: 'lost', place: f.waar }
	);
}
