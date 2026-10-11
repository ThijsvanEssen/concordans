import { describe, expect, it } from 'vitest';
import { behoudenBuckets, behoudenIds, meldSoort } from './soorten';

describe('kinds loaded in full survive "Alles laden"', () => {
	const focal = 'dossiers/21501_02';
	const stukken = Array.from({ length: 3207 }, (_, i) => `documents/d${i}`);

	it('keeps the ids and the count of a kind loaded in full around the same focus', () => {
		const geladen = meldSoort(null, focal, 'documents', stukken);
		expect(behoudenIds(geladen, focal).size).toBe(3207);
		const buckets = [
			{ collection: 'documents', total: 3207, kept: 574 },
			{ collection: 'activities', total: 2656, kept: 576 }
		];
		expect(behoudenBuckets(buckets, geladen, focal)).toEqual([
			{ collection: 'documents', total: 3207, kept: 3207 },
			{ collection: 'activities', total: 2656, kept: 576 }
		]);
	});

	it('adds up the pages of one kind and starts over for another focus', () => {
		let geladen = meldSoort(null, focal, 'documents', stukken.slice(0, 500));
		geladen = meldSoort(geladen, focal, 'documents', stukken.slice(400, 900));
		expect(behoudenIds(geladen, focal).size).toBe(900);
		geladen = meldSoort(geladen, 'dossiers/36774', 'votes', ['decisions/x']);
		expect(behoudenIds(geladen, focal).size).toBe(0);
		expect(behoudenIds(geladen, 'dossiers/36774').size).toBe(1);
	});
});
