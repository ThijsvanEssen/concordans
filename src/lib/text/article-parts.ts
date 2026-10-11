// An article's aanhef, leden and onderdelen. API 0.5 delivers them as `parts`
// (`partsFromApi` nests them by id); before that they are read from the flat text,
// in which a lid is a line that starts with `1. ` and an onderdeel one that starts
// with `a. ` or `1°. `.
// TODO(backend B6): `parseArticleParts` goes when every article carries `parts`.

export type ArticlePartKind = 'aanhef' | 'lid' | 'onderdeel' | 'tekst';

export type ArticlePart = {
	/** Anchor: `aanhef`, `lid-2`, `lid-2-onder-a`, `onder-b`. Null for text no reference points at. */
	id: string | null;
	kind: ArticlePartKind;
	/** As the source prints it: `2`, `a`, `1°`. */
	number: string | null;
	/** The whole part, number and children included, as offsets into the article text. */
	start: number;
	end: number;
	/** The part's own text: after its number, up to its first child. */
	textStart: number;
	textEnd: number;
	children: ArticlePart[];
};

const LID = /^(\d+[a-z]?)\.\s+/;
const ONDERDEEL = /^(?:([a-z]{1,2})\.|(\d+)°\.?|(\d+)\.)\s+/;

type Line = { start: number; end: number; text: string };

function linesOf(text: string): Line[] {
	const lines: Line[] = [];
	let start = 0;
	for (const raw of text.split('\n')) {
		if (raw.trim()) lines.push({ start, end: start + raw.length, text: raw });
		start += raw.length + 1;
	}
	return lines;
}

/** `2` follows `1`, `2a` follows `2`: the next lid, not a numbered onderdeel. */
function isNextLid(number: string, previous: string | null): boolean {
	const n = parseInt(number, 10);
	if (previous === null) return n === 1;
	const p = parseInt(previous, 10);
	return n === p + 1 || (n === p && number !== previous);
}

const slug = (number: string) => number.replace('°', '').toLowerCase();

const leaf = (
	kind: ArticlePartKind,
	id: string | null,
	number: string | null,
	line: Line,
	prefix: number
): ArticlePart => ({
	id,
	kind,
	number,
	start: line.start,
	end: line.end,
	textStart: line.start + prefix,
	textEnd: line.end,
	children: []
});

/**
 * The aanhef, leden and onderdelen of an article, nested, with offsets into `text`
 * so that citation spans of the API still fit.
 */
export function parseArticleParts(text: string | null | undefined): ArticlePart[] {
	const parts: ArticlePart[] = [];
	if (!text) return parts;

	let lid: ArticlePart | null = null;
	let onderdeel: ArticlePart | null = null;
	let lastLid: string | null = null;
	/** Which of the onderdeel notations the current list uses; another one nests under it. */
	let listStyle = -1;

	const extend = (line: Line) => {
		if (lid) lid.end = line.end;
		if (onderdeel) onderdeel.end = line.end;
	};

	for (const line of linesOf(text)) {
		const lidMatch = LID.exec(line.text);
		if (lidMatch && isNextLid(lidMatch[1], lastLid)) {
			lastLid = lidMatch[1];
			lid = leaf('lid', `lid-${slug(lastLid)}`, lastLid, line, lidMatch[0].length);
			onderdeel = null;
			listStyle = -1;
			parts.push(lid);
			continue;
		}

		const m = ONDERDEEL.exec(line.text);
		if (m) {
			const style = m.slice(1).findIndex((g) => g !== undefined);
			const number = m[1] ?? (m[2] ? `${m[2]}°` : m[3]);
			const base = lid ? `${lid.id}-onder` : 'onder';
			const nested = onderdeel !== null && listStyle !== -1 && style !== listStyle;
			if (nested && onderdeel) {
				const child = leaf(
					'onderdeel',
					`${onderdeel.id}-${slug(number)}`,
					number,
					line,
					m[0].length
				);
				if (onderdeel.children.length === 0) onderdeel.textEnd = line.start;
				onderdeel.children.push(child);
				onderdeel.end = line.end;
				if (lid) lid.end = line.end;
				continue;
			}
			listStyle = style;
			onderdeel = leaf('onderdeel', `${base}-${slug(number)}`, number, line, m[0].length);
			const siblings = lid ? lid.children : parts;
			// What precedes the first onderdeel of an article without leden is its aanhef.
			if (!lid && parts.length === 1 && parts[0].kind === 'tekst') {
				parts[0].kind = 'aanhef';
				parts[0].id = 'aanhef';
			}
			if (lid && lid.children.length === 0) lid.textEnd = line.start;
			siblings.push(onderdeel);
			extend(line);
			continue;
		}

		// A line without a number: more text of the lid, or of the article.
		const plain = leaf('tekst', null, null, line, 0);
		if (lid) {
			if (lid.children.length === 0) lid.textEnd = line.end;
			else lid.children.push(plain);
			lid.end = line.end;
			onderdeel = null;
		} else {
			parts.push(plain);
			onderdeel = null;
		}
	}
	return parts;
}

