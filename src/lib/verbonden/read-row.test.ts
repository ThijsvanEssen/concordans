import { describe, expect, it } from 'vitest';
import { readOfRow } from './read-row';

describe('a row of an article in Verbonden', () => {
	const row = (collection: 'articles' | 'judgments', at: string | null = null) => ({
		ref: { collection, key: 'bwbr0052875_23' },
		at,
		missing: false
	});

	it('reads in the panel at the lid it names', () => {
		expect(readOfRow(row('articles', 'lid-1'), false)).toEqual({
			key: 'bwbr0052875_23',
			at: 'lid-1'
		});
		expect(readOfRow(row('articles', 'rov-4'), false)).toEqual({ key: 'bwbr0052875_23', at: null });
	});

	it('leaves any other bron, and a group read in place, to the row', () => {
		expect(readOfRow(row('judgments'), false)).toBeNull();
		expect(readOfRow(row('articles'), true)).toBeNull();
		expect(readOfRow({ ...row('articles'), missing: true }, false)).toBeNull();
	});
});
