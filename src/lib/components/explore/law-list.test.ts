import { describe, expect, it } from 'vitest';
import { lawArticleList } from '$lib/api/law-articles';
import { fakeApi, fail, type FakeRequest } from '$lib/test/fakeApi';
import { articleText, asksAlone, createLawList, type LawList, type Row } from './law-list';

const TODAY = '2026-10-14';
const LIST = '/api/instruments/{bwb_id}/articles';
const AT = '/api/instruments/{bwb_id}/articles/at/{at_date}';

/** A page of `bwb` from the request's offset, ten articles of a law of `total`. */
function page({ params }: FakeRequest, total = 250) {
	const bwb = String(params.path?.bwb_id);
	const offset = Number(params.query?.offset ?? 0);
	const limit = Number(params.query?.limit ?? 100);
	const items = Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
		id: `${bwb}-${offset + i}`,
		key: `${bwb}-${offset + i}`,
		article_number: String(offset + i + 1),
		label: null,
		breadcrumb: [],
		text: null,
		parts: [],
		text_preview: ''
	}));
	return { items, total, division: null, first_version_from: null };
}

/** An answer the test gives by hand, later. */
function later() {
	let give = () => {};
	const answer = new Promise<void>((resolve) => (give = resolve));
	return { answer, give };
}

const settle = () => new Promise((r) => setTimeout(r));

function reader() {
	let list: LawList | null = null;
	const law = createLawList((l) => (list = l), TODAY);
	return { law, now: () => list! };
}

describe('the list of the whole-law reader', () => {
	it('lets a late page of the law before change neither articles nor status', async () => {
		const page2 = later();
		const second = later();
		fakeApi({
			[LIST]: async (r: FakeRequest) => {
				const { bwb_id } = r.params.path ?? {};
				if (bwb_id === 'BWBR1' && Number(r.params.query?.offset) > 0) await page2.answer;
				if (bwb_id === 'BWBR2') await second.answer;
				return page(r);
			},
			[AT]: (r: FakeRequest) => page(r)
		});
		const { law, now } = reader();
		law.open('BWBR1', null, null);
		await settle();
		expect(now().status).toBe('ready');

		const more = law.loadMore();
		law.open('BWBR2', null, null);
		page2.give();
		await more;
		await settle();
		// The page of BWBR1 came after the switch: BWBR2 is still loading, empty.
		expect(now().status).toBe('loading');
		expect(now().articles).toEqual([]);

		second.give();
		await settle();
		expect(now().status).toBe('ready');
		expect(now().articles.every((a) => a.id.startsWith('BWBR2'))).toBe(true);
	});

	it('breaks off the pages of a list once another opens', async () => {
		const page2 = later();
		const api = fakeApi({
			[LIST]: async (r: FakeRequest) => {
				if (Number(r.params.query?.offset) > 0) await page2.answer;
				return page(r);
			},
			[AT]: (r: FakeRequest) => page(r)
		});
		const { law } = reader();
		law.open('BWBR1', null, null);
		await settle();
		const more = law.loadMore();
		await settle();
		law.open('BWBR2', null, null);
		page2.give();
		await more;
		const paged = api.requests.filter((r) => Number(r.params.query?.offset) > 0);
		expect(paged.length).toBeGreaterThan(0);
		expect(paged.every((r) => r.signal?.aborted)).toBe(true);
	});

	it('asks the list of today once for a peildatum and the table of contents', async () => {
		const api = fakeApi({
			[LIST]: (r: FakeRequest) => page(r),
			[AT]: (r: FakeRequest) => page(r)
		});
		const { law, now } = reader();
		law.open('BWBR1', '2015-01-01', null);
		await lawArticleList('BWBR1');
		await settle();
		expect(now().status).toBe('ready');
		expect(api.asked(LIST)).toHaveLength(1);
	});

	it('keeps the articles shown when a page fails, and says so at its button', async () => {
		let broken = true;
		fakeApi({
			[LIST]: (r: FakeRequest) =>
				Number(r.params.query?.offset) > 0 && broken ? fail(500) : page(r),
			[AT]: (r: FakeRequest) => page(r)
		});
		const { law, now } = reader();
		law.open('BWBR1', null, null);
		await settle();
		const shown = now().articles;
		await law.loadMore();
		expect(now().articles).toBe(shown);
		expect(now().status).toBe('ready');
		expect(now().pageFailure?.richting).toBe('volgende');

		broken = false;
		law.retry();
		await settle();
		expect(now().pageFailure).toBeNull();
		expect(now().articles).toHaveLength(20);
	});

	it('says a failed look-up of a place as a failure, not as a place the law lacks', async () => {
		fakeApi({
			[LIST]: (r: FakeRequest) => (r.params.query?.limit === 2000 ? fail(500) : page(r)),
			[AT]: (r: FakeRequest) => page(r)
		});
		const { law, now } = reader();
		law.open('BWBR1', null, null);
		await settle();
		expect(await law.reach('artikel-150')).toBe(true);
		expect(now().pageFailure?.richting).toBe('volgende');
	});
});

