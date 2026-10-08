import { describe, expect, it } from 'vitest';
import { behoort, heeftIets } from './behoort';

type Item = {
	key: string;
	collection: string;
	display_name: string;
	props?: Record<string, unknown>;
};
const light = (
	buckets: {
		relation: string;
		direction: string;
		collection: string;
		total: number;
		items?: Item[];
	}[]
) =>
	({
		node: {},
		neighbors: {
			total: 0,
			buckets: buckets.map((b) => ({
				...b,
				items: (b.items ?? []).map((i) => ({ ...i, relation: b.relation, direction: b.direction }))
			}))
		}
	}) as never;

describe('behoort', () => {
	it('puts an article under its law and the law’s division, the law itself not twice', () => {
		const b = behoort(
			'articles',
			{
				instrument_citation_title: 'Algemene wet bestuursrecht',
				breadcrumb: [
					{ type: 'hoofdstuk', label: 'Hoofdstuk 3', title: 'Algemene bepalingen over besluiten' },
					{ type: 'afdeling', label: 'Afdeling 3.2', title: 'Zorgvuldigheid en belangenafweging' }
				]
			},
			light([
				{
					relation: 'PART_OF',
					direction: 'outbound',
					collection: 'instruments',
					total: 1,
					items: [
						{
							key: 'bwbr0005537',
							collection: 'instruments',
							display_name: 'Algemene wet bestuursrecht'
						}
					]
				}
			])
		);
		expect(b.boven.map((l) => [l.soort, l.naam])).toEqual([
			['Wet', 'Algemene wet bestuursrecht'],
			['hoofdstuk', 'Hoofdstuk 3 Algemene bepalingen over besluiten'],
			['afdeling', 'Afdeling 3.2 Zorgvuldigheid en belangenafweging']
		]);
		expect(b.boven[2].ref).toEqual({ collection: 'instruments', key: 'bwbr0005537' });
	});

	it('names a judgment’s earlier instance, and the appeals against it as a group', () => {
		const b = behoort(
			'judgments',
			{},
			light([
				{
					relation: 'APPEAL_OF',
					direction: 'outbound',
					collection: 'judgments',
					total: 1,
					items: [
						{
							key: 'ecli_nl_ghdha_2018_2591',
							collection: 'judgments',
							display_name: 'Hof Den Haag 9 oktober 2018'
						}
					]
				},
				{ relation: 'APPEAL_OF', direction: 'inbound', collection: 'judgments', total: 2 },
				{ relation: 'ADVISES_ON', direction: 'inbound', collection: 'judgments', total: 1 }
			])
		);
		expect(b.boven.map((l) => l.soort)).toEqual(['Eerdere aanleg']);
		expect(b.naast.map((g) => [g.label, g.aantal])).toEqual([['Conclusie in dezelfde zaak', 1]]);
		expect(b.onder.map((g) => [g.label, g.aantal])).toEqual([
			['Hoger beroep of cassatie tegen deze uitspraak', 2]
		]);
	});

	it('puts a stuk in its dossier, a lid in its one fractie, and leaves out what is missing', () => {
		const stuk = behoort(
			'documents',
			{},
			light([
				{
					relation: 'PART_OF',
					direction: 'outbound',
					collection: 'dossiers',
					total: 1,
					items: [
						{
							key: '36496',
							collection: 'dossiers',
							display_name:
								'Kamerstukdossier 36496: Wijziging van de Wet goed verhuurderschap en enige andere wetten (Wet betaalbare huur)',
							props: { label: '36496' }
						}
					]
				}
			])
		);
		expect(stuk.boven.map((l) => l.soort)).toEqual(['Dossier']);
		expect(stuk.boven[0].naam).toBe('36496 Wet betaalbare huur');
		expect(stuk.boven[0].ref).toEqual({ collection: 'dossiers', key: '36496', number: '36496' });
		expect(stuk.onder).toEqual([]);
		const lid = behoort(
			'members',
			{},
			light([
				{
					relation: 'MEMBER_OF',
					direction: 'outbound',
					collection: 'factions',
					total: 1,
					items: [{ key: 'vvd', collection: 'factions', display_name: 'VVD' }]
				},
				{ relation: 'MEMBER_OF', direction: 'outbound', collection: 'committees', total: 4 }
			])
		);
		expect(lid.boven.map((l) => l.soort)).toEqual(['Fractie']);
		expect(lid.naast.map((g) => g.label)).toEqual(['Commissies']);
		expect(heeftIets(behoort('cabinets', {}, light([])))).toBe(false);
	});
});
