// Two versions of an article, lid by lid. The leden of both are paired by content, not
// only by number, so a lid inserted before them does not make every later lid look
// rewritten. A pair whose wording changed in a few words gets those words marked; a
// pair that changed for the most part is shown as the old text and the new.
import type { Schema } from '$lib/api/types';
import { parseArticleParts, partsFromApi } from './article-parts';

export type Segment = { op: 'eq' | 'del' | 'ins'; text: string };

/** One lid (or the whole text of an article without leden), with its onderdelen. */
export type Unit = { number: string | null; text: string };

export type RowKind = 'same' | 'changed' | 'rewritten' | 'added' | 'removed';

export type CompareRow = {
	kind: RowKind;
	old: Unit | null;
	new: Unit | null;
	/** Word-level, for `changed`; empty otherwise. */
	segments: Segment[];
};

/** Above this share of changed characters a lid is shown as old and new, unmarked. */
export const REWRITTEN = 0.5;

/** Pairs whose shared words fall below this are an insertion and a removal. */
const PAIRED = 0.35;

// BWB writes a non-breaking space where an amendment inserted words ("geslacht, handicap").
const normalize = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

const TOKEN = /\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu;
const tokenize = (s: string) => s.match(TOKEN) ?? [];

function push(out: Segment[], op: Segment['op'], text: string) {
	const last = out[out.length - 1];
	if (last?.op === op) last.text += text;
	else out.push({ op, text });
}

