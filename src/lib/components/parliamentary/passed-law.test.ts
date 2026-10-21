import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { inForceWords, lawsMade } from './passed-law';

type Instrument = Schema<'DossierInstrumentDTO'>;
const instrument = (i: Partial<Instrument>): Instrument =>
	({
		id: `instruments/${i.key}`,
		jurisdiction: 'nl',
		status: 'canoniek',
		links: [],
		...i
	}) as Instrument;
const links = (...relations: string[]) =>
	relations.map((relation) => ({ relation, status: 'canoniek' })) as Instrument['links'];

describe('lawsMade', () => {
	it('names the law a passed bill made, not the laws it changed (36496)', () => {
		const d = {
			instruments: [
				instrument({
					key: 'bwbr0049889',
					bwb_id: 'BWBR0049889',
					display_name: 'Wet betaalbare huur',
					relation: 'legislated_in',
					links: links('legislated_in', 'establishes')
				}),
				instrument({
					key: 'bwbr0005290',
					bwb_id: 'BWBR0005290',
					display_name: 'Burgerlijk Wetboek Boek 7',
					relation: 'amends',
					links: links('amends')
				})
			]
		};
		expect(lawsMade(d)).toEqual([{ key: 'bwbr0049889', name: 'Wet betaalbare huur' }]);
	});

	it('names a law of the Staatsblad the bill established (36327)', () => {
		const d = {
			instruments: [
				instrument({
					key: 'wet_stb_2026_56',
					display_name: 'Wetboek van Strafvordering (Stb. 2026, 56)',
					relation: 'establishes',
					links: links('establishes')
				})
			]
		};
		expect(lawsMade(d)).toEqual([
			{ key: 'wet_stb_2026_56', name: 'Wetboek van Strafvordering (Stb. 2026, 56)' }
		]);
	});

	it('leaves out a treaty approved in the dossier, and gives none for a bill not passed', () => {
		const verdrag = instrument({
			key: 'verdrag_013028',
			display_name: 'Overeenkomst',
			relation: 'legislated_in',
			links: links('legislated_in')
		});
		expect(lawsMade({ instruments: [verdrag] })).toEqual([]);
		expect(lawsMade({ instruments: [] })).toEqual([]);
		expect(lawsMade({})).toEqual([]);
	});
});

describe('inForceWords', () => {
	it('says a day past and a day to come', () => {
		expect(inForceWords('2024-07-01', '2026-10-21')).toBe('in werking getreden op');
		expect(inForceWords('2027-01-01', '2026-10-21')).toBe('treedt in werking op');
	});
});
