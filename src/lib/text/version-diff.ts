// Two texts compared lid by lid, the old and the new: two tekstversies of one article, or an
// article and the one that takes its place in a new law. The leden of both are paired by
// content, not only by number, so a lid inserted before them does not make every later lid
// look rewritten; where a source pairs leden (a transposition table), its pairing stands. A
// pair whose wording changed in a few words gets those words marked; a pair that changed for
// the most part is paired sentence by sentence first, the words marked within each pair.
import { joinAnd } from './words';
import type { Schema } from '$lib/api/types';
import { partsOf } from './article-parts';

export type DiffSegment = { op: 'eq' | 'del' | 'ins'; text: string };

/** One lid (or the whole text of an article without leden), with its onderdelen. */
export type Unit = { number: string | null; text: string };

type RowKind = 'same' | 'changed' | 'rewritten' | 'added' | 'removed';

export type CompareRow = {
	kind: RowKind;
	old: Unit | null;
	new: Unit | null;
	/** Word-level, for `changed`; for `rewritten` by sentence, empty where none pair. */
	segments: DiffSegment[];
	/** The source (a transposition table) pairs these leden, not their likeness. */
	bySource?: boolean;
};

/** Above this share of changed characters a lid is shown as old and new, unmarked. */
const REWRITTEN = 0.5;

/** Pairs whose shared words fall below this are an insertion and a removal. */
const PAIRED = 0.35;

// BWB writes a non-breaking space where an amendment inserted words ("geslacht, handicap").
const normalize = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

const TOKEN = /\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu;
const tokenize = (s: string) => s.match(TOKEN) ?? [];

function push(out: DiffSegment[], op: DiffSegment['op'], text: string) {
	const last = out[out.length - 1];
	if (last?.op === op) last.text += text;
	else out.push({ op, text });
}

/** Past this many pairs of words, two texts are the old and the new, unmarked. */
const MAX_WORD_PAIRS = 4_000_000;

/** The longest common subsequence of the words of `a` and `b`, as segments. */
export function diffWords(a: string, b: string): DiffSegment[] {
	const x = tokenize(normalize(a));
	const y = tokenize(normalize(b));
	if (x.length * y.length > MAX_WORD_PAIRS)
		return [
			{ op: 'del', text: x.join('') },
			{ op: 'ins', text: y.join('') }
		];
	// The common head and tail first: most amendments touch a few words in the middle.
	let head = 0;
	while (head < x.length && head < y.length && x[head] === y[head]) head++;
	let tail = 0;
	while (
		tail < x.length - head &&
		tail < y.length - head &&
		x[x.length - 1 - tail] === y[y.length - 1 - tail]
	)
		tail++;
	const xs = x.slice(head, x.length - tail);
	const ys = y.slice(head, y.length - tail);
	const n = xs.length;
	const m = ys.length;
	const lcs = new Uint32Array((n + 1) * (m + 1));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			lcs[i * (m + 1) + j] =
				xs[i] === ys[j]
					? lcs[(i + 1) * (m + 1) + j + 1] + 1
					: Math.max(lcs[(i + 1) * (m + 1) + j], lcs[i * (m + 1) + j + 1]);
		}
	}
	const out: DiffSegment[] = [];
	push(out, 'eq', x.slice(0, head).join(''));
	let i = 0;
	let j = 0;
	while (i < n || j < m) {
		if (i < n && j < m && xs[i] === ys[j]) {
			push(out, 'eq', xs[i]);
			i++;
			j++;
		} else if (j < m && (i === n || lcs[i * (m + 1) + j + 1] >= lcs[(i + 1) * (m + 1) + j])) {
			push(out, 'ins', ys[j++]);
		} else {
			push(out, 'del', xs[i++]);
		}
	}
	push(out, 'eq', x.slice(x.length - tail).join(''));
	return tidy(out.filter((s) => s.text));
}

/**
 * A change is read as a phrase: a space or a single short word between two changes
 * joins them, so "a b" → "c d" reads as one replacement, not four fragments.
 */
