// The outcome of a vote in one line, the same wherever a vote is read (VoteLine): on the
// page of the motie or amendement itself at rest, in its Stemming section, in the opened row
// of a stemming (Stemmingen, Actueel). The outcome in a word, the seats or the way it was
// decided, the day; then the fracties on each side, as the decision gives them: of the
// Tweede Kamer its votes, of the Eerste Kamer its own lists. A roll-call names members, not
// fracties: its line has the tally alone. Source values only.
import type { Schema } from '$lib/api/types';
import { decisionOutcome, decisionResult, isHammer } from '../explore/index/decision-kind';
import { ekFactionGroups } from '../explore/readers/voters';
import { methodPhrase } from './stages';
import { choiceRank, hasVotes } from './stemming';

type Decision = Schema<'DecisionDTO'>;

/** A side of the vote: its choice as the source writes it, and the fracties that made it, with their seats. */
type VoteSide = {
	choice: string;
	names: string[];
	/** The seats of each name, in step with `names`; null where the vote gives none. */
	seats: (number | null)[];
};

type VoteLineParts = {
	/** `Aangenomen`, `Verworpen`, `Zonder stemming aangenomen`, `Uitstellen`. */
	word: string;
	/** The mark of the word: aangenomen filled, verworpen open, anything else dashed. */
	tone: 'ja' | 'nee' | 'open';
	/** `120 voor, 30 tegen`, `bij zitten en opstaan`; null for neither. */
	how: string | null;
	/** The day of the vote (ISO); null without one. */
	date: string | null;
	/** The stemming's key, for the link to it. */
	decision: string;
	sides: VoteSide[];
};

const TONE = { aangenomen: 'ja', verworpen: 'nee', ingetrokken: 'open' } as const;

/** `120 voor, 30 tegen, 1 niet deelgenomen`: every choice the tally counts, voor first. */
function tallyWords(tally: Record<string, number> | null | undefined): string | null {
	if (!hasVotes(tally)) return null;
	return Object.entries(tally ?? {})
		.filter(([, seats]) => seats > 0)
		.sort(([a], [b]) => choiceRank(a) - choiceRank(b))
		.map(([choice, seats]) => `${seats} ${choice.toLowerCase()}`)
		.join(', ');
}

/** The fracties per side, voor first; none for a roll-call, whose voters are members. */
export function sidesOf(d: Decision): VoteSide[] {
	if (d.chamber === 'EK')
		return ekFactionGroups(d).map((g) => ({
			choice: g.label,
			names: g.names,
			seats: g.names.map(() => null)
		}));
	if (d.vote_kind === 'member') return [];
	const by = Map.groupBy(d.votes ?? [], (v) => v.choice);
	return [...by.keys()]
		.sort((a, b) => choiceRank(a) - choiceRank(b))
		.map((choice) => {
			const votes = by.get(choice)!;
			return {
				choice,
				names: votes.map((v) => v.name?.trim() || v.voter_key),
				seats: votes.map((v) => (typeof v.seats === 'number' && v.seats > 0 ? v.seats : null))
			};
		});
}

/**
 * Whether the decision as given holds what its line needs: a vote of the Tweede Kamer by
 * fracties with seats but no votes was given without them, and is asked whole.
 */
export const hasSides = (d: Decision): boolean =>
	d.chamber === 'EK' ||
	d.vote_kind === 'member' ||
	(d.votes ?? []).length > 0 ||
	!hasVotes(d.tally);

/** The tone of a decision's outcome: aangenomen ja, verworpen nee, else open. One reading, so
 *  the motie, the stemming and the list colour an outcome alike (red with its word). */
export function outcomeTone(d: Decision): VoteLineParts['tone'] {
	const result = decisionResult(d);
	return result && result !== 'ingetrokken' ? TONE[result] : 'open';
}

/** The line of a decision; without an outcome or a kind, the plain word `Stemming`. */
export function voteLineOf(d: Decision): VoteLineParts {
	const tally = tallyWords(d.tally);
	const how =
		tally && d.vote_kind === 'member'
			? `${tally}, bij hoofdelijke stemming`
			: (tally ?? (isHammer(d) ? null : methodPhrase(d.method, d.decision_kind)));
	return {
		word: decisionOutcome(d) ?? 'Stemming',
		// A vote is aangenomen or verworpen; ingetrokken ends a bill by letter, never a vote.
		tone: outcomeTone(d),
		how,
		date: d.date ?? null,
		decision: d.key,
		sides: sidesOf(d)
	};
}

/**
 * The decision that settled a stuk, of those taken on it: the one the stuk names
 * (`decision`), else the last with an outcome. A stuk only postponed has none.
 */
export function decidingVote(
	decisions: readonly Decision[] | null | undefined,
	key: string | null | undefined
): Decision | null {
	const all = decisions ?? [];
	return (
		(key ? all.find((d) => d.key === key) : undefined) ??
		all.findLast((d) => decisionResult(d) !== null) ??
		null
	);
}
