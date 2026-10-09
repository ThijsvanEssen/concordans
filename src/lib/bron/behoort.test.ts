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
		expect(b.regels.map((r) => r.label)).toEqual(['Wet']);
		const wet = b.regels[0].lagen;
		expect(wet.map((l) => [l.soort, l.naam])).toEqual([
			['Wet', 'Algemene wet bestuursrecht'],
			['hoofdstuk', 'Hoofdstuk 3 Algemene bepalingen over besluiten'],
			['afdeling', 'Afdeling 3.2 Zorgvuldigheid en belangenafweging']
		]);
		expect(wet.map((l) => l.at)).toEqual([
			undefined,
			'deel-hoofdstuk-3',
			'deel-hoofdstuk-3-afdeling-3.2'
		]);
		expect(wet[2].ref).toEqual({ collection: 'instruments', key: 'bwbr0005537' });
	});

	it('gives a judgment its procesgang and its conclusie as kern, more appeals as a group', () => {
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
							display_name: 'Gerechtshof Den Haag, 9 oktober 2018 (Urgenda)'
						}
					]
				},
				{
					relation: 'APPEAL_OF',
					direction: 'inbound',
					collection: 'judgments',
					total: 2,
					items: [
						{
							key: 'ecli_nl_hr_2020_1',
							collection: 'judgments',
							display_name: 'Hoge Raad, 3 maart 2020'
						}
					]
				},
				{
					relation: 'ADVISES_ON',
					direction: 'inbound',
					collection: 'judgments',
					total: 1,
					items: [{ key: 'ecli_nl_phr_2019_887', collection: 'judgments', display_name: 'PHR' }]
				}
			])
		);
		expect(b.regels.map((r) => r.label)).toEqual(['Procesgang', 'Conclusie']);
		expect(b.regels[0].lagen.map((l) => [l.soort, !!l.huidig])).toEqual([
			['Eerdere aanleg', false],
			['Deze uitspraak', true],
			['Hoger beroep of cassatie', false]
		]);
		expect(b.regels[0].laad).toBeTypeOf('function');
		expect(b.regels[0].lagen.map((l) => l.kort)).toEqual(['Hof Den Haag 2018', 'deze', 'HR 2020']);
		expect(b.naast).toEqual([]);
		expect(b.onder.map((g) => [g.label, g.aantal])).toEqual([['Hoger beroep of cassatie', 2]]);
		const conclusie = behoort(
			'judgments',
			{},
			light([
				{
					relation: 'ADVISES_ON',
					direction: 'outbound',
					collection: 'judgments',
					total: 1,
					items: [{ key: 'ecli_nl_hr_2019_2006', collection: 'judgments', display_name: 'HR' }]
				}
			])
		);
		expect(conclusie.regels.map((r) => r.label)).toEqual(['Conclusie bij']);
	});

	it('puts a stuk in its dossier, a lid in its one fractie, and leaves out what is missing', () => {
		const stuk = behoort(
			'documents',
			{ kind: 'Motie' },
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
		expect(stuk.regels.map((r) => r.label)).toEqual(['Ingediend bij']);
		expect(stuk.regels[0].lagen[0].naam).toBe('36496 Wet betaalbare huur');
		expect(stuk.regels[0].lagen[0].ref).toEqual({
			collection: 'dossiers',
			key: '36496',
			number: '36496'
		});
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
		expect(lid.regels.map((r) => r.label)).toEqual(['Fractie']);
		// Commissies are context: in Verbonden, not in the band (Thijs, 9 Oct).
		expect(lid.naast).toEqual([]);
		expect(heeftIets(behoort('cabinets', {}, light([])))).toBe(false);
	});

	it('puts a paper of a bill with its wetsvoorstel, and the rest of its zaak in Verbonden only', () => {
		const metZaak = (kind: string) =>
			behoort('documents', { kind }, {
				...(light([
					{ relation: 'PART_OF', direction: 'outbound', collection: 'cases', total: 1 }
				]) as object),
				node: { key: 'mvt' }
			} as never);
		const mvt = metZaak('Memorie van toelichting (initiatiefvoorstel)');
		expect(mvt.regels.map((r) => [r.id, r.label, r.lagen.length, !!r.laad])).toEqual([
			['wetsvoorstel', 'Bij wetsvoorstel', 0, true]
		]);
		// The rest of the zaak is context: in Verbonden, not in the band (Thijs, 9 Oct).
		expect(mvt.naast).toEqual([]);
		// A geleidende brief offers the substance of its zaak: kern, side by side.
		expect(metZaak('Geleidende brief').regels.map((r) => [r.id, r.label, r.los, !!r.laad])).toEqual(
			[['biedt-aan', 'Biedt aan', true, true]]
		);
		// A motie is no paper of the bill: no line.
		expect(metZaak('Motie').regels).toEqual([]);
		expect(metZaak('Motie').naast).toEqual([]);
		// Without a zaak, nothing: no line waits, no empty group.
		const zonder = behoort('documents', { kind: 'Nota van wijziging' }, {
			...(light([]) as object),
			node: { key: 'x' }
		} as never);
		expect([zonder.regels, zonder.naast]).toEqual([[], []]);
	});
});