function tidy(segments: DiffSegment[]): DiffSegment[] {
	const out: DiffSegment[] = [];
	for (let k = 0; k < segments.length; k++) {
		const s = segments[k];
		const between = k > 0 && k < segments.length - 1 && segments[k - 1].op !== 'eq';
		const next = segments[k + 1];
		if (s.op === 'eq' && between && next.op !== 'eq' && /^\s*\S{0,3}\s*$/.test(s.text)) {
			// Joined into both sides of the change, so each version still reads whole.
			push(out, 'del', s.text);
			push(out, 'ins', s.text);
			continue;
		}
		push(out, s.op, s.text);
	}
	return ordered(out);
}

/** Deletions before insertions within one change: the old wording, then the new. */
function ordered(out: DiffSegment[]): DiffSegment[] {
	const sorted: DiffSegment[] = [];
	let run: DiffSegment[] = [];
	const flush = () => {
		for (const op of ['del', 'ins'] as const) {
			const text = run
				.filter((s) => s.op === op)
				.map((s) => s.text)
				.join('');
			if (text) sorted.push({ op, text });
		}
		run = [];
	};
	for (const s of out) {
		if (s.op === 'eq') {
			flush();
			sorted.push(s);
		} else run.push(s);
	}
	flush();
	return sorted;
}

/** The share of the longer text that a change touches, 0 to 1. */
function changedShare(segments: DiffSegment[]): number {
	let same = 0;
	let old = 0;
	let now = 0;
	for (const s of segments) {
		const len = s.text.trim().length;
		if (s.op === 'eq') same += len;
		if (s.op !== 'ins') old += len;
		if (s.op !== 'del') now += len;
	}
	const longest = Math.max(old, now);
	return longest === 0 ? 0 : 1 - same / longest;
}

/** The leden of a version, each with its onderdelen, the number left out. */
const BARE_NUMBER = /^(?:\d+[a-z]?|[a-z]{1,2}|\d+°)\.?$/;

export function unitsOf(
	text: string | null | undefined,
	apiParts: Schema<'ArticlePartDTO'>[] | null | undefined
): Unit[] {
	const source = text ?? '';
	const parts = partsOf(source, apiParts);
	// Text outside the parts (the list of laws in a bijlage between its onderdelen) is a
	// unit of its own: a change there is a change of the article.
	const units: Unit[] = [];
	let at = 0;
	const gap = (to: number) => {
		const text = source.slice(at, to).trim();
		// The number of the part that follows ("2.", "a.") where its offsets leave it out.
		if (text && !BARE_NUMBER.test(text)) units.push({ number: null, text });
	};
	for (const p of [...parts].sort((x, y) => x.start - y.start)) {
		if (p.start < at) continue;
		gap(p.start);
		const text = source.slice(p.textStart, p.end).trim();
		if (text) units.push({ number: p.kind === 'lid' ? p.number : null, text });
		at = p.end;
	}
	gap(source.length);
	return units;
}

function similarity(a: string, b: string): number {
	if (normalize(a) === normalize(b)) return 1;
	return 1 - changedShare(diffWords(a, b));
}

/** The characters a change is measured in: the text without its spaces. */
const weight = (s: string) => s.replace(/\s+/g, '').length;

/** A lid keeps its number unless something moved it; the number weighs a little. */
const SAME_NUMBER = 0.2;

/** Past this many pairs in one stretch, leden pair by place: the cost of a word diff each. */
const MAX_PAIRS = 40_000;

/**
 * The leden of two versions side by side: by content, in order, gaps where one has none.
 * Two leden with the same number pair however much the wording changed, unless a
 * closer match elsewhere says a lid was inserted or removed before them. Leden with the
 * same wording pair first; only the stretches between them are compared word by word, so
 * an article of hundreds of onderdelen (art. 1:1 Wft) with a few changes stays quick.
 */
