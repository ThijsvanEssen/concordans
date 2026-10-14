// The list of a law's articles in the whole-law reader: opened from its start or at a
// division, paged on both ways, and loaded up to a place. One list is open at a time; what
// arrives for a list no longer open changes nothing.
import { tick } from 'svelte';
import { ApiError, api, unwrap } from '$lib/api/client';
import { report } from '$lib/api/errors';
import { lawArticleList } from '$lib/api/law-articles';
import type { Schema } from '$lib/api/types';
import { parseAnchor } from '$lib/text/anchor';
import { plekVan } from '$lib/text/division';
import { onForget } from '$lib/util/forget';
import { uniqueBy } from '$lib/util/unique';
import { volgendeBladzijden, vorigeBladzijde, type Richting } from './bladeren';
import { atArticles } from './peildatum';

// The overview lists every article of the law with a preview only: at full text and parts
// per article, 810 articles would balloon the payload. The full text of an article of today
// comes with its page (the list of the day); one the page lacks is asked for alone.
export const PREVIEW_CHARS = 600;
export const PAGE_SIZE = 100;

type Part = Schema<'ArticlePartSpanDTO'>;
type Division = Schema<'InstrumentDivisionDTO'>;

/** An article as the list shows it, of today or of the peildatum. */
export type Row = {
	id: string;
	/** The article to link to; null for one that is no longer in the law. */
	key: string | null;
	article_number: string | null;
	label: string | null;
	address: string | null;
	breadcrumb: Schema<'InstrumentArticleNodeDTO'>['breadcrumb'];
	/** The whole text of an old version, which comes with the list. */
	text: string | null;
	/** Its aanhef, leden and onderdelen; null from an API without them (read from the text). */
	parts: Part[] | null;
	/** The whole text of today, from the list of the day (`include_text`), per page. */
	textToday?: string | null;
	partsToday?: Part[] | null;
	text_preview: string | null;
};

export type ListStatus = 'loading' | 'loading-more' | 'loading-before' | 'ready' | 'error';

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
		// call per article for a version. Today's list says which article to link to.
		const [at, now] = await Promise.all([
			unwrap(
				api.GET('/api/instruments/{bwb_id}/articles/at/{at_date}', {
					params: {
						path: { bwb_id: bwb, at_date: day },
						query: {
							text_preview_chars: PREVIEW_CHARS,
							limit,
							offset,
							include_text: true,
							division
						}
					},
					signal
				})
			),
			articlesNow(bwb)
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
		unwrap(
			api.GET('/api/instruments/{bwb_id}/articles', {
				params: {
					path: { bwb_id: bwb },
					query: { text_preview_chars: PREVIEW_CHARS, limit, offset, division }
				},
				signal
			})
		),
		unwrap(
			api.GET('/api/instruments/{bwb_id}/articles/at/{at_date}', {
				params: {
					path: { bwb_id: bwb, at_date: today },
					query: { text_preview_chars: 0, limit, offset, include_text: true, division }
				},
				signal
			})
		)
			.then(
				(at) =>
					new Map(
						at.items.map((a) => [
							a.article_number,
							{ text: a.text ?? null, parts: a.parts?.length ? a.parts : null }
						])
					)
			)
			.catch(() => new Map<string, { text: string | null; parts: Part[] | null }>())
	]);
	return {
		total: r.total,
		division: r.division,
		items: r.items.map((a) => {
			const own = a.article_number ? texts.get(a.article_number) : undefined;
			return {
				textToday: own?.text ?? null,
				partsToday: own?.parts ?? null,
				id: a.id,
				key: a.key,
				article_number: a.article_number ?? null,
				label: a.label ?? null,
				address: a.article_number ?? a.address ?? null,
				breadcrumb: a.breadcrumb ?? [],
				text: null,
				parts: null,
				text_preview: a.text_preview ?? null
			};
		})
	};
}

// The articles of today, for an earlier day only which article to link to, once per law.
const todayList = new Map<string, Promise<Schema<'InstrumentArticleNodeDTO'>[]>>();
onForget(() => todayList.clear());
function articlesNow(bwb: string) {
	let list = todayList.get(bwb);
	if (!list) {
		list = unwrap(
			api.GET('/api/instruments/{bwb_id}/articles', {
				params: { path: { bwb_id: bwb }, query: { text_preview_chars: 0, limit: 2000 } }
			})
		).then((r) => r.items);
		list.catch(() => todayList.delete(bwb));
		todayList.set(bwb, list);
	}
	return list;
}

/** Every article of the law, where the list starts at a division: the count it pages to. */
function lawTotal(bwb: string, day: string | null, signal: AbortSignal): Promise<number> {
	// Today's whole list is the one the table of contents reads: no request of its own.
	if (!day) return lawArticleList(bwb).then((r) => r.total);
	return unwrap(
		api.GET('/api/instruments/{bwb_id}/articles/at/{at_date}', {
			params: { path: { bwb_id: bwb, at_date: day }, query: { text_preview_chars: 0, limit: 1 } },
			signal
		})
	).then((r) => r.total);
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
		const asked = (current = { bwb, day, controller: new AbortController() });
		const { signal } = asked.controller;
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

	/**
	 * The next page, or every page up to the `upTo`th article of the law, two requests at a
	 * time; after a division the list of the whole law reads on.
	 */
	async function loadMore(upTo = 0) {
		if (list.status !== 'ready' || !current) return;
		const asked = current;
		const offsets = volgendeBladzijden(
			list.start + list.articles.length,
			upTo,
			list.total,
			PAGE_SIZE
		);
		set({ status: 'loading-more' });
		try {
			const pages: Row[][] = [];
			for (let i = 0; i < offsets.length; i += 2) {
				const batch = await Promise.all(
					offsets
						.slice(i, i + 2)
						.map((o) => loadPage(asked.bwb, asked.day, today, o).then((r) => r.items))
				);
				pages.push(...batch);
			}
			if (asked === current)
				set({ articles: uniqueBy([...list.articles, ...pages.flat()], (a) => a.id) });
		} catch {
			// The articles already shown stay; the button remains for another attempt.
		}
		set({ status: 'ready' });
	}

	/**
	 * The page before the first article shown, above it. `keep` is called right before it
	 * goes in and gives what puts the article the reader looks at back in place after.
	 */
	async function loadPrevious(keep?: () => () => void) {
		if (list.status !== 'ready' || list.start <= 0 || !current) return;
		const asked = current;
		const { offset, limit } = vorigeBladzijde(list.start, PAGE_SIZE);
		set({ status: 'loading-before' });
		try {
			const before = await loadPage(
				asked.bwb,
				asked.day,
				today,
				offset,
				undefined,
				undefined,
				limit
			);
			if (asked === current) {
				const back = keep?.();
				set({
					articles: uniqueBy([...before.items, ...list.articles], (a) => a.id),
					start: offset
				});
				await tick();
				back?.();
			}
		} catch {
			// The articles already shown stay; the button remains for another attempt.
		}
		set({ status: 'ready' });
	}

	/**
	 * Loads the pages up to a place. Today's list of the law says on which page it stands, so
	 * those pages come at once; for an earlier day the next page, until the place is there. A
	 * place before the first article shown reads the list from its start again. False where
	 * the law has no such place.
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
		const index = await lawArticleList(bwb)
			.then((r) => plekVan(r.items, anchor))
			.catch(() => -1);
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
			if (!current) return;
			if (list.status === 'error') open(current.bwb, current.day, null);
		},
		stop() {
			current?.controller.abort();
			current = null;
		}
	};
}
