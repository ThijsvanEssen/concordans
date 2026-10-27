import { describe, expect, it } from 'vitest';
import type { Group } from '$lib/verbonden/groups';
import type { Row } from '$lib/verbonden/rows';
import { panelKinds } from '$lib/verbonden/view';
import type { Collection } from '$lib/vocabulary';
import { kindRows, kindRowCount, lightBuckets, kindFocus, type DrawnBron } from './kind-rows';

const FILTER_OF: Partial<Record<Collection, Row['filterGroup']>> = {
	judgments: 'uitspraken',
	members: 'kamerleden',
	decisions: 'stemmingen',
	articles: 'artikelen'
};
const row = (collection: Collection, key: string, over: Partial<Row> = {}): Row => ({
	ref: { collection, key } as Row['ref'],
	title: key,
	context: null,
	filterGroup: FILTER_OF[collection] ?? 'dossiers',
	...over
});
const group = (over: Partial<Group>): Group => ({
	id: 'x',
	label: 'X',
	rows: [],
	capped: false,
	...over
});
const bron = (collection: Collection, key: string, over: Partial<DrawnBron> = {}): DrawnBron => ({
	id: `${collection}/${key}`,
	collection,
	key,
	filterGroup: FILTER_OF[collection] ?? 'dossiers',
	...over
});
type Bucket = { collection: string; total: number; kept: number };

// A dossier as on prod (36410): its stukken, its stemmingen, its toezeggingen.
const dossier: Group[] = [
	group({
		id: 'documents-tk',
		label: 'Kamerstukken in de Tweede Kamer',
		rows: [row('documents', 'd1'), row('documents', 'd2')],
		total: 146
	}),
	group({
		id: 'decisions',
		label: 'Stemmingen in de Tweede Kamer',
		rows: [row('decisions', 's1'), row('decisions', 's2')]
	}),
	group({
		id: 'commitments',
		label: 'Toezeggingen over dit dossier',
		rows: [row('commitments', 't1')],
		total: 10
	})
];
const kinds = panelKinds({ groups: dossier }, 'dossiers');
const rows = (drawn: DrawnBron[], buckets: Bucket[] = []) =>
	kindRows({
		focus: { collection: 'dossiers', key: '36410' },
		kinds,
		groups: dossier,
		drawn,
		buckets
	});

