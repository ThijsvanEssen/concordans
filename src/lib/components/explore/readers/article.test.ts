import { afterEach, describe, expect, it, vi } from 'vitest';

const getArticleDetail = vi.fn();
const getArticleHistory = vi.fn();
vi.mock('$lib/api/articles', () => ({ getArticleDetail, getArticleHistory }));
vi.mock('$lib/api/instrument-cache', () => ({ recordArticleLaw: vi.fn() }));

const { articleKey, fetchArticle, HISTORY_WAIT } = await import('./article');
const { createLoader } = await import('$lib/util/load.svelte');

const settle = () => new Promise((r) => setTimeout(r));

afterEach(() => vi.restoreAllMocks());

describe('fetchArticle', () => {
	it('stays loading, without a failure, while the key is not known yet', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const states: string[] = [];
		const loader = createLoader(fetchArticle, (s) => states.push(s.status), 'Artikel');
		loader.load(articleKey('', '21'));
		await settle();
		expect(states).toEqual(['loading']);
		expect(getArticleDetail).not.toHaveBeenCalled();
		expect(warn).not.toHaveBeenCalled();
	});

	it('asks the law and the number the key names', async () => {
		getArticleDetail.mockResolvedValue({ instrument: {} });
		getArticleHistory.mockResolvedValue({ versions: [] });
		const answer = await fetchArticle(articleKey('32022L2555', '7:1576'));
		expect(getArticleDetail).toHaveBeenCalledWith('32022L2555', '7:1576');
		expect(answer.versions).toEqual({ status: 'ready', data: [] });
	});

	it('gives the text without waiting long for its tekstversies (art. 1:1 Wft: 16 MB)', async () => {
		vi.useFakeTimers();
		try {
			getArticleDetail.mockResolvedValue({ instrument: {} });
			let answer: (v: unknown) => void = () => {};
			getArticleHistory.mockReturnValue(new Promise((r) => (answer = r)));
			const pending = fetchArticle(articleKey('BWBR0020368', '1:1'));
			await vi.advanceTimersByTimeAsync(HISTORY_WAIT);
			const got = await pending;
			expect(got.versions).toEqual({ status: 'loading' });
			answer({ versions: [] });
			expect(await got.later).toEqual({ status: 'ready', data: [] });
		} finally {
			vi.useRealTimers();
		}
	});
});
