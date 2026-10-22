import { describe, expect, it } from 'vitest';
import { documents } from './lists/documents';
import { requestFrom } from './deep';

type Doc = { key: string; date: string | null };
const deep = documents as unknown as Parameters<typeof requestFrom<Doc, { to?: string }>>[0];

describe('a list past what the API pages to (B16)', () => {
	it('asks the same list from the offset while the API reaches it', () => {
		expect(requestFrom(deep, { to: '2026-01-01' }, 10_000, [])).toEqual({
			query: { to: '2026-01-01' },
			offset: 10_000,
			behind: 0
		});
	});

	it('goes on from the last day shown, with the papers of that day already shown as the offset', () => {
		const loaded: Doc[] = [
			{ key: 'a', date: '2026-03-02' },
			{ key: 'b', date: '2026-03-01' },
			{ key: 'c', date: '2026-03-01' }
		];
		expect(requestFrom(deep, {}, 10_050, loaded)).toEqual({
			query: { to: '2026-03-01' },
			offset: 2,
			behind: 10_048
		});
	});

	it('cannot go on from a paper without a day', () => {
		expect(requestFrom(deep, {}, 10_050, [{ key: 'a', date: null }])).toBeNull();
	});

	it('leaves a list that reaches everywhere alone', () => {
		expect(requestFrom({}, { q: 1 }, 99_999, [])).toEqual({
			query: { q: 1 },
			offset: 99_999,
			behind: 0
		});
	});
});
