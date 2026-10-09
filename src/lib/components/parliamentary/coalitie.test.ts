import { describe, expect, it } from 'vitest';
import { coalitieRegel, coalitieVan, type Kiezer } from './coalitie';

const kiezers: Kiezer[] = [
	{ id: 'factions/d66', name: 'D66', choice: 'Voor', seats: 26 },
	{ id: 'factions/vvd', name: 'VVD', choice: 'Tegen', seats: 22 },
	{ id: 'factions/pro', name: 'PRO', choice: 'Voor', seats: 20 },
	{ id: 'factions/cda', name: 'CDA', choice: 'Tegen', seats: 18 }
];
const coalitie = new Set(['d66', 'vvd', 'cda']);
const inCoalitie = (k: string) => coalitie.has(k);

describe('coalitie', () => {
	it('reads the block only where the API has it', () => {
		expect(coalitieVan({})).toBeNull();
		expect(coalitieVan({ coalition: null })).toBeNull();
		expect(coalitieVan({ coalition: { cabinet: 'jetten', coalition_for: 66 } })).not.toBeNull();
	});

	it('names the coalition fracties per side where it split', () => {
		const r = coalitieRegel(
			{
				cabinet: 'jetten',
				coalition_for: 26,
				coalition_against: 40,
				opposition_for: 30,
				opposition_against: 53,
				pattern: 'split'
			},
			kiezers,
			inCoalitie
		);
		expect(r.stand).toBe('verdeeld');
		expect(r.fractiesVoor.map((k) => k.name)).toEqual(['D66']);
		expect(r.fractiesTegen.map((k) => k.name)).toEqual(['VVD', 'CDA']);
	});

	it('gives the side of a coalition as one, and seats without the hall', () => {
		const r = coalitieRegel(
			{
				cabinet: 'jetten',
				coalition_for: 0,
				coalition_against: 66,
				opposition_for: 56,
				opposition_against: 27,
				pattern: 'together'
			},
			kiezers,
			null
		);
		expect(r).toMatchObject({ stand: 'eensgezind', kant: 'tegen', tegen: 66, fractiesTegen: [] });
	});
});
