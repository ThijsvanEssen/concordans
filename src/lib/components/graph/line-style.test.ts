import { readFileSync } from 'node:fs';
// The style of a line by its relation (Netwerkcanvas, Lijnen): the stroke gives the family, the
// tone the kind within it, also in grey.
import { describe, expect, it } from 'vitest';
import { LINE_KINDS, LINE_KIND_STYLE, hasArrow, lineKindOf } from '$lib/graph/line-kind';
import { edgeCapFor, edgeDashFor, edgeStyleFor, edgeToneFor } from './nodeSprites';

describe('edgeStyleFor', () => {
	it('draws the law itself solid: Structureel, a citation by an article, a Wijziging', () => {
		expect(edgeStyleFor('BASED_ON', null)).toBe('solid');
		expect(edgeStyleFor('REFERS_TO', null, 'article')).toBe('solid');
		expect(edgeStyleFor('AMENDS', 'vastgesteld')).toBe('solid');
		expect(edgeStyleFor('AMENDS', 'voorgesteld')).toBe('solid');
	});
	it('draws what names the law dashed: short for an Aanhaling, long for a Toelichting', () => {
		expect(edgeStyleFor('REFERS_TO', null, 'judgment')).toBe('kort');
		expect(edgeStyleFor('REFERS_TO', null, 'document')).toBe('kort');
		expect(edgeStyleFor('APPEAL_OF', null)).toBe('kort');
		expect(edgeStyleFor('ADVISES_ON', null)).toBe('kort');
		expect(edgeStyleFor('EXPLAINS', null)).toBe('lang');
	});
	it('draws what belongs to it in round dots: Deel van, Lid van, Ingediend door', () => {
		expect(edgeStyleFor('PART_OF', null)).toBe('punten');
		expect(edgeStyleFor('MEMBER_OF', null)).toBe('punten');
		expect(edgeStyleFor('AUTHORED', null)).toBe('puntenIndiener');
	});
	it('draws no arrow in the family hoort bij', () => {
		for (const s of ['punten', 'puntenIndiener'] as const) expect(hasArrow(s), s).toBe(false);
		for (const s of ['solid', 'kort', 'lang'] as const) expect(hasArrow(s), s).toBe(true);
	});
});

describe('edgeToneFor', () => {
	it('gives each kind of a family its own tone', () => {
		expect(edgeToneFor('AMENDS', 'vastgesteld')).toBe('donker');
		expect(edgeToneFor('BASED_ON', null)).toBe('middel');
		expect(edgeToneFor('EXPLAINS', null)).toBe('donker');
		expect(edgeToneFor('REFERS_TO', null, 'judgment')).toBe('licht');
		expect(edgeToneFor('PART_OF', null)).toBe('middel');
		expect(edgeToneFor('AUTHORED', null)).toBe('donker');
		expect(edgeToneFor('MEMBER_OF', null)).toBe('licht');
	});
	it('draws a Wijziging that is only proposed light, in the stroke of its family', () => {
		expect(edgeToneFor('AMENDS', 'voorgesteld')).toBe('licht');
		expect(edgeToneFor('ESTABLISHES', 'voorgesteld')).toBe('donker');
	});
	it('separates the kinds of one family by tone, and the families by stroke', () => {
		const strokes = LINE_KINDS.map(
			(k) => `${LINE_KIND_STYLE[k].stroke}|${LINE_KIND_STYLE[k].tone}`
		);
		expect(new Set(strokes).size, 'no two kinds look alike').toBe(strokes.length);
		// Deel van and Lid van share the dots, and differ in colour and tone.
		const [a, b] = [LINE_KIND_STYLE.part, LINE_KIND_STYLE.member];
		expect(a.stroke).toBe(b.stroke);
		expect(a.tone).not.toBe(b.tone);
		expect(lineKindOf('PART_OF')).toBe('part');
	});
});

describe('the strokes', () => {
	it('gives every broken stroke its own dash, round only for dots', () => {
		const strepen = (['kort', 'lang', 'punten', 'puntenIndiener'] as const).map(edgeDashFor);
		expect(new Set(strepen).size).toBe(4);
		expect(edgeDashFor('solid')).toBeUndefined();
		expect(edgeCapFor('punten')).toBe('round');
		expect(edgeCapFor('kort')).toBe('butt');
		expect(edgeCapFor('lang')).toBe('butt');
	});
});

describe('a thread (Netwerkcanvas, Maten)', () => {
	it('has a program without an arrow for every style with one (WebGL: read, not run)', () => {
		const source = readFileSync(new URL('./DashedEdgeProgram.ts', import.meta.url), 'utf8');
		for (const style of ['arrow', 'kort', 'lang'])
			expect(source, style).toMatch(new RegExp(`${style}Draad:`));
	});
});
