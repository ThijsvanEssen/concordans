import { describe, expect, it } from 'vitest';
import { fail, fakeApi } from '$lib/test/fakeApi';
import {
	articleLabel,
	getChangedArticles,
	byArticle,
	sharedEnactment,
	stageLead,
	zonderArtikelen,
	type DossierChange
} from './changed-articles';

const change = (nr: string, stage: DossierChange['stage'], source: string): DossierChange => ({
	article: {
		id: `articles/bwbr0001854_${nr}`,
		key: `bwbr0001854_${nr}`,
		article_number: nr,
		stub: false,
		judgment_total: 0
	},
	relation: 'amends',
	stage,
	source: { id: source }
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
				{ id: 'x', bwb_id: 'BWBR0001854' },
				{ id: 'a', key: 'k', article_number: '21b', stub: false, judgment_total: 0 }
			)
		).toBe('Artikel 21b');
		expect(
			articleLabel(
				{ id: 'x', bwb_id: 'BWBR0005289' },
				{ id: 'a', key: 'k', article_number: '162', stub: false, judgment_total: 0 }
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
			law: { id: 'x' },
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
				{ law: { id: 'instruments/bwbr0005290', bwb_id: 'BWBR0005290' }, total: 2, changes: [] }
			]
		};
		const wijzigt = [
			{ key: 'bwbr0005290', name: 'Burgerlijk Wetboek Boek 7', bwb_id: 'BWBR0005290' },
			{ key: 'bwbr0045775', name: 'Wet goed verhuurderschap', bwb_id: 'BWBR0045775' }
		];
		expect(zonderArtikelen(data, wijzigt).map((w) => w.name)).toEqual(['Wet goed verhuurderschap']);
		expect(zonderArtikelen(data, [])).toEqual([]);
	});
});

describe('getChangedArticles', () => {
	const path = '/api/dossiers/{number}/changed-articles';

	it('gives null where the API has no changes for the dossier (404)', async () => {
		fakeApi({ [path]: fail(404) });
		expect(await getChangedArticles('36327')).toBeNull();
	});

	it('throws the API error with its status on a failure', async () => {
		fakeApi({ [path]: fail(500) });
		await expect(getChangedArticles('36327')).rejects.toMatchObject({ status: 500 });
	});
});
