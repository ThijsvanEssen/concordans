import { afterEach, describe, expect, it } from 'vitest';
import { nodeCap, setNodeCap, SOFT_NODE_CAP } from './types';

describe('?grens', () => {
	afterEach(() => setNodeCap(null));

	it('keeps the soft cap without a valid ask', () => {
		for (const asked of [null, '', 'veel', '12', '5000', '800.5']) {
			setNodeCap(asked);
			expect(nodeCap()).toBe(SOFT_NODE_CAP);
		}
	});

	it('takes a whole number from 50 to 2000', () => {
		setNodeCap('800');
		expect(nodeCap()).toBe(800);
		setNodeCap('1000');
		expect(nodeCap()).toBe(1000);
		setNodeCap(null);
		expect(nodeCap()).toBe(SOFT_NODE_CAP);
	});
});
