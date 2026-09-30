// The rows of a stemming. A fractie counts its seats; in a hoofdelijke stemming each
// member is one vote, listed by choice and then by name.
import type { Schema } from '$lib/api/types';
import { UNNAMED } from '$lib/verbonden/rows';

export type Voter = {
	id: string;
	name: string;
	choice: string;
	/** The seats a fractie casts; null for a member, who casts one vote. */
	seats: number | null;
};

const ORDER = ['Voor', 'Tegen'];
const rank = (choice: string) => (ORDER.includes(choice) ? ORDER.indexOf(choice) : ORDER.length);

export function votersOf(decision: Pick<Schema<'DecisionDTO'>, 'vote_kind' | 'votes'>): Voter[] {
	const byMember = decision.vote_kind === 'member';
	const voters = (decision.votes ?? []).map((v) => ({
		id: v.voter_id,
		name: v.name?.trim() || UNNAMED,
		choice: v.choice,
		seats: byMember ? null : (v.seats ?? null)
	}));
	return byMember
		? voters.sort(
				(a, b) =>
					rank(a.choice) - rank(b.choice) ||
					Number(a.name === UNNAMED) - Number(b.name === UNNAMED) ||
					a.name.localeCompare(b.name, 'nl')
			)
		: voters.sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0));
}

/**
 * The Eerste Kamer names the fracties for and against, and those that want it noted that they
 * would have voted against a hamerstuk; it gives no seats.
 */
export function ekFactionGroups(
	decision: Pick<Schema<'DecisionDTO'>, 'factions_for' | 'factions_against' | 'factions_noted'>
): { label: string; names: string[] }[] {
	return [
		{ label: 'Voor', names: decision.factions_for ?? [] },
		{ label: 'Tegen', names: decision.factions_against ?? [] },
		{ label: 'Aantekening', names: decision.factions_noted ?? [] }
	].filter((g) => g.names.length > 0);
}
