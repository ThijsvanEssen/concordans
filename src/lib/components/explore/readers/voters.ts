// The rows of a stemming. A fractie counts its seats; in a hoofdelijke stemming each
// member is one vote, listed by choice and then by name.
import { capitalize } from '$lib/text/words';
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

const EK_CHOICES = ['voor', 'tegen', 'aantekening gevraagd'] as const;

/**
 * How an Eerste Kamer fractie voted, counted (API 0.68): `voor bij 20, tegen bij 5 en
 * aantekening gevraagd bij 1 van de 26 stemmingen`. A choice it never made is left out.
 */
export function ekVoteLine(
	counts: Record<string, number> | null | undefined,
	total: number
): string {
	const parts = EK_CHOICES.flatMap((c) =>
		(counts?.[c] ?? 0) > 0 ? [`${c} bij ${counts![c]}`] : []
	);
	if (!parts.length) return `${total} ${total === 1 ? 'stemming' : 'stemmingen'}`;
	const list =
		parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} en ${parts.at(-1)}`;
	const line = `${list} van de ${total} ${total === 1 ? 'stemming' : 'stemmingen'}`;
	return capitalize(line);
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