export function alignUnits(a: Unit[], b: Unit[]): [Unit | null, Unit | null][] {
	const x = a.map((u) => normalize(u.text));
	const y = b.map((u) => normalize(u.text));
	const n = a.length;
	const m = b.length;
	// The longest run of leden with the same wording, in order.
	const lcs = new Uint32Array((n + 1) * (m + 1));
	for (let i = n - 1; i >= 0; i--)
		for (let j = m - 1; j >= 0; j--)
			lcs[i * (m + 1) + j] =
				x[i] === y[j]
					? lcs[(i + 1) * (m + 1) + j + 1] + 1
					: Math.max(lcs[(i + 1) * (m + 1) + j], lcs[i * (m + 1) + j + 1]);
	const out: [Unit | null, Unit | null][] = [];
	let i = 0;
	let j = 0;
	let fromI = 0;
	let fromJ = 0;
	const stretch = (toI: number, toJ: number) =>
		out.push(...alignSimilar(a.slice(fromI, toI), b.slice(fromJ, toJ)));
	while (i < n && j < m) {
		if (x[i] === y[j]) {
			stretch(i, j);
			out.push([a[i++], b[j++]]);
			fromI = i;
			fromJ = j;
		} else if (lcs[(i + 1) * (m + 1) + j] >= lcs[i * (m + 1) + j + 1]) i++;
		else j++;
	}
	stretch(n, m);
	return out;
}

/** One stretch of leden without a shared wording, paired by likeness (Needleman–Wunsch). */
function alignSimilar(a: Unit[], b: Unit[]): [Unit | null, Unit | null][] {
	const n = a.length;
	const m = b.length;
	if (n === 0 || m === 0)
		return [...a.map((u) => [u, null]), ...b.map((u) => [null, u])] as [Unit | null, Unit | null][];
	if (n * m > MAX_PAIRS) {
		const out: [Unit | null, Unit | null][] = [];
		for (let k = 0; k < Math.max(n, m); k++) out.push([a[k] ?? null, b[k] ?? null]);
		return out;
	}
	const wa = a.map((u) => weight(u.text));
	const wb = b.map((u) => weight(u.text));
	const pair = a.map((p, i) =>
		b.map((q, j) => {
			const same = p.number === q.number;
			// The shorter text can share no more than its own length.
			const bound = Math.max(wa[i], wb[j]) ? Math.min(wa[i], wb[j]) / Math.max(wa[i], wb[j]) : 1;
			if (!same && bound < PAIRED) return -1;
			const sim = similarity(p.text, q.text);
			return sim >= PAIRED || same ? sim + (same ? SAME_NUMBER : 0) : -1;
		})
	);
	// A pair scores its similarity, a gap nothing.
	const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			const paired = pair[i][j] < 0 ? -1 : score[i + 1][j + 1] + pair[i][j];
			score[i][j] = Math.max(paired, score[i + 1][j], score[i][j + 1]);
		}
	}
	const out: [Unit | null, Unit | null][] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (pair[i][j] >= 0 && score[i][j] === score[i + 1][j + 1] + pair[i][j])
			out.push([a[i++], b[j++]]);
		else if (score[i][j] === score[i + 1][j]) out.push([a[i++], null]);
		else out.push([null, b[j++]]);
	}
	while (i < n) out.push([a[i++], null]);
	while (j < m) out.push([null, b[j++]]);
	return out;
}

type TextLike = { text?: string | null; parts?: Schema<'ArticlePartDTO'>[] | null };

/** Leden of the old text a source places together in leden of the new: `1, 2, 3 → 1`. */
export type LidPairing = { old: string[]; new: string[] };

/**
 * The old text against the new, lid by lid: two tekstversies of one article, or an article
 * against the one that takes its place. A pairing of the source holds where both texts have
 * its leden and it keeps their order; the leden between are paired by content.
 */
export function compareTexts(
	old: TextLike,
	now: TextLike,
	pairings: readonly LidPairing[] = []
): CompareRow[] {
	const a = unitsOf(old.text, old.parts);
	const b = unitsOf(now.text, now.parts);
	const pinned = pinPairings(a, b, pairings);
	const rows: CompareRow[] = [];
	let i = 0;
	let j = 0;
	for (const pin of pinned) {
		rows.push(
			...alignUnits(a.slice(i, pin.i), b.slice(j, pin.j)).map(([x, y]) => compareUnits(x, y))
		);
		rows.push({ ...compareUnits(pin.old, pin.new), bySource: true });
		i = pin.i + pin.oldCount;
		j = pin.j + pin.newCount;
	}
	rows.push(...alignUnits(a.slice(i), b.slice(j)).map(([x, y]) => compareUnits(x, y)));
	return rows;
}

type Pin = { i: number; j: number; oldCount: number; newCount: number; old: Unit; new: Unit };

/**
 * Leden taken together: one unit, each lid after the first with its number, so the text
 * still reads whole and the first lid's words meet those of the lid it goes into.
 */
