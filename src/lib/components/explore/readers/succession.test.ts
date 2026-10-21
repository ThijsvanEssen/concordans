import { describe, expect, it } from 'vitest';
import {
	compareTarget,
	lidPairings,
	outcomeParts,
	outcomesOf,
	ownSuccessionName,
	partRows,
	successionName,
	successionSources,
	successionStatus,
	sourceUrl,
	type Succession
} from './succession';
import { newSv, oldSv, outcomeNode } from '$lib/fixtures/succession';

const sv = { citationTitle: 'Wetboek van Strafvordering', shortTitle: 'Sv' };

describe('successionName', () => {
	it('cites the new code under the old title by the old short title, marked new', () => {
		expect(successionName(newSv, sv, 'new')).toBe('art. 2.8.6 Sv (nieuw)');
	});

	it('cites the old article by its own short title', () => {
		expect(
			successionName(oldSv, { citationTitle: sv.citationTitle, shortTitle: null }, 'old')
		).toBe('art. 126ffa Sv');
	});

	it('cites a law with a title of its own by that title', () => {
		const other: Succession = {
			...newSv,
			article: {
				...newSv.article,
				instrument: { ...newSv.article.instrument!, citation_title: 'Omgevingswet' }
			}
		};
		expect(successionName(other, sv, 'new')).toBe('art. 2.8.6 Omgevingswet');
	});
});

describe('successionStatus', () => {
	it('says a law that is not in force yet is not', () => {
		expect(successionStatus(newSv)).toBe('vastgesteld, nog niet in werking');
	});

	it('says nothing of a law in force', () => {
		expect(successionStatus(oldSv)).toBeNull();
	});
});

describe('partRows', () => {
	it('puts the leden that go to one place in one row', () => {
		expect(partRows(newSv.parts)).toEqual([
			{ old: 'leden 1, 2 en 3', place: '2.8.6, 1' },
			{ old: 'lid 4', place: '2.8.6, 2' }
		]);
	});

	it('has no rows for a whole article that goes to one place', () => {
		expect(partRows([{ old_part: '', new_place: '2.1.10' }])).toEqual([]);
	});
});

describe('successionSources', () => {
	it('names each table once', () => {
		expect(successionSources([newSv, newSv])).toEqual([
			'https://zoek.officielebekendmakingen.nl/blg-1081574.html'
		]);
	});
});

describe('lidPairings', () => {
	it('takes the leden the table places together as one pairing', () => {
		expect(lidPairings(newSv.parts, '2.8.6')).toEqual([
			{ old: ['1', '2', '3'], new: ['1'] },
			{ old: ['4'], new: ['2'] }
		]);
	});

	it('leaves out a part placed in another article, a whole article and an onderdeel', () => {
		const parts = [
			{ old_part: '1', new_place: '2.8.7, 1', new_article: '2.8.7', new_leden: ['1'] },
			{ old_part: '', new_place: '2.8.6', new_article: '2.8.6', new_leden: [] },
			{ old_part: '2 a', new_place: '2.8.6, 3', new_article: '2.8.6', new_leden: ['3'] }
		];
		expect(lidPairings(parts, '2.8.6')).toEqual([]);
	});
});

describe('compareTarget', () => {
	it('reads the old article on the left and the new on the right, whichever is on screen', () => {
		const onOld = compareTarget('articles/stb_2026_56_2_8_6', [newSv], [], '126ffa');
		expect(onOld).toMatchObject({
			direction: 'new',
			law: 'STB-2026-56',
			number: '2.8.6',
			pairings: [
				{ old: ['1', '2', '3'], new: ['1'] },
				{ old: ['4'], new: ['2'] }
			]
		});
		const onNew = compareTarget('articles/bwbr0001903_126ffa', [], [oldSv], '2.8.6');
		expect(onNew).toMatchObject({ direction: 'old', law: 'BWBR0001903', number: '126ffa' });
		expect(onNew?.pairings).toHaveLength(2);
	});

	it('finds the law of an article without an address by its law, its address or its key', () => {
		const bare = {
			...newSv,
			article: {
				...newSv.article,
				path: null,
				instrument: { ...newSv.article.instrument!, path: null }
			}
		};
		expect(compareTarget(bare.article.id, [bare], [], '126ffa')?.law).toBe('STB-2026-56');
	});

	it("is null for an article the source does not pair with this one: the reader's own choice", () => {
		expect(compareTarget('articles/bwbr0001854_287', [newSv], [], '126ffa')).toBeNull();
	});
});

