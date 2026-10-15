import { describe, expect, it } from 'vitest';
import {
	articleLabel,
	byArticle,
	sharedEnactment,
	stageLead,
	zonderArtikelen,
	type DossierChange
} from './changed-articles';

const change = (nr: string, stage: DossierChange['stage'], source: string): DossierChange => ({
	article: {
		display_name: null,
		id: `articles/bwbr0001854_${nr}`,
		key: `bwbr0001854_${nr}`,
		article_number: nr,
		stub: false,
		judgment_total: 0
	},
	relation: 'amends',
	stage,
	effective_date: null,
	source: {
		key: null,
		display_name: null,
		official_id: null,
		kind: null,
		sequence: null,
		number: null,
		id: source
	}
});

describe('changed articles', () => {
	it('lists each article once, with its changes in order', () => {
		const rows = byArticle([
			change('10', 'proposed', 'documents/a'),
			change('22', 'proposed', 'documents/a'),
			change('10', 'enacted', 'instruments/stb_2026_1')
		]);
		expect(rows.map((r) => [r.article.article_number, r.changes.length])).toEqual([
			['10', 2],
			['22', 1]
		]);
	});

	it('names an article as cited in its law, a BW article with its book', () => {
		expect(
			articleLabel(
				{ celex: null, display_name: null, id: 'x', bwb_id: 'BWBR0001854' },
				{
					id: 'a',
					key: 'k',
					article_number: '21b',
					display_name: null,
					stub: false,
					judgment_total: 0
				}
			)
		).toBe('Artikel 21b');
		expect(
			articleLabel(
				{ celex: null, display_name: null, id: 'x', bwb_id: 'BWBR0005289' },
				{
					id: 'a',
					key: 'k',
					article_number: '162',
					display_name: null,
					stub: false,
					judgment_total: 0
				}
			)
		).toBe('Artikel 6:162');
	});

	it('says the way of a change, with its own spaces', () => {
		expect(stageLead({ ...change('1', 'enacted', 's'), effective_date: '2026-09-01' })).toBe(
			'in werking sinds 1 september 2026, '
		);
		expect(stageLead(change('1', 'proposed', 'd'))).toBe('voorgesteld in ');
	});

	it('says a shared publication once, and only when every change shares it', () => {
		const a = {
			...change('1', 'enacted', 'instruments/stb_2026_154'),
			effective_date: '2026-09-01'
		};
		const law = {
			law: { id: 'x', bwb_id: null, celex: null, display_name: null },
			total: 2,
			changes: [a, { ...a, article: change('2', 'enacted', 'y').article }]
		};
		expect(sharedEnactment(law)?.source.id).toBe('instruments/stb_2026_154');
		expect(sharedEnactment({ ...law, changes: [a, change('3', 'proposed', 'd')] })).toBeNull();
	});
});

describe('zonderArtikelen', () => {
	it('names the laws the dossier changes that hold no changed article', () => {
		const data = {
			number: '36496',
			total: 2,
			articles: 2,
			enacted: 2,
			proposed: 0,
			laws: [
				{
					law: {
						id: 'instruments/bwbr0005290',
						bwb_id: 'BWBR0005290',
						celex: null,
						display_name: null
					},
					total: 2,
					changes: []
				}
			]
		};
		const wijzigt = [
			{
				key: 'bwbr0005290',
				name: 'Burgerlijk Wetboek Boek 7',
				bwb_id: 'BWBR0005290',
				short: null,
				celex: null,
				basis: []
			},
			{
				key: 'bwbr0045775',
				name: 'Wet goed verhuurderschap',
				bwb_id: 'BWBR0045775',
				short: null,
				celex: null,
				basis: []
			}
		];
		expect(zonderArtikelen(data, wijzigt).map((w) => w.name)).toEqual(['Wet goed verhuurderschap']);
		expect(zonderArtikelen(data, [])).toEqual([]);
	});
});
