// The picture of a vote's outcome, the same wherever one is read (Stembalk): the width is the
// seats of the Kamer (150, of the Eerste Kamer 75), voor from the left and tegen from the
// right, what is neither between them, a line at the majority. The model here; the
// drawing in Stembalk.svelte. Source values only.
import type { Schema } from '$lib/api/types';
import { capitalize } from '$lib/text/words';
import { CHOICE, forAgainst } from './stemming';

/** The seats of each Kamer, the width of the whole bar. */
const CHAMBER_SEATS = { TK: 150, EK: 75 } as const;

/** One fractie's part of a side, as the vote gives it. */
type VotePart = { name: string; seats: number };

export type VoteSide = 'for' | 'against' | 'other';

export type VoteBarModel = {
	/** The seats the full width stands for. */
	total: number;
	/** The seats of a majority: 76 of 150, 38 of 75. */
	majority: number;
	counts: Record<VoteSide, number>;
	/** Per fractie, largest first; empty where the vote gives no fracties (a tally alone). */
	parts: Record<VoteSide, VotePart[]>;
	/** For a screen reader: `Aangenomen, 88 voor, 62 tegen`. */
	sentence: string;
};

type Votes = Schema<'DecisionDTO'>['votes'];

const sideOfChoice = (choice: string): VoteSide =>
	choice === CHOICE.for ? 'for' : choice === CHOICE.against ? 'against' : 'other';

/**
 * The bar of a vote, from its tally and, where the vote names them, its fracties (the
 * votes[] of a Tweede Kamer vote with seats). Null for a vote without seats: a hamerstuk, an
 * older vote of the Eerste Kamer, whose seats of 0 are unknown, not a tally of 0.
 */
export function voteBarOf(
	d: {
		tally?: unknown;
		chamber?: string | null;
		votes?: Votes;
		vote_kind?: string | null;
	},
	outcome: string | null = null
): VoteBarModel | null {
	const { voor: inFavour, tegen: against } = forAgainst(d.tally);
	if (inFavour + against <= 0) return null;
	const tally = (d.tally && typeof d.tally === 'object' ? d.tally : {}) as Record<string, unknown>;
	const other = Object.entries(tally)
		.filter(([c]) => c !== CHOICE.for && c !== CHOICE.against)
		.reduce((n, [, z]) => n + (typeof z === 'number' && Number.isFinite(z) ? z : 0), 0);

	const parts: VoteBarModel['parts'] = { for: [], against: [], other: [] };
	if (d.vote_kind !== 'member')
		for (const v of d.votes ?? [])
			if (typeof v.seats === 'number' && v.seats > 0)
				parts[sideOfChoice(v.choice)].push({ name: v.name?.trim() || v.voter_key, seats: v.seats });
	for (const side of Object.values(parts)) side.sort((a, b) => b.seats - a.seats);

	const total = Math.max(
		CHAMBER_SEATS[d.chamber === 'EK' ? 'EK' : 'TK'],
		inFavour + against + other
	);
	const said = [
		`${inFavour} voor`,
		`${against} tegen`,
		...(other > 0 ? [`${other} niet deelgenomen`] : [])
	].join(', ');
	return {
		total,
		majority: Math.floor(total / 2) + 1,
		counts: { for: inFavour, against, other },
		parts,
		sentence: outcome ? `${capitalize(outcome.toLowerCase())}, ${said}` : capitalize(said)
	};
}
