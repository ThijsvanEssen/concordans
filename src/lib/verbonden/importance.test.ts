import { describe, expect, it } from 'vitest';
import { kindRank } from '$lib/text/document-kind';
import { importanceOf, byImportance } from './importance';
import type { Row } from './rows';

const rij = (key: string, props: Record<string, unknown>, date: string | null = null): Row => ({
	ref: { collection: 'documents', key },
	title: key,
	context: null,
	filterGroup: 'toelichtingen',
	date,
	props
});

describe('the most important rows first', () => {
	it('puts the most cited first, then the newest', () => {
		const rows = [
			rij('a', { inbound_citation_count: 2 }, '2024-01-01'),
			rij('b', { inbound_citation_count: 90 }),
			rij('c', { inbound_citation_count: 2 }, '2025-01-01')
		];
		expect(byImportance(rows, 'cited').map((r) => r.ref.key)).toEqual(['b', 'c', 'a']);
	});

	it('puts the stukken of the making of a law first, then the newest', () => {
		const rows = [
			rij('brief', { kind: 'Brief regering' }, '2026-01-01'),
			rij('motie', { kind: 'Motie' }, '2025-01-01'),
			rij('mvt', { kind: 'Memorie van toelichting' }, '2010-01-01'),
			rij('wet', { kind: 'Voorstel van wet' }, '2010-01-01')
		];
		expect(byImportance(rows, 'papers').map((r) => r.ref.key)).toEqual([
			'wet',
			'mvt',
			'motie',
			'brief'
		]);
		expect(kindRank('Nota naar aanleiding van het verslag')).toBeLessThan(kindRank('Verslag'));
	});

	it('leaves a group the API orders, or whose order says something, as it is', () => {
		expect(importanceOf('articles', 'judgments')).toBeNull();
		expect(importanceOf('articles', 'changes')).toBeNull();
		expect(importanceOf('articles', 'cited-by')).toBe('cited');
		expect(importanceOf('dossiers', 'documents-tk')).toBe('papers');
	});
});

describe('the other rules of the order', () => {
	const member = (key: string, period: Row['period'], edge?: Record<string, unknown>): Row => ({
		ref: { collection: 'members', key },
		title: key,
		context: null,
		filterGroup: 'leden',
		period,
		edge
	});

	it('puts the leden who sit now first, then the ones who left last', () => {
		const rows = [
			member('oud', { from: '1994-01-01', to: '1998-01-01', role: null }),
			member('nu-laat', { from: '2024-01-01', to: null, role: null }),
			member('recent', { from: '2010-01-01', to: '2021-01-01', role: null }),
			member('nu-vroeg', { from: '2002-01-01', to: null, role: null })
		];
		expect(byImportance(rows, 'current').map((r) => r.ref.key)).toEqual([
			'nu-laat',
			'nu-vroeg',
			'recent',
			'oud'
		]);
	});

	it('puts the bewindspersonen of a kabinet by their highest post', () => {
		const post = (p: string) => ({ posts: [{ post: p }] });
		const rows = [
			member(
				'staatssecretaris',
				{ from: '2022-01-10', to: null, role: null },
				post('staatssecretaris')
			),
			member('minister', { from: '2022-01-10', to: null, role: null }, post('minister')),
			member('mp', { from: '2022-01-10', to: null, role: null }, post('minister-president')),
			member('zonder-post', { from: '2022-01-10', to: null, role: null })
		];
		expect(byImportance(rows, 'office').map((r) => r.ref.key)).toEqual([
			'mp',
			'minister',
			'staatssecretaris',
			'zonder-post'
		]);
	});

	it('puts a wetsvoorstel before the verslag on a wetsvoorstel (initiatief)', () => {
		expect(kindRank('Voorstel van wet')).toBeLessThan(
			kindRank('Verslag (initiatief)wetsvoorstel (nader)')
		);
		expect(kindRank('Gewijzigd voorstel van wet')).toBe(kindRank('Voorstel van wet'));
	});
});
