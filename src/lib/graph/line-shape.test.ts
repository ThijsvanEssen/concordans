import { describe, expect, it } from 'vitest';
import { BEND, curvedLine, headLength } from './line-shape';

const A = { x: 0, y: 0 };
const B = { x: 100, y: 0 };

describe('curvedLine', () => {
	it('bends the control point BEND of the length beside the middle', () => {
		const { d } = curvedLine(A, B, { ra: 0, rb: 0, width: 2, arrow: 3.2 });
		const [, cx, cy] = /Q(-?[\d.]+) (-?[\d.]+)/.exec(d)!.map(Number);
		expect(cx).toBeCloseTo(50, 0);
		expect(Math.abs(cy)).toBeCloseTo(BEND * 100, 0);
	});
	it('stops at the edge of its brons, with the air between', () => {
		const { d } = curvedLine(A, B, { ra: 8, rb: 8, width: 2, arrow: 3.2 });
		const [x1, , x2] = [...d.matchAll(/-?[\d.]+/g)]
			.map((m) => Number(m[0]))
			.filter((_, i) => i !== 3);
		expect(x1).toBeGreaterThan(10.5);
		expect(x2).toBeLessThan(89.5);
	});
	it('puts the tip of the arrowhead where the body would end, and shortens the body by it', () => {
		const zonder = curvedLine(A, B, { ra: 0, rb: 0, width: 2, arrow: 3.2 });
		const met = curvedLine(A, B, { ra: 0, rb: 0, width: 2, arrow: 3.2, head: 'b' });
		expect(met.head).not.toBeNull();
		expect(met.d).not.toBe(zonder.d);
		const tip = met.head!.split(' ')[0].split(',').map(Number);
		expect(tip[0]).toBeGreaterThan(95);
	});
	it('draws no arrowhead and no dot unless asked', () => {
		const l = curvedLine(A, B, { ra: 0, rb: 0, width: 2, arrow: 3.2 });
		expect(l.head).toBeNull();
		expect(l.dot).toBeNull();
	});
	it('puts the dot at the end of the submitter', () => {
		const l = curvedLine(A, B, { ra: 0, rb: 0, width: 2, arrow: 3.2, head: 'b', dot: 'a' });
		expect(l.dot!.x).toBeLessThan(10);
	});
	it('keeps an arrowhead at least 5,5 px long', () => {
		expect(headLength(0.5, 3.2)).toBe(5.5);
		expect(headLength(3, 3.2)).toBeGreaterThan(9);
	});
});
