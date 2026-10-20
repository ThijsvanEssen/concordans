// The grammar of a place in a bron, as the API names it in ids and URL fragments: an
// overweging (`rov-5.7.1`), a line of a Kamerstuk or an unnumbered paragraph of a judgment
// (`p-360a090c`, `_2` for a repeat: from its text, it stays when a line before it comes or goes), a
// section of it (`s-300`, a passage of a memorie), a part of an article (`lid-2-onder-a`, `onder-q_2`,
// `onder-_39-onder-a`, `lid-3-aanhef`, `tekst-6-onder-a`), a note (`fn-35-2`), an article
// in the whole law (`artikel-658`) and a division of it (`deel-hoofdstuk-3`).
import { paragraphCite } from './ecli';
import { tablesWithin, type Table } from './tables';

type Anchor =
	| { kind: 'paragraph'; number: string }
	/** A line of a Kamerstuk (an alinea by its first line) or an unnumbered paragraph of a
	 *  judgment, by the id the API gives it. */
	| { kind: 'line'; id: string }
	/** A section of a paper as the API names it (`s-300`): a passage of a memorie. */
	| { kind: 'section'; id: string }
	| {
			kind: 'part';
			lid: string | null;
			/** A paragraph outside the leden: `tekst-6`. */
			text: string | null;
			/** The onderdelen from the outside in, as the API names them: `q_2`, `_39`. */
			onderdelen: string[];
			aanhef: boolean;
	  }
	| { kind: 'note'; label: string }
	| { kind: 'article'; number: string }
	| { kind: 'division'; path: string };

const PREFIXED: { prefix: string; read: (rest: string) => Anchor | null }[] = [
	{ prefix: 'rov-', read: (number) => ({ kind: 'paragraph', number }) },
	{
		prefix: 'p-',
		read: (h) => (/^[0-9a-f]{8}(?:_\d+)?$/.test(h) ? { kind: 'line', id: `p-${h}` } : null)
	},
	{ prefix: 's-', read: (n) => (/^\d+$/.test(n) ? { kind: 'section', id: `s-${n}` } : null) },
	{ prefix: 'fn-', read: (label) => ({ kind: 'note', label }) },
	{ prefix: 'artikel-', read: (number) => ({ kind: 'article', number }) },
	{ prefix: 'deel-', read: (path) => ({ kind: 'division', path }) }
];

/** A part: `lid-2`, then each `onder-x`, then `aanhef`, each part of it once in that order. */
function parsePart(id: string): Anchor | null {
	const words = id.split('-');
	const part = {
		lid: null as string | null,
		text: null as string | null,
		onderdelen: [] as string[]
	};
	let aanhef = false;
	let i = 0;
	if ((words[0] === 'lid' || words[0] === 'tekst') && words.length > 1) {
		part[words[0] === 'lid' ? 'lid' : 'text'] = words[1];
		i = 2;
	}
	for (; i < words.length; i += 2) {
		if (words[i] === 'onder' && i + 1 < words.length) part.onderdelen.push(words[i + 1]);
		else if (words[i] === 'aanhef' && i === words.length - 1) {
			aanhef = true;
			i -= 1;
		} else return null;
	}
	if (!part.lid && !part.text && !part.onderdelen.length && !aanhef) return null;
	return { kind: 'part', ...part, aanhef };
}

/** What an anchor names; null for an id that is none of the anchors the API gives. */
export function parseAnchor(id: string): Anchor | null {
	for (const { prefix, read } of PREFIXED)
		if (id.startsWith(prefix) && id.length > prefix.length) return read(id.slice(prefix.length));
	return parsePart(id);
}

/** The id of an anchor, as the API gives it: the inverse of `parseAnchor`. */
export function formatAnchor(a: Anchor): string {
	switch (a.kind) {
		case 'paragraph':
			return `rov-${a.number}`;
		case 'line':
			return a.id;
		case 'section':
			return a.id;
		case 'note':
			return `fn-${a.label}`;
		case 'article':
			return `artikel-${a.number}`;
		case 'division':
			return `deel-${a.path}`;
		case 'part':
			return [
				a.lid !== null ? `lid-${a.lid}` : a.text !== null ? `tekst-${a.text}` : null,
				...a.onderdelen.map((o) => `onder-${o}`),
				a.aanhef ? 'aanhef' : null
			]
				.filter(Boolean)
				.join('-');
	}
}

