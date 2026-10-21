// The list of a law's articles in the whole-law reader: opened from its start or at a
// division, paged on both ways, and loaded up to a place. One list is open at a time; what
// arrives for a list no longer open changes nothing.
import { tick } from 'svelte';
import { ApiError } from '$lib/api/client';
import { getInstrumentArticles, getInstrumentArticlesAt } from '$lib/api/instruments';
import { report } from '$lib/api/errors';
import { lawArticleList } from '$lib/api/law-articles';
import type { Schema } from '$lib/api/types';
import { parseAnchor } from '$lib/text/anchor';
import { plekVan } from '$lib/text/division';
import { uniqueBy } from '$lib/util/unique';
import { volgendeBladzijden, vorigeBladzijde, type Richting } from './law-paging';
import { atArticles } from './peildatum';
import type { FootnoteMark } from '$lib/text/voetnoten';

// The overview lists every article of the law with a preview only: at full text and parts
// per article, 810 articles would balloon the payload. The full text of an article of today
// comes with its page (the list of the day); one the page lacks is asked for alone.
export const PREVIEW_CHARS = 600;
export const PAGE_SIZE = 100;
/** Pages asked at the same time when paging on to a place further in the law. */
const PAGES_AT_ONCE = 2;

type Part = Schema<'ArticlePartSpanDTO'>;
type Table = Schema<'ArticleTableDTO'>;
type Heading = Schema<'ArticleHeadingDTO'>;
type Footnote = Schema<'FootnoteDTO'>;
type Division = Schema<'InstrumentDivisionDTO'>;

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

/**
 * The address an article of the whole law is asked alone by (for today's references, and its
 * text where its page lacked it), or null where that would bring nothing: on a peildatum, for
 * a text of an old version, or for an article no longer in the law.
 */
export const asksAlone = (row: Row, peildatum: string | null): string | null =>
	peildatum || row.text || !row.key ? null : row.address;

type ListStatus = 'loading' | 'loading-more' | 'loading-before' | 'ready' | 'error';

export type LawList = {
	articles: Row[];
	/** The place in the whole list of the first article shown: a division opens there. */
	start: number;
	/** Every article of the law (of the peildatum), wherever the list starts. */
	total: number;
	/** Where the BWB text of the law begins; before it there is no text of the day. */
	firstVersionFrom: string | null;
	status: ListStatus;
	/** Why the list failed to open, for LoadState: slow or broken. */
	failure: unknown;
	/** A page that failed, on the side it was asked: the articles shown stay. */
	pageFailure: { richting: Richting; error: unknown } | null;
};

export const EMPTY_LIST: LawList = {
	articles: [],
	start: 0,
	total: 0,
	firstVersionFrom: null,
	status: 'loading',
	failure: null,
	pageFailure: null
};

/** Whether an anchor names a division of the law: `deel-hoofdstuk-3`. */
export const isDivisionAnchor = (anchor: string) => parseAnchor(anchor)?.kind === 'division';

const divisionKey = (bwb: string, day: string | null, division: string) =>
	`${bwb}/${day}/${division}`;

type Page = {
	items: Row[];
	total: number;
	firstVersionFrom?: string | null;
	division?: Division | null;
};

/**
 * A page of the list from `offset`; with `division` the articles of that division alone
 * (`deel-hoofdstuk-10-titel-10.2-afdeling-10.2.2`), its place in the whole list in `division`.
 * A page before a division is shorter (`limit`): it ends where the list shown begins.
 */
