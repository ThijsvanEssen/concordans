// Every line the canvas draws stands under a row of Relatie (Netwerkcanvas, Lijnen).
import { describe, expect, it } from 'vitest';
import { RELATIONS } from '$lib/vocabulary';
import { edgeColorFor, edgeStyleFor } from '$lib/components/graph/nodeSprites';
import { isDrawn } from './collection-role';
import { LIJNSOORTEN, LIJNSOORT_VOORBEELD, lijnsoortOf } from './lijnsoort';
import type { DrawClass } from './types';

const KINDS: DrawClass[] = ['article', 'judgment', 'document', 'member'];

describe('lijnsoorten', () => {
	it('give every drawn relation, from every kind, a soort with a row', () => {
		for (const r of RELATIONS)
			for (const from of KINDS) expect(LIJNSOORTEN, `${r} ${from}`).toContain(lijnsoortOf(r, from));
	});
	it('hold the nine relations the DS names', () => {
		expect(lijnsoortOf('COMMENCES')).toBe('wijziging');
		expect(lijnsoortOf('REVISES')).toBe('wijziging');
		expect(lijnsoortOf('TRANSPOSED_TO')).toBe('structureel');
		expect(lijnsoortOf('SECOND_READING_OF')).toBe('structureel');
		expect(lijnsoortOf('ABOUT')).toBe('deel');
		expect(lijnsoortOf('ACCOMPANIES')).toBe('deel');
		expect(lijnsoortOf('PUBLISHED_IN')).toBe('aanhaling');
		expect(lijnsoortOf('RELATED_TO')).toBe('aanhaling');
		expect(lijnsoortOf('VOTED')).toBe('lid');
	});
	it('read a citation by an article as Structureel, by anything else as Aanhaling', () => {
		expect(lijnsoortOf('REFERS_TO', 'article')).toBe('structureel');
		expect(lijnsoortOf('REFERS_TO', 'judgment')).toBe('aanhaling');
	});
	it('give a soort one style: every relation of it is drawn alike', () => {
		for (const r of RELATIONS.filter(isDrawn))
			for (const from of KINDS) {
				const soort = lijnsoortOf(r, from);
				const vb = LIJNSOORT_VOORBEELD[soort];
				expect(edgeColorFor(r, from), `${r} ${from}`).toBe(edgeColorFor(vb.relation, vb.from));
				expect(edgeStyleFor(r, null, from) === 'lid', `${r} ${from}`).toBe(soort === 'lid');
			}
	});
});
