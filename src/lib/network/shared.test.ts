import { describe, expect, it } from 'vitest';
import { verbandModel, sentence } from './shared';

const NAMES: Record<string, { name: string; collection: 'articles' | 'members' | 'factions' }> = {
	'articles/a': { name: 'Art. 126ffa Sv', collection: 'articles' },
	'members/d': { name: 'Dilan Yeşilgöz', collection: 'members' },
	'factions/v': { name: 'VVD', collection: 'factions' },
	'members/r': { name: 'Mark Rutte', collection: 'members' }
};
const names = (id: string) => NAMES[id] ?? { name: id, collection: null };

const neighbour = (id: string, collection: string, sources: string[]) => ({
	id,
	key: id.split('/')[1],
	collection,
	type: collection,
	display_name: id,
	labels: [],
	props: {},
	links: sources.map((source) => ({
		source,
		edge_id: `${source}-${id}`,
		relation: 'AUTHORED',
		direction: 'outbound',
		status: null,
		confidence: null
	}))
});
/** /api/nodes/shared of one pair: its shared bronnen of one kind, and its judgments counted. */
const pair = (ids: string[], shared: string[], judgments = 0) =>
	({
		ids,
		total: shared.length + judgments,
		buckets: [
			{
				collection: 'documents',
				type: 'document',
				total: shared.length,
				next_offset: null,
				items: shared.map((d) => neighbour(d, 'documents', ids))
			},
			{ collection: 'judgments', type: 'judgment', total: judgments, next_offset: null, items: [] }
		],
		facets: { collection: [], tier: [], subject_area: [] }
	}) as never;

describe('the weergave Verband', () => {
	it('says a verbinding of its object, a preposition kept with its verb', () => {
		expect(sentence('haalt aan', 'Art. 6:162 BW', 'naar')).toBe('Haalt Art. 6:162 BW aan');
		expect(sentence('verwijst naar', 'Art. 6:162 BW', 'naar')).toBe('Verwijst naar Art. 6:162 BW');
		expect(sentence('noemt', 'Art. 6:162 BW', 'van')).toBe('Art. 6:162 BW noemt deze bron');
	});

	const evaluatie = pair(['articles/a', 'members/d'], ['documents/evaluatie'], 3);
	const motie = pair(['members/d', 'members/r'], ['documents/motie']);
	const direct = [{ from: 'members/d', to: 'factions/v', relation: 'MEMBER_OF' as const }];

	it('keeps what a pair shares when a bron is added (Thijs, 23 Oct)', () => {
		const vier = verbandModel(
			['articles/a', 'members/d', 'factions/v'],
			[evaluatie],
			direct,
			names
		);
		const vijf = verbandModel(
			['articles/a', 'members/d', 'factions/v', 'members/r'],
			[evaluatie, motie],
			direct,
			names
		);
		expect(vier.rows.map((r) => r.id)).toEqual(['documents/evaluatie']);
		expect(vijf.rows.map((r) => r.id)).toEqual(['documents/evaluatie', 'documents/motie']);
		expect(vijf.judgments).toEqual([{ at: ['articles/a', 'members/d'], total: 3 }]);
	});

	it('gives the same Verband for the same bronnen in another order', () => {
		const een = verbandModel(
			['members/r', 'members/d', 'articles/a'],
			[motie, evaluatie],
			[],
			names
		);
		const twee = verbandModel(
			['articles/a', 'members/d', 'members/r'],
			[evaluatie, motie],
			[],
			names
		);
		expect(een.rows.map((r) => [r.id, r.at])).toEqual(twee.rows.map((r) => [r.id, r.at]));
		expect(een.judgments).toEqual(twee.judgments);
	});

	it('says the verbindingen between the chosen bronnen themselves, and names one without any', () => {
		const m = verbandModel(
			['articles/a', 'members/d', 'factions/v', 'members/r'],
			[evaluatie],
			direct,
			names
		);
		expect(m.direct.map((d) => d.at)).toEqual([['factions/v', 'members/d']]);
		expect(m.direct[0].text).toMatch(/^Dilan Yeşilgöz .+ VVD$/);
		expect(m.alone).toEqual(['members/r']);
	});
});