type ApiPart = {
	id: string;
	kind: string;
	number?: string | null;
	text?: string | null;
	start: number;
	end: number;
};

const KINDS: ReadonlySet<string> = new Set(['aanhef', 'lid', 'onderdeel', 'tekst']);

/** The parts the API delivers, nested: `lid-2-onder-a` is a child of `lid-2`. */
export function partsFromApi(parts: ApiPart[]): ArticlePart[] {
	const roots: ArticlePart[] = [];
	const byId = new Map<string, ArticlePart>();
	for (const p of [...parts].sort((a, b) => a.start - b.start)) {
		const part: ArticlePart = {
			id: p.id,
			kind: KINDS.has(p.kind) ? (p.kind as ArticlePartKind) : 'tekst',
			number: p.number ?? null,
			start: p.start,
			end: p.end,
			textStart: p.start,
			textEnd: p.end,
			children: []
		};
		byId.set(p.id, part);
		// `lid-3-onder-a` and `lid-3-aanhef` belong to `lid-3`.
		const parentId = p.id.replace(/-(?:onder-[^-]+|aanhef)$/, '');
		const parent = parentId !== p.id ? byId.get(parentId) : undefined;
		if (parent) {
			if (parent.children.length === 0) parent.textEnd = p.start;
			parent.children.push(part);
		} else roots.push(part);
	}
	// Where the part's text still starts with its number ("2. "), the reader prints
	// the number once; API 0.5 starts the text after it.
	for (const p of parts) {
		const part = byId.get(p.id);
		if (!part?.number || !p.text?.startsWith(`${part.number}.`)) continue;
		part.textStart += part.number.length + 2;
	}
	return roots;
}

/** Every part, depth first. */
export function* walkParts(parts: ArticlePart[]): Generator<ArticlePart> {
	for (const part of parts) {
		yield part;
		yield* walkParts(part.children);
	}
}

/** The text a reference to `id` points at, children included; null when the article has no such part. */
export function partText(text: string, parts: ArticlePart[], id: string): string | null {
	for (const part of walkParts(parts)) if (part.id === id) return text.slice(part.start, part.end);
	return null;
}

/**
 * The place a part is cited as: itself when it has an anchor, else the nearest part around
 * it that has one (the closing words of a lid are the lid), else null: the article itself,
 * as with an article without leden.
 */
export function placeOf(parts: ArticlePart[], part: ArticlePart): ArticlePart | null {
	if (part.id) return part;
	const path = (within: ArticlePart[]): ArticlePart[] | null => {
		for (const p of within) {
			if (p === part) return [p];
			const below = path(p.children);
			if (below) return [p, ...below];
		}
		return null;
	};
	const around = (path(parts) ?? []).filter((p) => p.id !== null);
	return around.at(-1) ?? null;
}

/** How an onderdeel is numbered in print: `a.` in Dutch law (a BWB id), `a)` in EU law. */
export const onderdeelMark = (lawId: string | null | undefined): '.' | ')' =>
	lawId && !/^BWB/i.test(lawId) ? ')' : '.';
