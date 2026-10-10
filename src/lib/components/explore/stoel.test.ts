import { describe, expect, it } from 'vitest';
import { stemVanStoel } from './stoel';

const stemming = { d66: 'tegen', vvd: 'voor' } as const;

describe('a seat of the hall on one stemming', () => {
	it('shows its fractie’s side, and fades where the fractie took no part', () => {
		expect(stemVanStoel({ faction: { key: 'd66' } }, stemming)).toBe('tegen');
		expect(stemVanStoel({ faction: { key: 'vvd' } }, stemming)).toBe('voor');
		expect(stemVanStoel({ faction: { key: 'pvv' } }, stemming)).toBe('niet');
		expect(stemVanStoel({ faction: { key: 'd66' } }, null)).toBeNull();
	});

	it('shows no vote on a vacant seat (UX-toets 0.79.44, #39)', () => {
		expect(stemVanStoel({ leeg: true, faction: { key: 'd66' } }, stemming)).toBeNull();
	});
});