describe('kern of context', () => {
	it('leaves the kern out of Verbonden, and only the kern', async () => {
		const { GROUPS } = await import('$lib/verbonden/groups');
		const { isKernGroep } = await import('./behoort');
		const kern = (c: keyof typeof GROUPS) =>
			(GROUPS[c] ?? []).filter((g) => isKernGroep(c, g)).map((g) => g.id);
		expect(kern('judgments')).toEqual([
			'conclusion',
			'advised',
			'earlier-instance',
			'later-instance'
		]);
		expect(kern('articles')).toEqual(['law']);
		expect(kern('documents')).toEqual(['dossier']);
		expect(kern('members')).toEqual(['factions']);
		expect(kern('instruments')).toEqual([]);
	});

	it('puts an eerdere aanleg the data lacks in the procesgang, as text', () => {
		const b = behoort(
			'judgments',
			{
				unresolved_appeal_targets: [
					{ court: 'rechtbank Gelderland', date: '2025-07-09', case_number: '24/6811' }
				]
			},
			light([])
		);
		expect(b.regels[0].label).toBe('Procesgang');
		expect(b.regels[0].lagen[0]).toMatchObject({
			naam: 'Rechtbank Gelderland, 9 juli 2025, 24/6811',
			kort: 'Rb. Gelderland 2025'
		});
		expect(b.regels[0].lagen[0].ref).toBeUndefined();
	});
});

describe('a translation and a dossier', () => {
	it('names the original of a translation, its procesgang to follow', () => {
		const b = behoort('judgments', { translation_of: 'ECLI:NL:HR:2019:2006' }, light([]));
		expect(b.regels.map((r) => [r.id, r.label, r.lagen.length, !!r.laad])).toEqual([
			['vertaling', 'Vertaling van', 1, true],
			['procesgang', 'Procesgang', 0, true]
		]);
		expect(b.regels[0].lagen[0].ref).toEqual({
			collection: 'judgments',
			key: 'ecli_nl_hr_2019_2006'
		});
	});

	it('reads the Kamer of a dossier from its label where props lack it', () => {
		const l = { node: { labels: ['TK'] }, neighbors: { total: 0, buckets: [] } } as never;
		const regels = behoort('dossiers', {}, l).regels;
		expect(regels.map((r) => [r.label, r.lagen[0]?.naam ?? null, !!r.laad])).toEqual([
			['Behandeld in', 'Tweede Kamer', false],
			// What the bill amends and implements comes with the detail (legal_effect, 0.79.30).
			['Wijzigt', null, true],
			['Implementeert', null, true]
		]);
	});
});