describe('Soort reads Verbonden (N1)', () => {
	it('names the soorten of Verbonden with its words and its counts, drawn of the whole', () => {
		const r = rows([bron('documents', 'd1'), bron('documents', 'd9'), bron('decisions', 's1')]);
		// Every soort of Verbonden, drawn or not, by its label and its count.
		expect(r.map((x) => x.label)).toEqual(kinds.map((k) => k.label));
		expect(r.map((x) => x.total ?? x.drawn)).toEqual(kinds.map((k) => k.count));
		expect(r.map((x) => kindRowCount(x, true))).toEqual(['2 van 146', '1 van 2', '0 van 10']);
	});

	it('counts a bron Verbonden does not count apart, past the count of its soort', () => {
		// Two stemmingen in Verbonden, three drawn: the third is none Verbonden counts.
		const r = rows([bron('decisions', 's1'), bron('decisions', 's2'), bron('decisions', 'ek1')]);
		expect(r.find((x) => x.id === 'decisions')).toMatchObject({ drawn: 2, total: null });
		expect(r.find((x) => x.id === 'overig:decisions')).toMatchObject({
			label: 'Overige stemmingen',
			drawn: 1,
			total: null
		});
	});

	it('names a soort Verbonden has not by its word, of the whole the API counts (N2)', () => {
		const r = rows([bron('members', 'm1')], [{ collection: 'members', total: 29, kept: 1 }]);
		expect(r.at(-1)).toMatchObject({ label: 'Kamerleden', drawn: 1, total: 29, load: 'members' });
	});

	it('puts what lies one step further under a heading of its own', () => {
		const r = rows([bron('judgments', 'j1', { direct: false })]);
		expect(r.at(-1)).toMatchObject({ label: 'Uitspraken', drawn: 1, further: true });
		expect(r.find((x) => x.id === 'judgments')).toBeUndefined();
	});

	it("names the bron's own content apart: a law's articles, a faction's members ooit (N13)", () => {
		const law = [
			group({
				id: 'articles',
				label: 'Artikelen van deze wet',
				rows: [row('articles', 'bwbr0005416_1')],
				total: 326
			})
		];
		const r = kindRows({
			focus: { collection: 'instruments', key: 'bwbr0005416' },
			kinds: panelKinds({ groups: law }, 'instruments'),
			groups: law,
			drawn: [bron('articles', 'bwbr0005416_1'), bron('articles', 'bwbr0005416_146')],
			buckets: [{ collection: 'articles', total: 448, kept: 241 }]
		});
		expect(r).toMatchObject([
			{ label: 'Artikelen van deze wet', drawn: 2, total: 326, load: 'articles' }
		]);
		const faction = [
			group({
				id: 'members',
				label: 'Leden van deze fractie',
				rows: [row('members', 'a')],
				total: 175
			})
		];
		const members = kindRows({
			focus: { collection: 'factions', key: 'vvd' },
			kinds: panelKinds({ groups: faction }, 'factions'),
			groups: faction,
			drawn: [bron('members', 'a'), bron('members', 'b')]
		});
		expect(members).toMatchObject([{ label: 'Leden ooit', drawn: 2, total: 175 }]);
	});

	it('misses no "van" where there are more than are drawn (N2)', () => {
		const r = rows(
			[bron('documents', 'd1'), bron('activities', 'a1')],
			[
				{ collection: 'documents', total: 146, kept: 1 },
				{ collection: 'activities', total: 72, kept: 1 }
			]
		);
		for (const x of r)
			if ((x.total ?? x.drawn) > x.drawn) expect(kindRowCount(x, true)).toMatch(/ van /);
		expect(r.find((x) => x.label === 'Activiteiten')).toMatchObject({ drawn: 1, total: 72 });
	});

	it('says the whole of a kind switched off', () => {
		const [papers] = rows([]);
		expect(kindRowCount(papers, false)).toBe('146');
	});
});

describe('the bron Soort reads Verbonden of', () => {
	const base = { netwerkActive: false, extern: false, panelId: 'factions/vvd' };
	it('the one bron of Omgeving, with or without its neighbourhood', () => {
		expect(kindFocus({ ...base, reach: { focal: 'factions/vvd' } })).toEqual({
			id: 'factions/vvd',
			own: true
		});
		expect(kindFocus({ ...base, reach: null })).toEqual({ id: 'factions/vvd', own: true });
	});
	it('waits for Verbonden of that bron', () => {
		expect(kindFocus({ ...base, panelId: null, reach: { focal: 'factions/vvd' } })).toEqual({
			id: 'factions/vvd',
			own: false
		});
		expect(kindFocus({ ...base, reach: { focal: 'factions/d66' } })).toEqual({
			id: 'factions/d66',
			own: false
		});
	});
	it('none for a netwerk or a weergave of its own', () => {
		expect(kindFocus({ ...base, netwerkActive: true, reach: null })).toBeNull();
		expect(kindFocus({ ...base, extern: true, reach: null })).toBeNull();
	});
});

describe('lightBuckets', () => {
	it('sums the light node per collection, with nothing to load from it', () => {
		const b = lightBuckets(
			new Map([
				['VOTED/decisions/inbound', 63600],
				['MEMBER_OF/members/inbound', 175]
			])
		);
		expect(b).toEqual([
			{ collection: 'decisions', total: 63600, kept: 63600 },
			{ collection: 'members', total: 175, kept: 175 }
		]);
	});
});