/** A law of `total` articles, numbered from 1; a division answers from `division` alone. */
function law(total: number, division?: { anchor: string; offset: number; size: number }) {
	return ({ params }: FakeRequest) => {
		const bwb = String(params.path?.bwb_id);
		const day = params.path?.at_date ? String(params.path.at_date) : null;
		const asked = params.query?.division;
		const within = asked && division && asked === division.anchor;
		if (asked && !within) return fail(404);
		const from = Number(params.query?.offset ?? 0) + (within ? division.offset : 0);
		const end = within ? division.offset + division.size : total;
		const count = Math.max(Math.min(Number(params.query?.limit ?? 100), end - from), 0);
		const items = Array.from({ length: count }, (_, i) => {
			const n = String(from + i + 1);
			return {
				id: `${bwb}-${n}`,
				key: `${bwb}-${n}`,
				article_number: n,
				label: null,
				breadcrumb: [],
				text: day ? `Artikel ${n} op ${day}.` : null,
				parts: [],
				text_preview: ''
			};
		});
		return {
			items,
			total: within ? division.size : total,
			division: within
				? { anchor: division.anchor, type: 'hoofdstuk', label: null, offset: division.offset }
				: null,
			first_version_from: null
		};
	};
}

describe('what the whole-law reader does with its list', () => {
	it('opens a division alone, then reads on through the rest of the law', async () => {
		const chapter = { anchor: 'deel-hoofdstuk-3', offset: 120, size: 30 };
		const api = fakeApi({ [LIST]: law(400, chapter), [AT]: law(400, chapter) });
		const { law: list, now } = reader();
		list.open('BWBR1', null, chapter.anchor);
		await settle();
		await lawArticleList('BWBR1');
		await settle();
		expect(now().start).toBe(120);
		expect(now().articles.map((a) => a.article_number)).toEqual(
			Array.from({ length: 30 }, (_, i) => String(121 + i))
		);
		// The rest of the law counts in, for the controls on both sides.
		expect(now().total).toBe(400);
		expect(list.opensAlone('BWBR1', null, chapter.anchor)).toBe(false);

		await list.loadMore();
		const next = api.asked(LIST).at(-1);
		expect(next?.query).toMatchObject({ offset: 150 });
		expect(next?.query?.division).toBeUndefined();
		expect(now().articles.at(-1)?.article_number).toBe('250');
	});

	it('reads a division the API does not know from the start of the law', async () => {
		fakeApi({ [LIST]: law(400), [AT]: law(400) });
		const { law: list, now } = reader();
		list.open('BWBR1', null, 'deel-hoofdstuk-9');
		await settle();
		await settle();
		expect(now().start).toBe(0);
		expect(now().articles[0].article_number).toBe('1');
		expect(list.opensAlone('BWBR1', null, 'deel-hoofdstuk-9')).toBe(false);
	});

	it('loads the pages up to the article an anchor names', async () => {
		fakeApi({ [LIST]: law(400), [AT]: law(400) });
		const { law: list, now } = reader();
		list.open('BWBR1', null, null);
		await settle();
		expect(now().articles).toHaveLength(100);
		expect(await list.reach('artikel-250')).toBe(true);
		expect(now().articles.some((a) => a.article_number === '250')).toBe(true);
		expect(now().status).toBe('ready');
		// A place the law lacks: nothing to load.
		expect(await list.reach('artikel-999')).toBe(false);
	});

	it('pages up with the article looked at kept in place', async () => {
		const chapter = { anchor: 'deel-hoofdstuk-5', offset: 150, size: 20 };
		fakeApi({ [LIST]: law(400, chapter), [AT]: law(400, chapter) });
		const { law: list, now } = reader();
		list.open('BWBR1', null, chapter.anchor);
		await settle();
		const steps: string[] = [];
		await list.loadPrevious(() => {
			steps.push(`keep at ${now().articles.length}`);
			return () => steps.push(`back at ${now().articles.length}`);
		});
		// The place is taken before the page goes in above it and given back after.
		expect(steps).toEqual(['keep at 20', 'back at 120']);
		expect(now().start).toBe(50);
		expect(now().articles[0].article_number).toBe('51');
	});

	it('brings the texts of a peildatum, and those of today, with the list', async () => {
		fakeApi({ [LIST]: law(30), [AT]: law(30) });
		const { law: list, now } = reader();
		list.open('BWBR1', '2015-01-01', null);
		await settle();
		const first = now().articles[0];
		expect(first.text).toBe('Artikel 1 op 2015-01-01.');
		expect(first.key).toBe('BWBR1-1');

		list.open('BWBR1', null, null);
		await settle();
		expect(now().articles[0].text).toBeNull();
		expect(now().articles[0].textToday).toBe(`Artikel 1 op ${TODAY}.`);
	});
});

