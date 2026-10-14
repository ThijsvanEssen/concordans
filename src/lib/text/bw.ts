// The Burgerlijk Wetboek is one code in ten books, each an instrument of its own in the
// BWB. Lawyers cite an article with its book before the number: art. 6:162 BW, not
// "artikel 162 Burgerlijk Wetboek Boek 6".

/** The boeken of the Burgerlijk Wetboek and their BWB ids. */
export const BW_BOOKS: Record<string, string> = {
	'1': 'BWBR0002656',
	'2': 'BWBR0003045',
	'3': 'BWBR0005291',
	'4': 'BWBR0002761',
	'5': 'BWBR0005288',
	'6': 'BWBR0005289',
	'7': 'BWBR0005290',
	'7a': 'BWBR0006000',
	'8': 'BWBR0005034',
	'10': 'BWBR0030068'
};

const BOOK_OF: Record<string, string> = Object.fromEntries(
	Object.entries(BW_BOOKS).map(([book, id]) => [id, book.toUpperCase()])
);

/** The book of the Burgerlijk Wetboek a law is, by its BWB id: `6`, `7A`; null for another law. */
export const bwBookOf = (bwbId: string | null | undefined): string | null =>
	(bwbId && BOOK_OF[bwbId.toUpperCase()]) || null;

/** The code a book of the Burgerlijk Wetboek is cited by, `BW` (never `BW6`, `BW7A`); null
 *  for another law. */
export const bwCode = (bwbId: string | null | undefined): 'BW' | null =>
	bwBookOf(bwbId) ? 'BW' : null;

/**
 * The short name of a law: a book of the BW as lawyers write it, `Boek 7A BW` (never the
 * BWB's `BW7A`); another law by its abbreviation.
 */
export function lawShortName(
	bwbId: string | null | undefined,
	abbreviation: string | null | undefined
): string | null {
	const book = bwBookOf(bwbId);
	return book ? `Boek ${book} BW` : (abbreviation ?? null);
}

/** The number an article is cited by: `6:162` for article 162 of Boek 6, else as it is. */
export function bookNumber(bwbId: string | null | undefined, number: string): string;
export function bookNumber(
	bwbId: string | null | undefined,
	number: string | null | undefined
): string | null;
export function bookNumber(bwbId: string | null | undefined, number: string | null | undefined) {
	if (!number) return number ?? null;
	const book = bwbId ? BOOK_OF[bwbId.toUpperCase()] : undefined;
	return book && !number.includes(':') ? `${book}:${number}` : number;
}

/** The number the API gives an article: `162` for `6:162` in Boek 6, else as it is. */
export function apiNumber(bwbId: string, number: string): string {
	const book = BOOK_OF[bwbId.toUpperCase()];
	return book && number.toUpperCase().startsWith(`${book}:`)
		? number.slice(book.length + 1)
		: number;
}

/**
 * An article by its number, a BW one with its book: "Artikel 6:162". A number that is a
 * place ("bijlage 2 artikel 4") goes by the label of the API: "Artikel 4 van bijlage 2".
 */
export function articleName(
	bwbId: string | null | undefined,
	number: string | null | undefined,
	label?: string | null
): string | null {
	const n = number?.trim();
	if (n && !/\s/.test(n)) return `Artikel ${bookNumber(bwbId, n)}`;
	return label?.trim() || (n ? `Artikel ${n}` : null);
}

/** "Artikel 162 Burgerlijk Wetboek Boek 6" as lawyers write it: "Artikel 6:162 BW". */
export function withBook(name: string): string {
	return name.replace(
		/^Artikel (\S+) Burgerlijk Wetboek Boek (\d+a?)$/i,
		(_, number: string, book: string) =>
			`Artikel ${number.includes(':') ? number : `${book.toUpperCase()}:${number}`} BW`
	);
}

/**
 * An article by the abbreviation its law is cited by (API 0.73, `instrument_abbreviation`):
 * "Artikel 8 EVRM", "Artikel 3:4 Awb", "Artikel 6 AVG"; a BW article by its book
 * ("Artikel 6:162 BW", not "BW6"). Without one, the name the API gives.
 */
export function articleTitle(
	name: string,
	props: Record<string, unknown> | null | undefined
): string {
	const abbreviation = props?.instrument_abbreviation;
	const number = props?.article_number;
	if (
		typeof abbreviation === 'string' &&
		abbreviation.trim() &&
		!/^BW\d/i.test(abbreviation) &&
		typeof number === 'string' &&
		number.trim() &&
		!/\s/.test(number.trim())
	)
		return `Artikel ${number.trim()} ${abbreviation.trim()}`;
	return withBook(name);
}
