import { describe, expect, it } from 'vitest';
import { ambtZin } from './ambt';

describe('a lid’s posts in the head of their votes in office', () => {
	it('names the cabinet once after its posts (UX-toets 0.79.44, #46)', () => {
		expect(
			ambtZin([
				{ function: 'Viceminister-president', cabinet: 'kabinet-Schoof' },
				{ function: 'Minister van VRO', cabinet: 'kabinet-Schoof' },
				{ function: 'Minister voor Asiel en Migratie', cabinet: 'kabinet-Schoof' }
			])
		).toBe(
			'viceminister-president, minister van VRO en minister voor Asiel en Migratie (kabinet-Schoof)'
		);
	});

	it('keeps each cabinet with its own posts, and says nothing without posts', () => {
		expect(
			ambtZin([
				{ function: 'Minister-president', cabinet: 'kabinet-Rutte III' },
				{ function: 'Minister-president', cabinet: 'kabinet-Rutte IV' }
			])
		).toBe('minister-president (kabinet-Rutte III) en minister-president (kabinet-Rutte IV)');
		expect(ambtZin([{ function: 'Minister-president' }])).toBe('minister-president');
		expect(ambtZin([])).toBeNull();
		expect(ambtZin(null)).toBeNull();
	});
});
