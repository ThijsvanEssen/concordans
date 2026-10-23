// An article of a law as the whole-law reader lists it (law-list) and which of its texts it
// shows (WholeLawReaderArticle): without the client, so the first paint of a law reads it too.
import type { Schema } from '$lib/api/types';
import type { FootnoteMark } from '$lib/text/voetnoten';

// The overview lists every article of the law with a preview only: at full text and parts
// per article, 810 articles would balloon the payload. The full text of an article of today
// comes with its page (the list of the day); one the page lacks is asked for alone.
export const PREVIEW_CHARS = 600;

type Part = Schema<'ArticlePartSpanDTO'>;
type Table = Schema<'ArticleTableDTO'>;
type Heading = Schema<'ArticleHeadingDTO'>;
type Footnote = Schema<'FootnoteDTO'>;
/** An article as the list shows it, of today or of the peildatum. */
export type Row = {
	id: string;
	/** The article to link to; null for one that is no longer in the law. */
	key: string | null;
	article_number: string | null;
	label: string | null;
	/** Its opschrift: `Uitbreiding en beperking partnerregeling`. */
	heading: string | null;
	address: string | null;
	breadcrumb: Schema<'InstrumentArticleNodeDTO'>['breadcrumb'];
	/** The whole text of an old version, which comes with the list. */
	text: string | null;
	/** Its aanhef, leden and onderdelen; null from an API without them (read from the text). */
	parts: Part[] | null;
	/** The tables in that text, and its headings. */
	tables: Table[];
	headings?: Heading[];
	/** Where the markers of its footnotes stood in that text. */
	footnoteMarks: FootnoteMark[];
	/** Its footnotes not in that text. */
	footnotes?: Footnote[];
	/** The whole text of today, from the list of the day (`include_text`), per page. */
	textToday?: string | null;
	partsToday?: Part[] | null;
	tablesToday?: Table[];
	headingsToday?: Heading[];
	footnoteMarksToday?: FootnoteMark[];
	footnotesToday?: Footnote[];
	text_preview: string | null;
};

/** The whole text an article shows, and whether Citeer names its places (not on a peildatum). */
export type ArticleText = {
	text: string;
	parts: Part[] | null;
	tables: Table[];
	headings: Heading[];
	footnoteMarks: FootnoteMark[];
	footnotes: Footnote[];
	cited: boolean;
};

/**
 * The one text of a row: of the peildatum, else of today from its page, else of the article
 * asked alone (`detail`, of today only). Null while none came: the preview stands.
 */
export function articleText(
	row: Row,
	detail:
		| {
				text: string | null;
				parts?: Part[] | null;
				tables?: Table[];
				headings?: Heading[];
				footnote_marks?: FootnoteMark[] | null;
				footnotes?: Footnote[] | null;
		  }
		| undefined
): ArticleText | null {
	if (row.text)
		return {
			text: row.text,
			parts: row.parts,
			tables: row.tables,
			headings: row.headings ?? [],
			footnoteMarks: row.footnoteMarks,
			footnotes: row.footnotes ?? [],
			cited: false
		};
	if (row.textToday)
		return {
			text: row.textToday,
			parts: row.partsToday ?? null,
			tables: row.tablesToday ?? [],
			headings: row.headingsToday ?? [],
			footnoteMarks: row.footnoteMarksToday ?? [],
			footnotes: row.footnotesToday ?? [],
			cited: true
		};
	if (detail?.text)
		return {
			text: detail.text,
			parts: detail.parts ?? null,
			tables: detail.tables ?? [],
			headings: detail.headings ?? [],
			footnoteMarks: detail.footnote_marks ?? [],
			footnotes: detail.footnotes ?? [],
			cited: true
		};
	return null;
}