/** The longest common subsequence of the words of `a` and `b`, as segments. */
export function diffWords(a: string, b: string): Segment[] {
	const x = tokenize(normalize(a));
	const y = tokenize(normalize(b));
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
	const out: Segment[] = [];
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
function tidy(segments: Segment[]): Segment[] {
	const out: Segment[] = [];
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
	// Deletions before insertions within one change: the old wording, then the new.
	const sorted: Segment[] = [];
	let run: Segment[] = [];
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
export function changedShare(segments: Segment[]): number {
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
	const parts = apiParts?.length ? partsFromApi(apiParts) : parseArticleParts(source);
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

/** A lid keeps its number unless something moved it; the number weighs a little. */
const SAME_NUMBER = 0.2;

/**
 * The leden of two versions side by side: by content, in order, gaps where one has none.
 * Two leden with the same number pair however much the wording changed, unless a
 * closer match elsewhere says a lid was inserted or removed before them.
 */
export function alignUnits(a: Unit[], b: Unit[]): [Unit | null, Unit | null][] {
	const n = a.length;
	const m = b.length;
	const pair = a.map((x) =>
		b.map((y) => {
			const sim = similarity(x.text, y.text);
			const same = x.number === y.number;
			return sim >= PAIRED || same ? sim + (same ? SAME_NUMBER : 0) : -1;
		})
	);
	// Needleman–Wunsch: a pair scores its similarity, a gap nothing.
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

export function compareVersions(
	from: { text?: string | null; parts?: Schema<'ArticlePartDTO'>[] | null },
	to: { text?: string | null; parts?: Schema<'ArticlePartDTO'>[] | null }
): CompareRow[] {
	return alignUnits(unitsOf(from.text, from.parts), unitsOf(to.text, to.parts)).map(
		([old, now]) => {
			if (!old) return { kind: 'added', old, new: now, segments: [] };
			if (!now) return { kind: 'removed', old, new: now, segments: [] };
			if (normalize(old.text) === normalize(now.text))
				return { kind: 'same', old, new: now, segments: [] };
			const segments = diffWords(old.text, now.text);
			return changedShare(segments) > REWRITTEN
				? { kind: 'rewritten', old, new: now, segments: [] }
				: { kind: 'changed', old, new: now, segments };
		}
	);
}

/** Whether two versions have the same wording, whatever else the BWB changed. */
export const sameText = (a: string | null | undefined, b: string | null | undefined) =>
	normalize(a ?? '').trim() === normalize(b ?? '').trim();

const lidName = (r: CompareRow) => (r.new ?? r.old)?.number ?? null;

/** "lid 4", "leden 1, 3 en 5"; null when the article has no leden. */
export function namedLeden(numbers: string[]): string | null {
	if (numbers.length === 0) return null;
	if (numbers.length === 1) return `lid ${numbers[0]}`;
	return `leden ${numbers.slice(0, -1).join(', ')} en ${numbers[numbers.length - 1]}`;
}

/** What changed between two versions, in one short phrase: "lid 4 gewijzigd". */
export function summarize(rows: CompareRow[]): string {
	const of = (kind: RowKind) => rows.filter((r) => r.kind === kind).map((r) => lidName(r) ?? '');
	const phrases: string[] = [];
	const changed = [...of('changed'), ...of('rewritten')];
	const verbs: [string[], string][] = [
		[changed, 'gewijzigd'],
		[of('added'), 'ingevoegd'],
		[of('removed'), 'vervallen']
	];
	for (const [numbers, verb] of verbs) {
		if (numbers.length === 0) continue;
		const named = namedLeden(numbers.filter(Boolean));
		phrases.push(named ? `${named} ${verb}` : `tekst ${verb}`);
	}
	if (phrases.length === 0) return 'tekst ongewijzigd';
	return phrases.join(', ');
}

// ── Tekstversies ─────────────────────────────────────────────────────────────────
// The BWB makes a new version of an article whenever the regeling around it changes;
// most of them repeat the wording. A tekstversie is a run of versions with one wording,
// dated from the version that introduced it.

type VersionLike = {
	key: string;
	valid_from?: string | null;
	valid_until?: string | null;
	/** The geldende tekst: the API marks the one version in force. */
	current?: boolean;
	text?: string | null;
	parts?: Schema<'ArticlePartDTO'>[] | null;
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
	/** Against the wording before; null for the oldest. */
	rows: CompareRow[] | null;
	summary: string;
};

export function wordingsOf<V extends VersionLike>(versions: V[]): Wording<V>[] {
	const out: Wording<V>[] = [];
	for (const v of versions) {
		const last = out.at(-1);
		if (last && sameText(last.first.text, v.text)) {
			last.versions.push(v);
			last.until = v.current ? null : (v.valid_until ?? null);
			continue;
		}
		const until = v.current ? null : (v.valid_until ?? null);
		const lapsed = !!v.valid_from && v.valid_from === until;
		const rows = last ? compareVersions(last.first, v) : null;
		out.push({
			index: out.length,
			versions: [v],
			first: v,
			from: v.valid_from ?? null,
			until,
			lapsed,
			rows,
			summary: lapsed ? 'vervallen' : rows ? summarize(rows) : 'oudste tekst in de dataset'
		});
	}
	return out;
}

/** The tekstversie a BWB version belongs to, by its date or its key. */
export const wordingOf = <V extends VersionLike>(wordings: Wording<V>[], id: string) =>
	wordings.find((w) => w.versions.some((v) => (v.valid_from ?? v.key) === id)) ?? null;

export type Formulation<V extends VersionLike = VersionLike> = {
	unit: Unit;
	/** The first and the last tekstversie that carry this formulation of the lid. */
	since: Wording<V>;
	through: Wording<V>;
	/** How it differs from the formulation before it; `added` when the lid was new. */
	kind: 'first' | 'changed' | 'rewritten' | 'added';
	segments: Segment[];
};

export type LidHistory<V extends VersionLike = VersionLike> = {
	formulations: Formulation<V>[];
	/** The tekstversie in which the lid no longer occurs, if it went. */
	removedIn: Wording<V> | null;
};

const sameUnit = (a: Unit | null, b: Unit) => !!a && a.number === b.number && a.text === b.text;

/**
 * Every formulation of one lid, oldest first, followed back through renumbering. The
 * number is the lid's number in the latest tekstversie that has it.
 */
export function lidHistory<V extends VersionLike>(
	wordings: Wording<V>[],
	number: string
): LidHistory<V> | null {
	const unitsAt = (w: Wording<V>) => unitsOf(w.first.text, w.first.parts);
	let at = wordings.length - 1;
	let unit: Unit | undefined;
	for (; at >= 0; at--) {
		unit = unitsAt(wordings[at]).find((u) => u.number === number);
		if (unit) break;
	}
	if (!unit) return null;
	const removedIn = wordings[at + 1] ?? null;

	// Backwards: each step says how the lid in wording w came from wording w - 1.
	const back: Formulation<V>[] = [];
	let current: Formulation<V> = {
		unit,
		since: wordings[at],
		through: wordings[at],
		kind: 'first',
		segments: []
	};
	for (let w = at; w > 0; w--) {
		const row = wordings[w].rows?.find((r) => r.new && sameUnit(r.new, current.unit));
		if (!row || row.kind === 'added' || !row.old) {
			current.kind = 'added';
			break;
		}
		if (row.kind === 'same') {
			current.since = wordings[w - 1];
			current.unit = row.old;
			continue;
		}
		current.kind = row.kind === 'changed' ? 'changed' : 'rewritten';
		current.segments = row.segments;
		back.push(current);
		current = {
			unit: row.old,
			since: wordings[w - 1],
			through: wordings[w - 1],
			kind: 'first',
			segments: []
		};
	}
	back.push(current);
	return { formulations: back.reverse(), removedIn };
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
