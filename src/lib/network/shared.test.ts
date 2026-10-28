import { describe, expect, it } from 'vitest';
import { verbandModel, sentence, rowNotation } from './shared';

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
		const vier = verbandModel([evaluatie], direct, names);
		const vijf = verbandModel([evaluatie, motie], direct, names);
		expect(vier.rows.map((r) => r.id)).toEqual(['documents/evaluatie']);
		expect(vijf.rows.map((r) => r.id)).toEqual(['documents/evaluatie', 'documents/motie']);
		expect(vijf.judgments).toEqual([{ at: ['articles/a', 'members/d'], total: 3 }]);
	});

	it('gives the same Verband for the same bronnen in another order', () => {
		const een = verbandModel([motie, evaluatie], [], names);
		const twee = verbandModel([evaluatie, motie], [], names);
		expect(een.rows.map((r) => [r.id, r.at])).toEqual(twee.rows.map((r) => [r.id, r.at]));
		expect(een.judgments).toEqual(twee.judgments);
	});

	it('says the verbindingen between the chosen bronnen themselves, and what each pair shares in all', () => {
		const m = verbandModel([evaluatie], direct, names);
		expect(m.direct.map((d) => d.at)).toEqual([['factions/v', 'members/d']]);
		expect(m.direct[0].text).toMatch(/^Dilan Yeşilgöz .+ VVD$/);
		expect(m.direct[0]).toMatchObject({ from: 'members/d', to: 'factions/v' });
		expect(m.pairs).toEqual([{ at: ['articles/a', 'members/d'], total: 4 }]);
	});
});

describe('Verband as the DS writes it', () => {
	const paper = (props: Record<string, unknown>) =>
		({
			id: 'documents/x',
			key: 'x',
			collection: 'documents',
			type: 'document',
			display_name: 'Memorie van toelichting: Wijziging van de Gemeentewet en meer en nog…',
			labels: [],
			props,
			links: []
		}) as unknown as Parameters<typeof rowNotation>[0];

	it('names a Kamerstuk by its notation, its title and year under it, never cut off by the API', () => {
		const r = rowNotation(
			paper({
				dossier_number: '36545',
				sequence: 3,
				kind: 'Memorie van toelichting',
				title: 'Wijziging van de Gemeentewet',
				date: '2018-03-02'
			})
		);
		expect(r.title).toBe('36545, nr. 3 Memorie van toelichting');
		expect(r.detail).toBe('Wijziging van de Gemeentewet, 2018');
		expect(r.title).not.toContain('…');
	});
	it('names a dossier by its number, so that it is not the wet of the same name', () => {
		const r = rowNotation({
			id: 'dossiers/36496',
			collection: 'dossiers',
			display_name: 'Wet betaalbare huur',
			props: { number: '36496', short_title: 'Wet betaalbare huur' }
		} as unknown as Parameters<typeof rowNotation>[0]);
		expect(r.title).toBe('36496 Wet betaalbare huur');
	});
	it('keeps the name of any other bron', () => {
		expect(
			rowNotation({ ...paper({}), collection: 'instruments', id: 'instruments/a' }).detail
		).toBeNull();
	});
});