/**
 * A printed place (`anchorLabel`) as a sentence names it: `in r.o. 5.1`, `in § 5`; `onder 3`
 * (a point of a conclusion, an onderdeel) is its own preposition and takes no `in`.
 */
export const atPlace = (label: string): string => (/^onder /.test(label) ? label : `in ${label}`);

/** The anchor of an overweging by its number: `rov-5.7.1`. */
export const paragraphAnchor = (number: string): string =>
	formatAnchor({ kind: 'paragraph', number });

/** The number of the overweging an anchor names: `5.7.1` for `rov-5.7.1`; else null. */
export function paragraphNumber(id: string | null | undefined): string | null {
	const a = id ? parseAnchor(id) : null;
	return a?.kind === 'paragraph' ? a.number : null;
}

/** Whether an anchor names an overweging: `rov-5.1`. */
export const isOverwegingAnker = (at: string | null | undefined): at is string =>
	paragraphNumber(at) !== null;

/** Whether a reference is to a judgment at an overweging: its card is the overweging. */
export const isOverwegingRef = (ref: string | null, at: string | null | undefined) =>
	!!ref && ref.startsWith('judgments/') && isOverwegingAnker(at);

/** What a Kamerstuk gives to read its alineas: its text, its lines as the API numbers them
 *  (`paragraphs`, API 0.79.66) and its sections. */
export type PaperSource = {
	text?: string | null;
	/** Each line of the text (`text[char_start:char_end]`) with its lasting id and its alinea
	 *  (`number`: of its text and of a table, null for its head, a heading or a formula). */
	paragraphs?:
		| readonly { id: string; number?: number | null; char_start: number; char_end: number }[]
		| null;
	/** Its sections: a passage is the text from its heading to `char_end`. */
	sections?:
		| readonly { id?: string; char_start: number; char_end?: number; heading: string }[]
		| null; /** The tables in its text (`tables`): a row a line, its cells separated by a tab. */
	tables?: readonly Table[] | null;
};

/**
 * A line of a Kamerstuk: `i` its place among the lines, `id` its own lasting id (the API's),
 * `n` its alinea's number and `at` its
 * alinea's anchor (the id of its first line, so a table is one), `first` whether it is that
 * line; `n` and `at` null for a line that is no alinea, and for every line of a paper the API
 * has not numbered.
 */
export type PaperParagraph = {
	start: number;
	text: string;
	i: number;
	id: string | null;
	n: number | null;
	at: string | null;
	first: boolean;
};

/**
 * The lines of a Kamerstuk with its alineas as the API numbers them (`paragraphs`): each line
 * with its words without the space around them and where they start in the text (so an
 * offset of the API, a passage or a note's marker, falls in them). The site counts nothing:
 * a paper without `paragraphs` has its lines and no alinea. The one place a Kamerstuk's text
 * is cut: its reader and a bundel read it alike.
 */
export function paperParagraphs(doc: PaperSource): PaperParagraph[] {
	const text = doc.text ?? '';
	const numbered = (doc.paragraphs ?? []).filter((p) => p.char_end <= text.length);
	const ranges = numbered.length
		? numbered
		: [...text.matchAll(/[^\n]+/g)].map((m) => ({
				id: null,
				number: null,
				char_start: m.index,
				char_end: m.index + m[0].length
			}));
	const firstOf = new Map<number, string>();
	const lines: PaperParagraph[] = [];
	for (const r of ranges) {
		const raw = text.slice(r.char_start, r.char_end);
		const t = raw.trim();
		if (!t) continue;
		const n = r.number ?? null;
		const first = n !== null && r.id !== null && !firstOf.has(n);
		if (first) firstOf.set(n, r.id!);
		lines.push({
			start: r.char_start + raw.indexOf(t),
			text: t,
			i: lines.length,
			id: r.id,
			n,
			at: n !== null ? (firstOf.get(n) ?? null) : null,
			first
		});
	}
	return lines;
}

/**
 * The lines of a Kamerstuk as the reader sets them: a line a block, an alinea with a table
 * (its title and its rows, kind `table`) one block, its `text` the words from its first line to
 * its last and its `tables` in them. The lines of a table no alinea holds are one block too.
 */
export type PaperBlock = {
	/** Its first line: its alinea, its anchor and its marker. */
	line: PaperParagraph;
	lines: PaperParagraph[];
	start: number;
	text: string;
	tables: Table[];
};

