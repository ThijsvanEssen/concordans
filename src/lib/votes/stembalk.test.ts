import { describe, expect, it } from 'vitest';
import { voteBarOf } from '$lib/votes/stembalk';

const stem = (name: string, choice: string, seats: number) => ({
	voter_id: `factions/${name.toLowerCase()}`,
	voter_key: name.toLowerCase(),
	name,
	choice,
	seats,
	path: null
});

describe('voteBarOf', () => {
	it('is as wide as the Tweede Kamer, with its majority and one sentence', () => {
		const m = voteBarOf({ tally: { Voor: 88, Tegen: 62 }, chamber: 'TK' }, 'Aangenomen')!;
		expect([m.total, m.majority, m.counts.for, m.counts.against, m.counts.other]).toEqual([
			150, 76, 88, 62, 0
		]);
		expect(m.sentence).toBe('Aangenomen, 88 voor, 62 tegen');
	});

	it('is 75 seats wide for the Eerste Kamer, with a majority of 38', () => {
		const m = voteBarOf({ tally: { Voor: 40, Tegen: 35 }, chamber: 'EK' })!;
		expect([m.total, m.majority]).toEqual([75, 38]);
	});

	it('counts what is neither, and orders the fracties by their seats', () => {
		const m = voteBarOf({
			tally: { Voor: 30, Tegen: 116, 'Niet deelgenomen': 4 },
			votes: [stem('SP', 'Voor', 9), stem('PVV', 'Voor', 21), stem('VVD', 'Tegen', 24)]
		})!;
		expect(m.counts.other).toBe(4);
		expect(m.parts.for.map((d) => d.name)).toEqual(['PVV', 'SP']);
		expect(m.sentence).toBe('30 voor, 116 tegen, 4 niet deelgenomen');
	});

	it('has no fracties on a hoofdelijke stemming, and no bar without seats', () => {
		expect(
			voteBarOf({
				tally: { Voor: 76, Tegen: 74 },
				vote_kind: 'member',
				votes: [stem('A', 'Voor', 1)]
			})!.parts.for
		).toEqual([]);
		expect(voteBarOf({ tally: { Voor: 0, Tegen: 0 } })).toBeNull();
		expect(voteBarOf({ tally: null })).toBeNull();
	});
});
