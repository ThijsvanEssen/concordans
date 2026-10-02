import { describe, expect, it } from 'vitest';
import {
	articleLabel,
	byArticle,
	sharedEnactment,
	stageLead,
	summary,
	type DossierChange
} from './changed-articles';

const change = (nr: string, stage: DossierChange['stage'], source: string): DossierChange => ({
	article: { id: `articles/bwbr0001854_${nr}`, key: `bwbr0001854_${nr}`, article_number: nr },
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
			articleLabel({ id: 'x', bwb_id: 'BWBR0001854' }, { id: 'a', key: 'k', article_number: '21b' })
		).toBe('Artikel 21b');
		expect(
			articleLabel({ id: 'x', bwb_id: 'BWBR0005289' }, { id: 'a', key: 'k', article_number: '162' })
		).toBe('Artikel 6:162');
	});

	it('sums up without the counts that are zero', () => {
		const d = {
			number: '36264',
			total: 24,
			articles: 24,
			enacted: 24,
			proposed: 0,
			laws: [{ law: { id: 'x' }, total: 24, changes: [] }]
		};
		expect(summary(d)).toBe('24 artikelen in 1 wet. 24 wijzigingen in werking.');
		expect(summary({ ...d, articles: 8, enacted: 5, proposed: 12 })).toBe(
			'8 artikelen in 1 wet. 5 wijzigingen in werking, 12 wijzigingen voorgesteld.'
		);
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
