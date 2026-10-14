import { describe, expect, it } from 'vitest';
import { lawArticleList } from '$lib/api/law-articles';
import { fakeApi, fail, type FakeRequest } from '$lib/test/fakeApi';
import { createLawList, type LawList } from './law-list';

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

		void law.loadMore();
		law.open('BWBR2', null, null);
		page2.give();
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
		void law.loadMore();
		await settle();
		law.open('BWBR2', null, null);
		page2.give();
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
