import { beforeEach, describe, expect, it } from 'vitest';
import { keepList, readKept } from './kept';

const page = { items: [], total: 0, more: false };

describe('the lists kept for Back', () => {
	beforeEach(() => sessionStorage.clear());

	it('reads only whole entries: an old or broken one is left out (audit, readKept)', () => {
		sessionStorage.setItem(
			'concordans:bladeren',
			JSON.stringify([null, { url: 1 }, { url: '/a?', category: 'laws', page, scroll: 3 }])
		);
		expect(readKept().map((k) => k.url)).toEqual(['/a?']);
	});

	it('keeps the most recent first, once per URL', () => {
		keepList({ url: '/a?', category: 'laws', page, scroll: 0 });
		keepList({ url: '/b?', category: 'laws', page, scroll: 0 });
		keepList({ url: '/a?', category: 'laws', page, scroll: 9 });
		expect(readKept().map((k) => [k.url, k.scroll])).toEqual([
			['/a?', 9],
			['/b?', 0]
		]);
	});

	it('reads nothing from what is no list', () => {
		sessionStorage.setItem('concordans:bladeren', '{"x":1}');
		expect(readKept()).toEqual([]);
	});
});
