// The grammar of a place in a bron, as the API names it in ids and URL fragments: an
// overweging (`rov-5.7.1`), a part of an article (`lid-2-onder-a`, `onder-q_2`,
// `onder-_39-onder-a`, `lid-3-aanhef`, `tekst-6-onder-a`), a note (`fn-35-2`), an article
// in the whole law (`artikel-658`) and a division of it (`deel-hoofdstuk-3`).
import { paragraphCite } from './judgment-cite';

export type Anchor =
	| { kind: 'paragraph'; number: string }
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

const PREFIXED: { prefix: string; read: (rest: string) => Anchor }[] = [
	{ prefix: 'rov-', read: (number) => ({ kind: 'paragraph', number }) },
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
