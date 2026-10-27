// The style of a line by its relation (Netwerkcanvas, Lijnen): colour and stroke carry the kind of
// line together, also in grey.
import { describe, expect, it } from 'vitest';
import { edgeDashFor, edgeStyleFor } from './nodeSprites';

describe('edgeStyleFor', () => {
	it('draws Structureel solid, a citation of an article too', () => {
		expect(edgeStyleFor('BASED_ON', null)).toBe('solid');
		expect(edgeStyleFor('REFERS_TO', null, 'article')).toBe('solid');
	});
	it('draws an Aanhaling dashed: a citation by anything but an article, an appeal, an advice', () => {
		expect(edgeStyleFor('REFERS_TO', null, 'judgment')).toBe('dashed');
		expect(edgeStyleFor('REFERS_TO', null, 'document')).toBe('dashed');
		expect(edgeStyleFor('APPEAL_OF', null)).toBe('dashed');
		expect(edgeStyleFor('ADVISES_ON', null)).toBe('dashed');
	});
	it('draws Deel van dotted, Toelichting dash-dot, Lid van dotted without an arrow', () => {
		expect(edgeStyleFor('PART_OF', null)).toBe('dotted');
		expect(edgeStyleFor('VERSION_OF', null)).toBe('dotted');
		expect(edgeStyleFor('EXPLAINS', null)).toBe('dashdot');
		expect(edgeStyleFor('MEMBER_OF', null)).toBe('lid');
	});
	it('draws a Wijziging solid, dashed while it is only proposed', () => {
		expect(edgeStyleFor('AMENDS', 'vastgesteld')).toBe('solid');
		expect(edgeStyleFor('AMENDS', 'voorgesteld')).toBe('dashed');
	});
	it('draws Ingediend door solid with a dot at the submitter', () => {
		expect(edgeStyleFor('AUTHORED', null)).toBe('submitter');
		expect(edgeDashFor('submitter')).toBeUndefined();
	});
	it('gives every broken style its own stroke', () => {
		const strepen = (['dashed', 'dotted', 'dashdot'] as const).map(edgeDashFor);
		expect(new Set(strepen).size).toBe(3);
		expect(edgeDashFor('solid')).toBeUndefined();
		expect(edgeDashFor('lid')).toBe(edgeDashFor('dotted'));
	});
});