async function loadPage(
	bwb: string,
	day: string | null,
	today: string,
	offset: number,
	signal?: AbortSignal,
	division?: string,
	limit = PAGE_SIZE
): Promise<Page> {
	if (day) {
		// The whole text of each old version comes with the list (include_text): there is no
		// call per article for a version. Today's list, the one of the table of contents, says
		// which article to link to.
		const [at, now] = await Promise.all([
			getInstrumentArticlesAt(
				bwb,
				day,
				{ text_preview_chars: PREVIEW_CHARS, limit, offset, include_text: true, division },
				signal
			),
			lawArticleList(bwb).then((r) => r.items)
		]);
		return {
			total: at.total,
			division: at.division,
			firstVersionFrom: at.first_version_from ?? null,
			items: atArticles(at.items, now).map((a) => ({ ...a, address: a.article_number }))
		};
	}
	// Today's texts come a page at a time with the list of the day, in the same order: one
	// request per hundred articles instead of one per article that scrolls into view.
	const [r, texts] = await Promise.all([
		getInstrumentArticles(
			bwb,
			{ text_preview_chars: PREVIEW_CHARS, limit, offset, division },
			signal
		),
		getInstrumentArticlesAt(
			bwb,
			today,
			{ text_preview_chars: 0, limit, offset, include_text: true, division },
			signal
		)
			.then(
				(at) =>
					new Map(
						at.items.map((a) => [
							a.article_number,
							{
								text: a.text ?? null,
								parts: a.parts?.length ? a.parts : null,
								tables: a.tables ?? [],
								headings: a.headings ?? [],
								footnoteMarks: a.footnote_marks ?? [],
								footnotes: a.footnotes ?? []
							}
						])
					)
			)
			.catch((e) => {
				// Without them each article asks its text alone once it scrolls into view.
				report('Teksten van vandaag', e);
				return new Map<
					string,
					{
						text: string | null;
						parts: Part[] | null;
						tables: Table[];
						headings: Heading[];
						footnoteMarks: FootnoteMark[];
						footnotes: Footnote[];
					}
				>();
			})
	]);
	return {
		total: r.total,
		division: r.division,
		items: r.items.map((a) => {
			const own = a.article_number ? texts.get(a.article_number) : undefined;
			return {
				textToday: own?.text ?? null,
				partsToday: own?.parts ?? null,
				tablesToday: own?.tables ?? [],
				headingsToday: own?.headings ?? [],
				footnoteMarksToday: own?.footnoteMarks ?? [],
				footnotesToday: own?.footnotes ?? [],
				id: a.id,
				key: a.key,
				article_number: a.article_number ?? null,
				label: a.label ?? null,
				heading: a.heading ?? null,
				address: a.article_number ?? a.address ?? null,
				breadcrumb: a.breadcrumb ?? [],
				text: null,
				parts: null,
				tables: [],
				footnoteMarks: [],
				footnotes: [],
				text_preview: a.text_preview ?? null
			};
		})
	};
}

/** Every article of the law, where the list starts at a division: the count it pages to. */
function lawTotal(bwb: string, day: string | null, signal: AbortSignal): Promise<number> {
	// Today's whole list is the one the table of contents reads: no request of its own.
	if (!day) return lawArticleList(bwb).then((r) => r.total);
	return getInstrumentArticlesAt(bwb, day, { text_preview_chars: 0, limit: 1 }, signal).then(
		(r) => r.total
	);
}

/**
 * The list of the reader, its every change given to `onChange`. `today` is the day whose
 * texts come with the pages of the text in force.
 */