function joined(units: Unit[]): Unit {
	if (units.length === 1) return units[0];
	return {
		number: joinAnd(units.map((u) => u.number ?? '')),
		text: units.map((u, k) => (k === 0 ? u.text : `${u.number}. ${u.text}`)).join('\n')
	};
}

/**
 * The pairings both texts can hold, in order: each names leden that stand together in both
 * (`1, 2, 3`, not `1, 3`) and comes after the one before it.
 */
function pinPairings(a: Unit[], b: Unit[], pairings: readonly LidPairing[]): Pin[] {
	const run = (units: Unit[], numbers: string[]) => {
		const at = units.findIndex((u) => u.number === numbers[0]);
		if (at < 0) return null;
		const slice = units.slice(at, at + numbers.length);
		return slice.length === numbers.length && slice.every((u, k) => u.number === numbers[k])
			? at
			: null;
	};
	const pins: Pin[] = [];
	for (const p of pairings) {
		if (p.old.length === 0 || p.new.length === 0) continue;
		const i = run(a, p.old);
		const j = run(b, p.new);
		if (i === null || j === null) continue;
		pins.push({
			i,
			j,
			oldCount: p.old.length,
			newCount: p.new.length,
			old: joined(a.slice(i, i + p.old.length)),
			new: joined(b.slice(j, j + p.new.length))
		});
	}
	pins.sort((x, y) => x.i - y.i);
	const kept: Pin[] = [];
	for (const pin of pins) {
		const last = kept.at(-1);
		if (!last || (pin.i >= last.i + last.oldCount && pin.j >= last.j + last.newCount))
			kept.push(pin);
	}
	return kept;
}

/**
 * One lid against its earlier wording: the words marked; for a lid rewritten for the most
 * part, the sentences that stayed paired and their words marked, or old and new in full.
 */
export function compareUnits(old: Unit | null, now: Unit | null): CompareRow {
	if (!old) return { kind: 'added', old, new: now, segments: [] };
	if (!now) return { kind: 'removed', old, new: now, segments: [] };
	if (normalize(old.text) === normalize(now.text))
		return { kind: 'same', old, new: now, segments: [] };
	const segments = diffWords(old.text, now.text);
	if (changedShare(segments) <= REWRITTEN) return { kind: 'changed', old, new: now, segments };
	const bySentence = diffSentences(old.text, now.text);
	return { kind: 'rewritten', old, new: now, segments: bySentence ?? [] };
}

// A sentence ends at a full stop before a capital (not at "art. 126ffa"), or at a semicolon
// or colon, where an enumeration goes on.
const SENTENCE_END = /(?<=[;:])\s+|(?<=\S\.)\s+(?=\p{Lu})/gu;

/** The sentences of a text, each with the spaces after it: together they are the text. */
export function splitSentences(text: string): string[] {
	const out: string[] = [];
	let at = 0;
	for (const m of text.matchAll(SENTENCE_END)) {
		const end = m.index + m[0].length;
		out.push(text.slice(at, end));
		at = end;
	}
	if (at < text.length) out.push(text.slice(at));
	return out;
}

/**
 * A rewritten text by sentence: the sentences paired by likeness, the words of each pair
 * marked, a sentence without a pair struck or inserted whole. Null when no sentence pairs.
 */
function diffSentences(a: string, b: string): DiffSegment[] | null {
	// Numbers of their own, so no two sentences pair because they share one.
	const x = splitSentences(a).map((text, k) => ({ number: `a${k}`, text }));
	const y = splitSentences(b).map((text, k) => ({ number: `b${k}`, text }));
	const pairs = alignSimilar(x, y);
	if (!pairs.some(([p, q]) => p && q)) return null;
	const out: DiffSegment[] = [];
	for (const [p, q] of pairs) {
		if (p && q) for (const s of diffWords(p.text, q.text)) push(out, s.op, s.text);
		else if (p) push(out, 'del', p.text);
		else if (q) push(out, 'ins', q.text);
	}
	return ordered(out);
}

type PartChange = Schema<'VersionPartChangeDTO'>;

/** "lid 4", "leden 1, 3 en 5"; null when the article has no leden. */
function namedLeden(numbers: string[]): string | null {
	if (numbers.length === 0) return null;
	if (numbers.length === 1) return `lid ${numbers[0]}`;
	return `leden ${joinAnd(numbers)}`;
}

