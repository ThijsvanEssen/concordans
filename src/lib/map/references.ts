// The verwijzingen in a note of the reader's own (B62): an article as lawyers cite it
// (`art. 6:162 lid 2 BW`, `artikel 8 Wiv 2017`), an ECLI, a Kamerstuk (`Kamerstukken II
// 2016/17, 34588, nr. 3`). Read from the text alone. Where the text says the address (an
// ECLI, a book of the BW, a Kamerstuk) it needs nothing more; another law's abbreviation is
// asked of /api/lookup once, when the note is kept, and the address kept with the bundel:
// a shared bundel asks nothing.
import { BW_BOOKS, bookNumber } from '$lib/text/bw';
import { padHref } from '$lib/bron/address';
import { citationRecord } from '$lib/text/citation-record';
import type { References } from './map';

export type NoteReference = {
	/** As typed: `art. 6:162 lid 2 BW`. */
	text: string;
	/** Its key among the bundel's addresses: `artikel 6:162 lid 2 bw`. */
	key: string;
	/** As the field names it under the note: `artikel 6:162 lid 2 BW`. */
	name: string;
	/** Where it is in the text. */
	start: number;
	end: number;
	/** Its address where the text says it; else it is asked (`query`). */
	path: string | null;
	query?: { law: string; number: string; lid: string | null };
};

const ARTICLE_REF =
	/\b[Aa]rt(?:ikel|\.)\s+(\d+[a-z]?(?::\d+[a-z]*)?)(?:\s+lid\s+(\d+[a-z]?))?\s+([A-Z][A-Za-z]{0,9}(?:\s(?:19|20)\d{2})?)(?![\p{L}\d])/gu;
const ECLI_REF = /\bECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]*[A-Z0-9]/g;
const KAMERSTUK_REF =
	/\bKamerstukken\s+(I{1,2})\s+\d{4}\/\d{2},\s+(\d{4,6}(?:-[A-Z0-9]+)*),\s+nr\.\s+(\d+|[A-Z]{1,3})\b/g;
/** Words that open a sentence after a number, never a law: `artikel 3 De wet …`. */
const NOT_A_LAW = new Set(
	'De Het Een En In Op Van Is Dat Die Er Om Bij Voor Met Uit Naar Zie Als Ook Of Maar Te Tot'.split(
		' '
	)
);

const lidAnchor = (lid: string | null) => (lid ? `#lid-${lid}` : '');

function ofArticle(m: RegExpExecArray): NoteReference | null {
	const [text, number, lid = null, law] = m;
	if (NOT_A_LAW.has(law)) return null;
	const place = `${number}${lid ? ` lid ${lid}` : ''}`;
	const book = law === 'BW' && number.includes(':') ? number.split(':')[0].toLowerCase() : null;
	const bwb = book ? BW_BOOKS[book] : undefined;
	return {
		text,
		key: `artikel ${place} ${law.toLowerCase()}`,
		name: `artikel ${place} ${law}`,
		start: m.index,
		end: m.index + text.length,
		path: bwb ? padHref({ soort: 'artikel', wet: bwb, nummer: number }) + lidAnchor(lid) : null,
		...(bwb ? {} : { query: { law, number, lid } })
	};
}

const ofEcli = (m: RegExpExecArray): NoteReference => ({
	text: m[0],
	key: m[0],
	name: m[0],
	start: m.index,
	end: m.index + m[0].length,
	path: padHref({ soort: 'uitspraak', ecli: m[0] })
});

function ofKamerstuk(m: RegExpExecArray): NoteReference {
	const [text, chamber, dossier, number] = m;
	const cited = citationRecord({
		kind: 'kamerstuk',
		chamber: chamber === 'I' ? 'EK' : 'TK',
		dossier_number: dossier,
		number
	});
	return {
		text,
		key: `kamerstuk ${dossier} ${number}`,
		name: cited?.short ?? text,
		start: m.index,
		end: m.index + text.length,
		path: padHref({ soort: 'kamerstuk', dossier, nummer: number })
	};
}

/** The verwijzingen in a text, in their order; none overlapping another. */
export function referencesIn(text: string): NoteReference[] {
	const found: NoteReference[] = [
		...[...text.matchAll(ARTICLE_REF)].flatMap((m) => ofArticle(m) ?? []),
		...[...text.matchAll(ECLI_REF)].map(ofEcli),
		...[...text.matchAll(KAMERSTUK_REF)].map(ofKamerstuk)
	].sort((a, b) => a.start - b.start);
	const out: NoteReference[] = [];
	for (const r of found) if (!out.length || r.start >= out[out.length - 1].end) out.push(r);
	return out;
}

/** The address of a verwijzing: the text's own, else the one kept with the bundel. */
export const referencePath = (r: NoteReference, known?: Readonly<References> | null) =>
	r.path ?? known?.[r.key] ?? null;

/** How the field names what it recognized, each once: `artikel 6:162 BW, ECLI:…`. */
export const recognizedIn = (text: string): string[] => [
	...new Set(referencesIn(text).map((r) => r.name))
];

/**
 * The addresses of the verwijzingen in `text` the bundel does not know yet, asked of the
 * API (an article by its law's abbreviation); one it does not hold stays without.
 */
export async function lookUpReferences(
	text: string,
	known: Readonly<References> = {}
): Promise<References> {
	const open = referencesIn(text).filter((r) => r.query && !(r.key in known));
	if (!open.length) return {};
	const [{ lookup }, { ifExists, ignore }] = await Promise.all([
		import('$lib/api/search'),
		import('$lib/api/errors')
	]);
	const out: References = {};
	await Promise.all(
		open.map(async ({ key, query }) => {
			const q = query!;
			const d = await ifExists(lookup({ kind: 'article', law: q.law, number: q.number })).catch(
				ignore('references')
			);
			const law = String(d?.props?.bwb_id ?? d?.props?.celex ?? '');
			const number = String(d?.props?.article_number ?? '');
			if (law && number)
				out[key] =
					padHref({ soort: 'artikel', wet: law, nummer: bookNumber(law, number) }) +
					lidAnchor(q.lid);
		})
	);
	return out;
}
