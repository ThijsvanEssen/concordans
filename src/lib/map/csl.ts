// A bundel as CSL-JSON, the reference format Zotero and Mendeley read. Concordans writes no
// style of its own: the types `legislation`, `legal_case` and `bill` let the Leidraad voor
// juridische auteurs (CSL) make the footnote.
import { MONTHS } from '$lib/text/datum';
import { parseNodeId } from '$lib/vocabulary';
import { anchorLabel } from '$lib/text/anchor';
import { isExternal, groepen, type MapItem, type SourceKind } from './map';

type DateParts = { 'date-parts': [number[]] };

type CslItem = {
	id: string;
	type: 'legislation' | 'legal_case' | 'bill' | 'webpage' | 'book' | 'article-journal' | 'document';
	title: string;
	URL?: string;
	accessed: DateParts;
	issued?: DateParts;
	authority?: string;
	number?: string;
	section?: string;
	note?: string;
};

/** The courts whose ECLI code names them; another court is left to the title. */
const AUTHORITY: Record<string, string> = {
	HR: 'Hoge Raad',
	PHR: 'Parket bij de Hoge Raad',
	RVS: 'Raad van State',
	CRVB: 'Centrale Raad van Beroep',
	CBB: 'College van Beroep voor het bedrijfsleven'
};

const EXTERNAL_TYPE: Record<SourceKind, CslItem['type']> = {
	book: 'book',
	journal: 'article-journal',
	annotation: 'document',
	webpage: 'webpage',
	other: 'document'
};

const parts = (iso: string): DateParts => ({
	'date-parts': [iso.split('-').map(Number)]
});

/** `ECLI:NL:HR:2019:2006` from the id of a judgment (`judgments/ecli_nl_hr_2019_2006`). */
const ecliOf = (id: string): string | null => {
	const m = /^judgments\/(ecli_[a-z]+_[a-z0-9]+_\d{4}_[\w.]+)$/i.exec(id);
	return m ? m[1].replaceAll('_', ':').toUpperCase() : null;
};

/** The day in a citation (`HR 20 december 2019, …`) as a date. */
const dayIn = (text: string): string | null => {
	const m = new RegExp(`(\\d{1,2}) (${MONTHS.join('|')}) (\\d{4})`).exec(text);
	if (!m) return null;
	return `${m[3]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

/** Where in the bron: `lid 2`, `r.o. 5.7.1`, the end of a citation after its comma. */
const PLACE = /,\s*((?:r\.o\.|onder|punt|alinea|§)\s.*)$/;

function cslItem(i: MapItem, n: number, address: string, consulted: string): CslItem {
	const collection = isExternal(i) ? null : parseNodeId(i.id)?.collection;
	const full = i.voluit || i.kort;
	const base = {
		id: `concordans-${n}`,
		title: full,
		...(address ? { URL: address } : {}),
		accessed: parts(consulted)
	};
	if (isExternal(i)) return { ...base, type: EXTERNAL_TYPE[i.kind ?? 'other'] };
	if (collection === 'judgments') {
		const ecli = ecliOf(i.id);
		const court = ecli ? AUTHORITY[ecli.split(':')[2]] : undefined;
		const day = dayIn(i.kort);
		const section = PLACE.exec(i.kort)?.[1];
		return {
			...base,
			type: 'legal_case',
			title: i.kort.replace(PLACE, ''),
			...(court ? { authority: court } : {}),
			...(ecli ? { number: ecli } : {}),
			...(day ? { issued: parts(day) } : {}),
			...(section ? { section } : {})
		};
	}
	if (collection === 'instruments' || collection === 'articles') {
		const section =
			PLACE.exec(i.kort)?.[1] ?? (i.at ? (anchorLabel(i.at, i.id) ?? undefined) : undefined);
		return {
			...base,
			type: 'legislation',
			...(i.versie ? { note: `tekst geldend op ${i.versie}` } : {}),
			...(section ? { section } : {})
		};
	}
	if (collection === 'documents' || collection === 'decisions' || collection === 'dossiers')
		return { ...base, type: 'bill' };
	return { ...base, type: 'webpage' };
}

/**
 * The bundel as CSL-JSON: one item per source, in the order the bundel shows them, each with
 * its address and the day it was consulted (`consulted`, a day).
 */
export function cslJson(
	items: readonly MapItem[],
	address: (i: MapItem) => string,
	order: 'groep' | 'eigen',
	consulted: string
): string {
	const ordered = order === 'eigen' ? items : groepen(items).flatMap((g) => g.items);
	return `${JSON.stringify(
		ordered.map((i, n) => cslItem(i, n + 1, address(i), consulted)),
		null,
		'\t'
	)}\n`;
}
