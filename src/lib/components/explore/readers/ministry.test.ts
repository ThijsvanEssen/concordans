import { describe, expect, it } from 'vitest';
import { ministryTitle, periodWords } from './ministry';

describe('the words of a ministry', () => {
	it('names the ministry, and until when a name it no longer has', () => {
		expect(ministryTitle('Financiën')).toBe('Ministerie van Financiën');
		expect(ministryTitle('Veiligheid en Justitie', '2017-10-25')).toBe(
			'Ministerie van Veiligheid en Justitie (tot 2017)'
		);
	});

	it('says each stretch it had the name, oldest first', () => {
		const nbsp = ' ';
		expect(periodWords([{ from: '2017-10-26', to: null }])).toBe(
			`sinds 26${nbsp}oktober${nbsp}2017`
		);
		expect(periodWords([{ from: null, to: '2010-10-14' }])).toBe(`tot 14${nbsp}oktober${nbsp}2010`);
		expect(
			periodWords([
				{ from: '2002-07-22', to: '2010-10-14' },
				{ from: '2017-10-26', to: null }
			])
		).toBe(
			`vanaf 22${nbsp}juli${nbsp}2002 tot 14${nbsp}oktober${nbsp}2010; sinds 26${nbsp}oktober${nbsp}2017`
		);
		expect(periodWords([{ from: null, to: null }])).toBeNull();
	});
});