export function createLawList(onChange: (list: LawList) => void, today: string) {
	let list = EMPTY_LIST;
	const set = (change: Partial<LawList>) => onChange((list = { ...list, ...change }));

	/** A division the API did not find (404): the list reads on from the start to it. */
	const withoutDivision = new Set<string>();
	/** The division the list opened at last: opened once, never again for the same anchor. */
	let opened = '';
	let current: { bwb: string; day: string | null; controller: AbortController } | null = null;

	/**
	 * The list from its start, or from a division alone (`deel-…`), its heading first: the
	 * reader pages on through the law from there (BE-6). A division the API does not know is
	 * read from the start.
	 */
	function open(bwb: string, day: string | null, anchor: string | null) {
		current?.controller.abort();
		current = { bwb, day, controller: new AbortController() };
		const { signal } = current.controller;
		set({ ...EMPTY_LIST, firstVersionFrom: list.firstVersionFrom, total: list.total });
		const division =
			anchor && !withoutDivision.has(divisionKey(bwb, day, anchor)) ? anchor : undefined;
		opened = division ? divisionKey(bwb, day, division) : '';
		loadPage(bwb, day, today, 0, signal, division)
			.then((first) => {
				if (signal.aborted) return;
				const at = first.division?.offset ?? 0;
				set({
					articles: first.items,
					firstVersionFrom: first.firstVersionFrom ?? null,
					start: at,
					total: at + first.total,
					status: 'ready'
				});
				if (!first.division) return;
				// The rest of the law comes after the division: its count fills in the button.
				lawTotal(bwb, day, signal)
					.then((n) => {
						if (!signal.aborted) set({ total: Math.max(n, list.total) });
					})
					.catch((e) => report('Omvang van de wet', e));
			})
			.catch((e) => {
				if (signal.aborted) return;
				if (division && e instanceof ApiError && e.status === 404) {
					withoutDivision.add(divisionKey(bwb, day, division));
					open(bwb, day, null);
				} else {
					report('Wet', e);
					set({ status: 'error', failure: e });
				}
			});
	}

	/** What asks the page that failed again. */
	let retryPage: (() => void) | null = null;

	/**
	 * Pages on to one side with the signal of the list open now: a page that comes after
	 * another list opened changes nothing, and a page that fails leaves the articles shown
	 * and says so at its control, with what asks it again.
	 */
	async function turn(
		richting: Richting,
		again: () => void,
		work: (asked: { bwb: string; day: string | null }, signal: AbortSignal) => Promise<void>
	) {
		if (list.status !== 'ready' || !current) return;
		const asked = current;
		const { signal } = asked.controller;
		set({ status: richting === 'vorige' ? 'loading-before' : 'loading-more', pageFailure: null });
		try {
			await work(asked, signal);
			if (!signal.aborted) set({ status: 'ready' });
		} catch (e) {
			if (signal.aborted) return;
			report('Bladeren in de wet', e);
			retryPage = again;
			set({ status: 'ready', pageFailure: { richting, error: e } });
		}
	}

	/**
	 * The next page, or every page up to the `upTo`th article of the law, PAGES_AT_ONCE
	 * requests at a time; after a division the list of the whole law reads on.
	 */
	const loadMore = (upTo = 0) =>
		turn(
			'volgende',
			() => void loadMore(upTo),
			async ({ bwb, day }, signal) => {
				const from = list.start + list.articles.length;
				const offsets = volgendeBladzijden(from, upTo, list.total, PAGE_SIZE);
				const pages: Row[][] = [];
				for (let i = 0; i < offsets.length; i += PAGES_AT_ONCE) {
					const batch = await Promise.all(
						offsets
							.slice(i, i + PAGES_AT_ONCE)
							.map((o) => loadPage(bwb, day, today, o, signal).then((r) => r.items))
					);
					pages.push(...batch);
				}
				if (!signal.aborted)
					set({ articles: uniqueBy([...list.articles, ...pages.flat()], (a) => a.id) });
			}
		);

	/**
	 * The page before the first article shown, above it. `keep` is called right before it
	 * goes in and gives what puts the article the reader looks at back in place after.
	 */
	const loadPrevious = (keep?: () => () => void): Promise<void> =>
		list.start <= 0
			? Promise.resolve()
			: turn(
					'vorige',
					() => void loadPrevious(keep),
					async ({ bwb, day }, signal) => {
						const { offset, limit } = vorigeBladzijde(list.start, PAGE_SIZE);
						const before = await loadPage(bwb, day, today, offset, signal, undefined, limit);
						if (signal.aborted) return;
						const back = keep?.();
						set({
							articles: uniqueBy([...before.items, ...list.articles], (a) => a.id),
							start: offset
						});
						await tick();
						back?.();
					}
				);

	/**
	 * Loads the pages up to a place. Today's list of the law says on which page it stands, so
	 * those pages come at once; for an earlier day the next page, until the place is there. A
	 * place before the first article shown reads the list from its start again. False where
	 * the law has no such place; a list that did not come is a failed page, not that.
	 */
	async function reach(anchor: string): Promise<boolean> {
		if (!current) return false;
		const asked = current;
		const { bwb, day } = asked;
		if (list.start > 0 && (day || isDivisionAnchor(anchor))) {
			// The division opened but names no heading here: from the start, page by page.
			withoutDivision.add(divisionKey(bwb, day, anchor));
			open(bwb, day, null);
			return true;
		}
		if (day) {
			await loadMore();
			return true;
		}
		let index: number;
		try {
			index = plekVan((await lawArticleList(bwb)).items, anchor);
		} catch (e) {
			if (asked !== current) return true;
			report('Plek in de wet', e);
			retryPage = () => void reach(anchor);
			set({ pageFailure: { richting: 'volgende', error: e } });
			return true;
		}
		if (asked !== current) return true;
		if (index < 0) return false;
		if (index < list.start) open(bwb, null, null);
		else await loadMore(index + 1);
		return true;
	}

	return {
		open,
		loadMore,
		loadPrevious,
		reach,
		/** Whether a division of the table of contents opens alone: not missing, not open. */
		opensAlone: (bwb: string, day: string | null, anchor: string) =>
			!withoutDivision.has(divisionKey(bwb, day, anchor)) &&
			opened !== divisionKey(bwb, day, anchor),
		/** Asks again what failed: the list itself, or the page that did not come. */
		retry() {
			if (list.status === 'error' && current) open(current.bwb, current.day, null);
			else if (list.pageFailure) retryPage?.();
		},
		stop() {
			current?.controller.abort();
			current = null;
		}
	};
}