describe('ownSuccessionName', () => {
	it('names the new article under the old title as the line names it', () => {
		const own = { citationTitle: 'Wetboek van Strafvordering', shortTitle: null };
		expect(ownSuccessionName(oldSv, own, '2.8.6', 'old')).toBe('art. 2.8.6 Sv (nieuw)');
		expect(ownSuccessionName(newSv, sv, '126ffa', 'new')).toBeNull();
	});
});

describe('outcomesOf (lawgraph #860)', () => {
	const wtw = { citationTitle: 'Waterwet', shortTitle: null };

	it('reads what became of the old article, per new law', () => {
		const [o] = outcomesOf(outcomeNode({ outcome: 'niet_overgenomen', parts: [] }), wtw);
		expect(o.law).toEqual({ id: 'instruments/bwbr0037885', name: 'Omgevingswet' });
		expect(o.reading.outcome).toEqual({ kind: 'niet_overgenomen', law: null });
		expect(successionSources([], [o])).toEqual([
			'https://zoek.officielebekendmakingen.nl/kst-34986-3.html'
		]);
	});

	it('names a new code under the old title as new', () => {
		const node = outcomeNode(
			{ outcome: 'vervallen' },
			{ key: 'wet_stb_2026_56', citation_title: 'Wetboek van Strafvordering' }
		);
		expect(outcomesOf(node, sv)[0].law.name).toBe('Sv (nieuw)');
	});

	it('has none without the edges (an API before #860)', () => {
		expect(outcomesOf(null, sv)).toEqual([]);
		expect(outcomesOf({ neighbors: { buckets: [] } } as never, sv)).toEqual([]);
	});

	it('puts a part with an outcome of its own in the fold-out, and a gap as the table writes it', () => {
		const outcomes = outcomesOf(
			outcomeNode({
				outcome: 'gat',
				parts: [
					{ from: '1', to: 'vervallen (mvt)', outcome: 'vervallen' },
					{ from: '2', to: 'Besluit B2', outcome: 'gat' },
					{ from: '3', to: 'Besluit B2', outcome: 'gat' },
					{ from: '4', to: 'Blijft in Waterwet', outcome: 'blijft_in:Waterwet' },
					{ from: '5', to: 'later', outcome: 'naar:Gratiewet' }
				]
			}),
			sv
		);
		expect(partRows(outcomeParts(outcomes))).toEqual([
			{ old: 'lid 1', place: 'vervallen' },
			{ old: 'leden 2 en 3', place: 'Besluit B2' },
			{
				old: 'lid 4',
				place: 'blijft in Waterwet',
				law: { word: 'blijft in', name: 'Waterwet' }
			},
			{ old: 'lid 5', place: 'naar Gratiewet', law: { word: 'naar', name: 'Gratiewet' } }
		]);
	});

	it('leaves out of the fold-out a part whose outcome the line says', () => {
		const outcomes = outcomesOf(
			outcomeNode({
				outcome: 'vervallen',
				parts: [
					{ from: '1', to: 'vervalllen', outcome: 'vervallen' },
					{ from: '2', to: 'vervallen', outcome: 'vervallen' }
				]
			}),
			sv
		);
		expect(outcomeParts(outcomes, { inLine: true })).toEqual([]);
		expect(partRows(outcomeParts(outcomes))).toEqual([{ old: 'leden 1 en 2', place: 'vervallen' }]);
	});

	it('keeps a whole article in the fold-out where the line names another place', () => {
		const parts = [{ old_part: '', new_place: 'blijft in WEC' }];
		expect(partRows(parts)).toEqual([]);
		expect(partRows(parts, { whole: true })).toEqual([
			{ old: 'het artikel', place: 'blijft in WEC' }
		]);
	});

	it('finds the page of the table by its identifier', () => {
		expect(sourceUrl('kst-34986-3')).toBe(
			'https://zoek.officielebekendmakingen.nl/kst-34986-3.html'
		);
		expect(sourceUrl('32017R1001')).toBe(
			'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32017R1001'
		);
	});
});
