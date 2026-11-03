import { describe, expect, it } from 'vitest';
import { largestKinds } from './entry';

describe('largestKinds', () => {
	it('names the two largest, largest first', () => {
		expect(
			largestKinds([
				{ id: 'lawArticles', count: 55 },
				{ id: 'documents', count: 121 },
				{ id: 'judgments', count: 11183 },
				{ id: 'publicaties', count: 3 }
			])
		).toBe('11.183 uitspraken, 121 stukken');
	});

	it('counts one in the singular and leaves out what is empty', () => {
		expect(
			largestKinds([
				{ id: 'judgments', count: 1 },
				{ id: 'documents', count: 0 }
			])
		).toBe('1 uitspraak');
	});
});
