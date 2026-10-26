import { describe, expect, it } from 'vitest';
import { drawnLineKinds } from './line-kind';

const names = (...a: Parameters<typeof drawnLineKinds>) => drawnLineKinds(...a).map((k) => k.label);

describe('the lines the key names', () => {
	it('names nothing where nothing is drawn', () => {
		expect(names({})).toEqual([]);
	});
	it('names a kind once, in the order of the table', () => {
		expect(names({ AMENDS: 3, REPEALS: 1, MEMBER_OF: 2, BASED_ON: 1 })).toEqual([
			'Structureel',
			'Wijziging',
			'Lid van'
		]);
	});
	it('reads a citation by where it starts: an article cites structurally, a judgment as Aanhaling', () => {
		expect(names({ REFERS_TO: 4 }, ['articles'])).toEqual(['Structureel']);
		expect(names({ REFERS_TO: 4 }, ['judgments'])).toEqual(['Aanhaling']);
		expect(names({ REFERS_TO: 4 }, ['articles', 'judgments'])).toEqual([
			'Structureel',
			'Aanhaling'
		]);
	});
});