/** The number of a lid the API names; null for another part (the aanhef, a definition). */
const lidOf = (c: PartChange) => (c.kind === 'lid' ? c.number : null);

/**
 * What a version changed, in one short phrase, from the parts the API lists: "lid 4
 * gewijzigd". A version that changed its text without parts to name changed the text.
 */
function summarizeChanges(changes: readonly PartChange[] | null | undefined): string {
	const phrases: string[] = [];
	const verbs: [PartChange['change'], string][] = [
		['changed', 'gewijzigd'],
		['added', 'ingevoegd'],
		['removed', 'vervallen']
	];
	for (const [change, verb] of verbs) {
		const of = (changes ?? []).filter((c) => c.change === change);
		if (of.length === 0) continue;
		const named = namedLeden(of.map(lidOf).filter((n): n is string => !!n));
		phrases.push(named ? `${named} ${verb}` : `tekst ${verb}`);
	}
	return phrases.join(', ') || 'tekst gewijzigd';
}

// ── Tekstversies ─────────────────────────────────────────────────────────────────
// The BWB makes a new version of an article whenever the regeling around it changes;
// most of them repeat the wording. A tekstversie is a run of versions with one wording,
// dated from the version that introduced it. The history lists the versions without their
// text: whether each changed the wording (`text_changed`) and which parts (`changes`). The
// text of one is asked when it is read (`history/{key}`).

type VersionLike = {
	key: string;
	valid_from?: string | null;
	valid_until?: string | null;
	/** The geldende tekst: the API marks the one version in force. */
	current?: boolean;
	/** Its wording differs from the version before it; true for the first. */
	text_changed?: boolean;
	/** The parts it changed against the version before it. */
	changes?: readonly PartChange[] | null;
};

export type Wording<V extends VersionLike = VersionLike> = {
	index: number;
	/** The BWB versions with this wording, oldest first. */
	versions: V[];
	/** The version that introduced the wording: its publication is the amendment. */
	first: V;
	from: string | null;
	/** Null while the wording is geldend recht. */
	until: string | null;
	/** The version that repealed the article: the API gives it no period (`until` equals `from`). */
	lapsed: boolean;
	summary: string;
};

export function wordingsOf<V extends VersionLike>(versions: V[]): Wording<V>[] {
	const out: Wording<V>[] = [];
	for (const v of versions) {
		const last = out.at(-1);
		if (last && !v.text_changed) {
			last.versions.push(v);
			last.until = v.current ? null : (v.valid_until ?? null);
			continue;
		}
		const until = v.current ? null : (v.valid_until ?? null);
		const lapsed = !!v.valid_from && v.valid_from === until;
		out.push({
			index: out.length,
			versions: [v],
			first: v,
			from: v.valid_from ?? null,
			until,
			lapsed,
			summary: lapsed
				? 'vervallen'
				: last
					? summarizeChanges(v.changes)
					: 'oudste tekst in de gegevens'
		});
	}
	return out;
}

/** Tekstversies by the year they took effect, in their order: the groups of a list. */
export function byYear<W extends { from: string | null }>(wordings: W[]): [string, W[]][] {
	const out: [string, W[]][] = [];
	for (const w of wordings) {
		const year = w.from?.slice(0, 4) ?? 'Zonder datum';
		const last = out.at(-1);
		if (last && last[0] === year) last[1].push(w);
		else out.push([year, [w]]);
	}
	return out;
}

/** The tekstversie a BWB version belongs to, by its date or its key. */
export const wordingOf = <V extends VersionLike>(wordings: Wording<V>[], id: string) =>
	wordings.find((w) => w.versions.some((v) => (v.valid_from ?? v.key) === id)) ?? null;

/** Every lid number the history names a change of, in the order of the law. */
export function changedLeden(wordings: Wording[]): string[] {
	const numbers = new Set<string>();
	for (const w of wordings)
		for (const c of w.index > 0 ? (w.first.changes ?? []) : []) {
			const n = lidOf(c);
			if (n) numbers.add(n);
		}
	return sortLeden([...numbers]);
}

