// Votes of the Tweede Kamer as the coalition cast them: the cases the coalition line answers,
// for coalitie.test.ts and CoalitieRegel.test.ts.
import type { Schema } from '$lib/api/types';
import { CHOICE } from '$lib/votes/stemming';

type Vote = Schema<'CoalitionVoteDTO'>;
type Faction = Schema<'CoalitionFactionDTO'>;

const vote = (extra: Partial<Vote>): Vote => ({
	cabinet: 'jetten',
	coalition_for: 0,
	coalition_against: 0,
	opposition_for: 0,
	opposition_against: 0,
	pattern: 'together',
	carried: false,
	decisive: false,
	...extra
});

export const faction = (key: string, choice: Faction['choice'], seats: number): Faction => ({
	key,
	short: key.toUpperCase(),
	choice,
	seats_for: choice === CHOICE.for ? seats : 0,
	seats_against: choice === CHOICE.against ? seats : 0
});

export const COALITION_VOTES = {
	tegen: vote({ coalition_against: 66, opposition_for: 56, opposition_against: 27 }),
	voor: vote({ coalition_for: 66, carried: true }),
	geen: vote({}),
	verdeeld: vote({ coalition_for: 26, coalition_against: 40, pattern: 'split' }),
	wissel: vote({ coalition_for: 40, coalition_against: 26, pattern: 'wissel', decisive: true })
};