export function paperBlocks(
	lines: readonly PaperParagraph[],
	doc: Pick<PaperSource, 'text' | 'tables'>
): PaperBlock[] {
	const text = doc.text ?? '';
	const tables = doc.tables ?? [];
	// The table a line is a row of, and the table of each alinea that holds one.
	const rowOf = new Map<PaperParagraph, Table>();
	const ofParagraph = new Map<string, Table>();
	for (const q of lines) {
		const t = tables.find((t) => q.start + q.text.length > t.start && q.start < t.end);
		if (!t) continue;
		rowOf.set(q, t);
		if (q.at) ofParagraph.set(q.at, t);
	}
	const blocks: PaperBlock[] = [];
	for (let k = 0; k < lines.length; ) {
		const p = lines[k];
		const table = rowOf.get(p) ?? (p.at ? ofParagraph.get(p.at) : undefined);
		let last = k;
		while (
			table &&
			last + 1 < lines.length &&
			((!!p.at && lines[last + 1].at === p.at) || rowOf.get(lines[last + 1]) === table)
		)
			last++;
		const own = lines.slice(k, last + 1);
		const tail = own[own.length - 1];
		// A row keeps its empty cells at either end, which its line is trimmed of.
		const start = table ? Math.min(p.start, table.start) : p.start;
		const end = Math.max(tail.start + tail.text.length, table?.end ?? 0);
		blocks.push({
			line: p,
			lines: own,
			start,
			text: text.slice(start, end),
			tables: table ? tablesWithin([table], start, end - start) : []
		});
		k = last + 1;
	}
	return blocks;
}

/** The anchor of a lid by its number: `lid-2`. */
export const lidAnchor = (lid: string): string =>
	formatAnchor({ kind: 'part', lid, text: null, onderdelen: [], aanhef: false });

/** The lid a lid anchor names: `2` for `lid-2`; null for any other anchor. */
export function lidNumber(id: string | null | undefined): string | null {
	const a = id ? parseAnchor(id) : null;
	return a?.kind === 'part' && !a.onderdelen.length && !a.aanhef ? a.lid : null;
}

/** The anchor of an onderdeel in the part it stands in, or in the article: `lid-2-onder-a`. */
export function onderdeelAnchor(within: string | null, onderdeel: string): string {
	const a = within ? parseAnchor(within) : null;
	const part = a?.kind === 'part' ? a : { lid: null, text: null, onderdelen: [] };
	return formatAnchor({
		kind: 'part',
		lid: part.lid,
		text: part.text,
		onderdelen: [...part.onderdelen, onderdeel],
		aanhef: false
	});
}

/** The part a part stands in: `lid-3` for `lid-3-onder-a` and `lid-3-aanhef`; else null. */
export function parentAnchor(id: string): string | null {
	const a = parseAnchor(id);
	if (a?.kind !== 'part') return null;
	if (a.aanhef) return formatAnchor({ ...a, aanhef: false }) || null;
	if (!a.onderdelen.length) return null;
	return formatAnchor({ ...a, onderdelen: a.onderdelen.slice(0, -1) }) || null;
}

/**
 * An onderdeel as the law prints it: the anchor tells two of the same number apart
 * (`q_2`, the second onderdeel q of Wft 1:1); a dash (`_39`) has no number and prints empty.
 */
export const printedOnderdeel = (o: string): string => o.replace(/_\d+$/, '');

/**
 * A place as the reader prints it: `lid 2, onder a`; an overweging as its judgment cites
 * it, by its ECLI or key (`r.o. 5.1`, `onder 5` in a conclusion, `§ 5` in Strasbourg or
 * Luxembourg). Null for a place it cannot print.
 */
export function anchorLabel(id: string, judgment?: string | null): string | null {
	const a = parseAnchor(id);
	if (a?.kind === 'paragraph') return paragraphCite(judgment, a.number);
	if (a?.kind !== 'part') return null;
	const onderdelen = a.onderdelen.map(printedOnderdeel).filter(Boolean);
	const onder = onderdelen.map((o, i) => (i === 0 ? `onder ${o}` : `sub ${o}`)).join(' ');
	const label = [
		[a.lid !== null ? `lid ${a.lid}` : null, a.aanhef ? 'aanhef' : null].filter(Boolean).join(' '),
		onder
	]
		.filter(Boolean)
		.join(', ');
	return label || null;
}
