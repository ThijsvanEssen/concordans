import { describe, expect, it } from 'vitest';
import { dossierCounts } from './counts';

describe('dossierCounts', () => {
	it('says the counts there are, then what the dossier lacks', () => {
		expect(dossierCounts({ documents: 1, decisions: 0, activities: 0 })).toBe(
			'1 stuk, geen stemmingen of activiteiten'
		);
		expect(dossierCounts({ documents: 1204, decisions: 4, activities: 1 })).toBe(
			'1.204 stukken, 4 stemmingen, 1 activiteit'
		);
		expect(dossierCounts({})).toBe('geen stukken, stemmingen of activiteiten');
	});
});
