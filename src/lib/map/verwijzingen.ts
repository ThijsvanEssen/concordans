// The verwijzingen in a note of the reader's own (B62): an article as lawyers cite it
// (`art. 6:162 lid 2 BW`, `artikel 8 Wiv 2017`), an ECLI, a Kamerstuk (`Kamerstukken II
// 2016/17, 34588, nr. 3`). Read from the text alone. Where the text says the address (an
// ECLI, a book of the BW, a Kamerstuk) it needs nothing more; another law's abbreviation is
// asked of /api/lookup once, when the note is kept, and the address kept with the bundel:
// a shared bundel asks nothing.
import { BW_BOOKS, bookNumber } from '$lib/text/bw';
import { padHref } from '$lib/bron/address';

export type Verwijzing = {
	/** As typed: `art. 6:162 lid 2 BW`. */
	tekst: string;
	/** Its key among the bundel's addresses: `artikel 6:162 lid 2 bw`. */
	sleutel: string;
	/** As the field names it under the note: `artikel 6:162 lid 2 BW`. */
	naam: string;
	/** Where it is in the text. */
	start: number;
	eind: number;
	/** Its address where the text says it; else it is asked (`vraag`). */
	pad: string | null;
	vraag?: { law: string; number: string; lid: string | null };
};

const ARTIKEL =
	/\b[Aa]rt(?:ikel|\.)\s+(\d+[a-z]?(?::\d+[a-z]*)?)(?:\s+lid\s+(\d+[a-z]?))?\s+([A-Z][A-Za-z]{0,9}(?:\s(?:19|20)\d{2})?)(?![\p{L}\d])/gu;
const ECLI = /\bECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]*[A-Z0-9]/g;
const KAMERSTUK =
	/\bKamerstukken\s+I{1,2}\s+\d{4}\/\d{2},\s+(\d{4,6}(?:-[A-Z0-9]+)*),\s+nr\.\s+(\d+|[A-Z]{1,3})\b/g;
/** Words that open a sentence after a number, never a law: `artikel 3 De wet …`. */
const GEEN_WET = new Set(
	'De Het Een En In Op Van Is Dat Die Er Om Bij Voor Met Uit Naar Zie Als Ook Of Maar Te Tot'.split(
		' '
	)
);

const lidAnker = (lid: string | null) => (lid ? `#lid-${lid}` : '');

function artikel(m: RegExpExecArray): Verwijzing | null {
	const [tekst, number, lid = null, wet] = m;
	if (GEEN_WET.has(wet)) return null;
	const plaats = `${number}${lid ? ` lid ${lid}` : ''}`;
	const book = wet === 'BW' && number.includes(':') ? number.split(':')[0].toLowerCase() : null;
	const bwb = book ? BW_BOOKS[book] : undefined;
	return {
		tekst,
		sleutel: `artikel ${plaats} ${wet.toLowerCase()}`,
		naam: `artikel ${plaats} ${wet}`,
		start: m.index,
		eind: m.index + tekst.length,
		pad: bwb ? padHref({ soort: 'artikel', wet: bwb, nummer: number }) + lidAnker(lid) : null,
		...(bwb ? {} : { vraag: { law: wet, number, lid } })
	};
}

const ecli = (m: RegExpExecArray): Verwijzing => ({
	tekst: m[0],
	sleutel: m[0],
	naam: m[0],
	start: m.index,
	eind: m.index + m[0].length,
	pad: padHref({ soort: 'uitspraak', ecli: m[0] })
});

const kamerstuk = (m: RegExpExecArray): Verwijzing => ({
	tekst: m[0],
	sleutel: `kamerstuk ${m[1]} ${m[2]}`,
	naam: `Kamerstukken ${m[1]}, nr. ${m[2]}`,
	start: m.index,
	eind: m.index + m[0].length,
	pad: padHref({ soort: 'kamerstuk', dossier: m[1], nummer: m[2] })
});

/** The verwijzingen in a text, in their order; none overlapping another. */
export function verwijzingenIn(text: string): Verwijzing[] {
	const found: Verwijzing[] = [
		...[...text.matchAll(ARTIKEL)].flatMap((m) => artikel(m) ?? []),
		...[...text.matchAll(ECLI)].map(ecli),
		...[...text.matchAll(KAMERSTUK)].map(kamerstuk)
	].sort((a, b) => a.start - b.start);
	const uit: Verwijzing[] = [];
	for (const v of found) if (!uit.length || v.start >= uit[uit.length - 1].eind) uit.push(v);
	return uit;
}

/** The address of a verwijzing: the text's own, else the one kept with the bundel. */
export const padVan = (v: Verwijzing, bekend?: Readonly<Record<string, string>> | null) =>
	v.pad ?? bekend?.[v.sleutel] ?? null;

/** How the field names what it recognized, each once: `artikel 6:162 BW, ECLI:…`. */
export function herkend(text: string): string[] {
	return [...new Set(verwijzingenIn(text).map((v) => v.naam))];
}

/**
 * The addresses of the verwijzingen in `text` the bundel does not know yet, asked of the
 * API (an article by its law's abbreviation); one it does not hold stays without.
 */
export async function zoekVerwijzingen(
	text: string,
	bekend: Readonly<Record<string, string>> = {}
): Promise<Record<string, string>> {
	const open = verwijzingenIn(text).filter((v) => v.vraag && !(v.sleutel in bekend));
	if (!open.length) return {};
	const { lookup } = await import('$lib/api/search');
	const uit: Record<string, string> = {};
	await Promise.all(
		open.map(async ({ sleutel, vraag }) => {
			try {
				const d = await lookup({ kind: 'article', law: vraag!.law, number: vraag!.number });
				const wet = String(d.props?.bwb_id ?? d.props?.celex ?? '');
				const nummer = String(d.props?.article_number ?? '');
				if (wet && nummer)
					uit[sleutel] =
						padHref({ soort: 'artikel', wet, nummer: bookNumber(wet, nummer) }) +
						lidAnker(vraag!.lid);
			} catch {
				// Not in the data, or no answer: the verwijzing stays text.
			}
		})
	);
	return uit;
}
