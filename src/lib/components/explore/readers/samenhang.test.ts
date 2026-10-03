import { describe, expect, it } from 'vitest';
import type { Neighbor } from '$lib/api/nodes';
import { samenhangVan } from './samenhang';

const edge = (direction: 'inbound' | 'outbound', text: string) =>
	({
		id: 'judgments/ecli_nl_hr_2026_1357',
		key: 'ecli_nl_hr_2026_1357',
		collection: 'judgments',
		display_name: 'Hoge Raad 2026-08-25 / 24/01299',
		relation: 'RELATED_TO',
		direction,
		props: { ecli: 'ECLI:NL:HR:2026:1357', court: 'Hoge Raad', date: '2026-08-25', names: [] },
		meta: { basis: 'summary_text', text }
	}) as unknown as Neighbor;

describe('samenhangVan (HR:2026:1356 and 1357)', () => {
	it('gives one row per case, with the sentence of each side', () => {
		const rows = samenhangVan(
			[edge('inbound', 'Samenhang met 24/01260.'), edge('outbound', 'Samenhang met 24/01299.')],
			[{ key: 'ecli_nl_hr_2026_1357', ecli: 'ECLI:NL:HR:2026:1357' }]
		);
		expect(rows).toEqual([
			{
				key: 'ecli_nl_hr_2026_1357',
				titel: 'ECLI:NL:HR:2026:1357',
				instantie: 'Hoge Raad',
				datum: '2026-08-25',
				zinnen: [
					{ text: 'Samenhang met 24/01299.', van: 'deze' },
					{ text: 'Samenhang met 24/01260.', van: 'die' }
				]
			}
		]);
	});

	it('keeps a case the node response did not carry, by its ECLI', () => {
		expect(samenhangVan([], [{ key: 'k', ecli: 'ECLI:NL:X:1' }])[0].titel).toBe('ECLI:NL:X:1');
	});
});
