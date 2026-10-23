import { describe, expect, it } from 'vitest';
import { motionKindFromParam, motionKindLabel } from '$lib/text/motion-kind';

describe('motion kinds (API 0.80, #862)', () => {
	it('names a motion of censure and of no confidence, nothing else', () => {
		expect(motionKindLabel('censure')).toBe('Motie van afkeuring');
		expect(motionKindLabel('no_confidence')).toBe('Motie van wantrouwen');
		expect(motionKindLabel(null)).toBeNull();
		expect(motionKindLabel('Motie')).toBeNull();
	});

	it('reads the kind from its Dutch word in the address', () => {
		expect(motionKindFromParam('wantrouwen')).toBe('no_confidence');
		expect(motionKindFromParam('afkeuring')).toBe('censure');
		expect(motionKindFromParam('no_confidence')).toBeUndefined();
		expect(motionKindFromParam(null)).toBeUndefined();
	});
});