describe('the text an article of the whole law shows', () => {
	const row = (r: Partial<Row>): Row => ({
		id: 'a',
		key: 'a',
		article_number: '1',
		label: null,
		heading: null,
		address: '1',
		breadcrumb: [],
		text: null,
		parts: null,
		tables: [],
		text_preview: null,
		...r
	});
	const detail = { text: 'Uit het artikel.', parts: null };

	it('takes the text of the peildatum first, uncited', () => {
		expect(articleText(row({ text: 'Oud.', textToday: 'Nu.' }), detail)).toEqual({
			text: 'Oud.',
			parts: null,
			tables: [],
			headings: [],
			cited: false
		});
	});

	it('takes the text of today from the page, else from the article alone, cited', () => {
		expect(articleText(row({ textToday: 'Nu.' }), detail)).toMatchObject({
			text: 'Nu.',
			cited: true
		});
		expect(articleText(row({}), detail)).toMatchObject({ text: 'Uit het artikel.', cited: true });
	});

	it('brings the tables of the text it takes', () => {
		const t = { start: 0, end: 3, head_rows: 1, columns: 2, spans: [] };
		expect(articleText(row({ textToday: 'a\tb', tablesToday: [t] }), detail)?.tables).toEqual([t]);
		expect(articleText(row({}), { ...detail, tables: [t] })?.tables).toEqual([t]);
	});

	it('brings the headings of the text it takes, as a bijlage does', () => {
		const h = { start: 0, end: 3 };
		expect(articleText(row({ text: 'Kop', headings: [h] }), detail)?.headings).toEqual([h]);
		expect(articleText(row({ textToday: 'Kop', headingsToday: [h] }), detail)?.headings).toEqual([
			h
		]);
		expect(articleText(row({}), { ...detail, headings: [h] })?.headings).toEqual([h]);
	});

	it('has no text where none came: the preview stands', () => {
		expect(articleText(row({ text_preview: 'Begin' }), undefined)).toBeNull();
	});
});

describe('the article of the whole law asked alone', () => {
	const row = (r: Partial<Row>): Row => ({
		id: 'a',
		key: 'a',
		article_number: '1',
		label: null,
		heading: null,
		address: '1',
		breadcrumb: [],
		text: null,
		parts: null,
		tables: [],
		text_preview: null,
		...r
	});

	it('is asked for today: its references, and its text where the page lacked it', () => {
		expect(asksAlone(row({ textToday: 'Nu.' }), null)).toBe('1');
		expect(asksAlone(row({}), null)).toBe('1');
	});

	it('is not asked on a peildatum, for an old text, or for an article no longer in the law', () => {
		expect(asksAlone(row({ textToday: 'Nu.' }), '2015-01-01')).toBeNull();
		expect(asksAlone(row({ text: 'Oud.' }), null)).toBeNull();
		expect(asksAlone(row({ key: null }), null)).toBeNull();
		expect(asksAlone(row({ address: null }), null)).toBeNull();
	});
});