/** Lid numbers in the order of the law: 2 before 2a before 10. */
export const sortLeden = (numbers: string[]) =>
	[...new Set(numbers)].sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));

export type Formulation<V extends VersionLike = VersionLike> = {
	/** The first and the last tekstversie that carry this formulation of the lid. */
	since: Wording<V>;
	through: Wording<V>;
	/** How it came: the oldest in the data, a new wording, or a lid inserted. */
	kind: 'first' | 'changed' | 'added';
};

type LidHistory<V extends VersionLike = VersionLike> = {
	formulations: Formulation<V>[];
	/** The tekstversie in which the lid no longer occurs, if it went. */
	removedIn: Wording<V> | null;
};

/**
 * Every formulation of one lid, oldest first, from the changes the history lists by the
 * lid's number. A lid the history names no change of has one formulation, the oldest; its
 * text tells whether it is there at all.
 */
export function lidHistory<V extends VersionLike>(
	wordings: Wording<V>[],
	number: string
): LidHistory<V> | null {
	if (wordings.length === 0) return null;
	const changeAt = (w: Wording<V>) =>
		w.index === 0 ? null : (w.first.changes?.find((c) => lidOf(c) === number)?.change ?? null);
	const firstChange = wordings.map(changeAt).find((c) => c !== null);
	const formulations: Formulation<V>[] = [];
	let removedIn: Wording<V> | null = null;
	let open: Formulation<V> | null =
		firstChange === 'added' ? null : { since: wordings[0], through: wordings[0], kind: 'first' };
	if (open) formulations.push(open);
	for (const w of wordings.slice(1)) {
		const change = changeAt(w);
		if (change === 'removed') {
			open = null;
			removedIn = w;
		} else if (change === 'added' || change === 'changed') {
			open = { since: w, through: w, kind: open ? 'changed' : 'added' };
			formulations.push(open);
			removedIn = null;
		} else if (open) open.through = w;
	}
	return formulations.length > 0 ? { formulations, removedIn } : null;
}

/**
 * A comparison as plain text, for a note or a paper: `[-geschrapt-]` and `[+ingevoegd+]`,
 * one lid per line.
 */
export function plainDiff(rows: CompareRow[]): string {
	const del = (s: string) => `[-${s}-]`;
	const ins = (s: string) => `[+${s}+]`;
	return rows
		.map((r) => {
			const number = (r.new ?? r.old)?.number;
			const body =
				r.kind === 'same'
					? (r.new?.text ?? '')
					: r.kind === 'added'
						? ins(r.new?.text ?? '')
						: r.kind === 'removed'
							? del(r.old?.text ?? '')
							: r.kind === 'rewritten'
								? `${del(r.old?.text ?? '')} ${ins(r.new?.text ?? '')}`
								: r.segments
										.map((s) => {
											if (s.op === 'eq') return s.text;
											const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(s.text)!;
											return lead + (s.op === 'del' ? del(core) : ins(core)) + trail;
										})
										.join('');
			return number ? `${number}. ${body}` : body;
		})
		.join('\n');
}

/**
 * Where the words `[start, end)` of `a` stand in `b`, followed through their comparison: the
 * part of `b` that holds what stands of them and what was put in their place; `struck` where
 * every word of them was struck. An arcering kept in an earlier tekstversie is found so.
 */
export function followWords(
	a: string,
	b: string,
	start: number,
	end: number
): [number, number] | 'struck' {
	let o = 0;
	let n = 0;
	let from = Infinity;
	let to = -Infinity;
	for (const seg of diffWords(a, b)) {
		const len = seg.text.length;
		if (seg.op === 'eq') {
			const s = Math.max(o, start);
			const e = Math.min(o + len, end);
			if (s < e && seg.text.slice(s - o, e - o).trim()) {
				from = Math.min(from, n + s - o);
				to = Math.max(to, n + e - o);
			}
			o += len;
			n += len;
		} else if (seg.op === 'del') o += len;
		else {
			// Words put in within them, or in place of their last words.
			if (o > start && o < end && seg.text.trim()) {
				from = Math.min(from, n);
				to = Math.max(to, n + len);
			} else if ((o === start || o === end) && seg.text.trim() && from !== Infinity) {
				to = Math.max(to, n + len);
			}
			n += len;
		}
	}
	return from === Infinity ? 'struck' : [from, to];
}
