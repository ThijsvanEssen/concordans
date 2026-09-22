// TODO(backend B6, B7): a reference carries no lid or onderdeel. The qualifier the
// source writes ("tweede lid", "lid 2 onder a") is read from the text of the span and
// from what follows it. When the API delivers `lid` and `onderdeel`, this is a lookup.

export type Qualifier = { lid?: string; onderdeel?: string; aanhef?: boolean };

const ORDINALS = [
	'eerste',
	'tweede',
	'derde',
	'vierde',
	'vijfde',
	'zesde',
	'zevende',
	'achtste',
	'negende',
	'tiende',
	'elfde',
	'twaalfde',
	'dertiende',
	'veertiende',
	'vijftiende',
	'zestiende',
	'zeventiende',
	'achttiende',
	'negentiende',
	'twintigste'
];
const ORDINAL = `(${ORDINALS.join('|')})`;

// "tweede lid", "eerste en tweede lid" (the first counts), "lid 2", "leden 1 en 2".
const LID_ORDINAL = new RegExp(
	`\\b${ORDINAL}(?:(?:,| en| of| tot en met)\\s+${ORDINAL})*\\s+lid\\b`,
	'i'
);
const LID_NUMBER = /\b(?:lid|leden)\s+(\d+[a-z]?)\b/i;
const ONDERDEEL =
	/\b(?:onder(?:de(?:el|len))?|sub)\s+(?:(\d+)\s*°|(\d+)(?![\d.:])|([a-z]{1,2})(?![a-z]))/i;
const AANHEF = /\baanhef\b/i;

/** Only what directly continues the reference: up to the end of the clause. */
const TAIL = /^(?:\s*,)?\s*(?:[^.;()]{0,60})/;

function read(text: string): Qualifier {
	const q: Qualifier = {};
	const ordinal = LID_ORDINAL.exec(text);
	const numbered = LID_NUMBER.exec(text);
	if (ordinal) q.lid = String(ORDINALS.indexOf(ordinal[1].toLowerCase()) + 1);
	else if (numbered) q.lid = numbered[1].toLowerCase();
	const onderdeel = ONDERDEEL.exec(text);
	if (onderdeel) q.onderdeel = (onderdeel[1] ?? onderdeel[2] ?? onderdeel[3]).toLowerCase();
	if (AANHEF.test(text)) q.aanhef = true;
	return q;
}

/**
 * The lid, onderdeel or aanhef a reference names. `following` is the text right after
 * the span: the source often writes "artikel 139d, eerste en tweede lid," with the
 * qualifier outside it. It is read only where it starts with the qualifier.
 */
export function parseQualifier(spanText: string, following = ''): Qualifier | null {
	let q = read(spanText);
	if (!q.lid && !q.onderdeel && !q.aanhef) {
		const tail = TAIL.exec(following)?.[0] ?? '';
		const starts = new RegExp(
			`^\\s*,?\\s*(?:${ORDINAL}\\b|lid\\b|leden\\b|onder\\b|onderde|sub\\b|aanhef\\b)`,
			'i'
		);
		if (starts.test(tail)) q = read(tail.split(/,\s*(?=\d)/)[0]);
	}
	return q.lid || q.onderdeel || q.aanhef ? q : null;
}

/** The fragment of the part a qualifier names: `lid-2`, `lid-2-onder-a`, `onder-a`, `aanhef`. */
export function anchorOf(q: Qualifier | null): string | null {
	if (!q) return null;
	const onder = q.onderdeel ? `onder-${q.onderdeel}` : null;
	if (q.lid) return onder ? `lid-${q.lid}-${onder}` : `lid-${q.lid}`;
	return onder ?? (q.aanhef ? 'aanhef' : null);
}

/** A fragment as the reader prints it: `lid-2-onder-a` is "lid 2, onder a". */
export const anchorLabel = (anchor: string): string =>
	anchor
		.replace(/^rov-/, 'r.o. ')
		.replace(/^lid-(\w+)/, 'lid $1')
		.replace(/-?onder-(\w+)/, (_, o, i) => `${i > 0 ? ', ' : ''}onder ${o}`)
		.replace(/-(\w+)$/, ' $1');
