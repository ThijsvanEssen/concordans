// Every line the canvas draws stands under a row of Relatie (Netwerkcanvas, Lijnen).
import { describe, expect, it } from 'vitest';
import { RELATIONS } from '$lib/vocabulary';
import { edgeColorFor, edgeStyleFor } from '$lib/components/graph/nodeSprites';
import { isDrawn } from './collection-role';
import { LINE_KINDS, LINE_KIND_SAMPLE, lineKindOf } from './line-kind';
import type { DrawClass } from './types';

const KINDS: DrawClass[] = ['article', 'judgment', 'document', 'member'];

describe('lijnsoorten', () => {
	it('give every drawn relation, from every kind, a kind with a row', () => {
		for (const r of RELATIONS)
			for (const from of KINDS) expect(LINE_KINDS, `${r} ${from}`).toContain(lineKindOf(r, from));
	});
	it('hold the nine relations the DS names', () => {
		expect(lineKindOf('COMMENCES')).toBe('change');
		expect(lineKindOf('REVISES')).toBe('change');
		expect(lineKindOf('TRANSPOSED_TO')).toBe('structural');
		expect(lineKindOf('SECOND_READING_OF')).toBe('structural');
		expect(lineKindOf('ABOUT')).toBe('part');
		expect(lineKindOf('ACCOMPANIES')).toBe('part');
		expect(lineKindOf('PUBLISHED_IN')).toBe('citation');
		expect(lineKindOf('RELATED_TO')).toBe('citation');
		expect(lineKindOf('VOTED')).toBe('member');
	});
	it('read a citation by an article as Structureel, by anything else as Aanhaling', () => {
		expect(lineKindOf('REFERS_TO', 'article')).toBe('structural');
		expect(lineKindOf('REFERS_TO', 'judgment')).toBe('citation');
	});
	it('give a kind one style: every relation of it is drawn alike', () => {
		for (const r of RELATIONS.filter(isDrawn))
			for (const from of KINDS) {
				const kind = lineKindOf(r, from);
				const sample = LINE_KIND_SAMPLE[kind];
				expect(edgeColorFor(r, from), `${r} ${from}`).toBe(
					edgeColorFor(sample.relation, sample.from)
				);
				expect(edgeStyleFor(r, null, from) === 'lid', `${r} ${from}`).toBe(kind === 'member');
			}
	});
});
