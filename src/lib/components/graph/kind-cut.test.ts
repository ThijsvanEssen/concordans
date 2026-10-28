import { describe, expect, it } from 'vitest';
import { kindCuts } from './kind-cut';

describe('the whole of a kind the API cut off', () => {
	it('stands beside the kind drawn, of the canvas', () => {
		expect(
			kindCuts([{ collection: 'judgments', total: 10395, kept: 67 }], { uitspraken: 63 })
		).toEqual({ uitspraken: { total: 10395, collection: 'judgments' } });
	});

	it('goes to the last kind of a collection, less what the others draw', () => {
		const cuts = kindCuts([{ collection: 'instruments', total: 132, kept: 68 }], {
			internationaal: 2,
			wetten: 66
		});
		expect(cuts).toEqual({ wetten: { total: 130, collection: 'instruments' } });
	});

	it('says nothing where all came, or where nothing of it is drawn', () => {
		expect(
			kindCuts(
				[
					{ collection: 'articles', total: 14, kept: 14 },
					{ collection: 'members', total: 40, kept: 20 }
				],
				{ artikelen: 14 }
			)
		).toEqual({});
	});
});
