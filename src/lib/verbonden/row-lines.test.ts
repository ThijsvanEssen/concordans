import { describe, expect, it } from 'vitest';
import { activityLine, citedLine } from './rows';

describe('citedLine', () => {
	it('names two articles and counts the rest', () => {
		expect(citedLine([])).toBeNull();
		expect(citedLine([{ article_number: '4:12' }])).toBe('art. 4:12');
		expect(
			citedLine([
				{ article_number: '4:12' },
				{ article_number: '5:49' },
				{ article_number: '5:50' }
			])
		).toBe('art. 4:12, 5:49 en 1 ander');
		expect(
			citedLine([
				{ article_number: '1' },
				{ article_number: '2' },
				{ article_number: '3' },
				{ article_number: null },
				{ article_number: '4' }
			])
		).toBe('art. 1, 2 en 2 andere');
	});
});

describe('activityLine', () => {
	it('names the kind, a status out of the ordinary and the dossiers', () => {
		expect(
			activityLine({ kind: 'Commissiedebat', status: 'Uitgevoerd', dossier_numbers: ['36600'] })
		).toBe('Commissiedebat, over 36600');
		expect(
			activityLine({
				kind: 'Commissiedebat',
				status: 'Geannuleerd',
				dossier_numbers: ['22112', '21501-04']
			})
		).toBe('Commissiedebat, geannuleerd, over 22112 en 21501-04');
		expect(activityLine({})).toBeNull();
	});
});
