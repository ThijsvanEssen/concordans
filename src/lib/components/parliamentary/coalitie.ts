// What the coalition did on a vote of the Tweede Kamer (API 0.79.34, #397, `coalition` on a
// decision; Thijs, 10 Oct: "Coalitie verdeeld"). The block gives the seats of the coalition
// and the opposition per side and its pattern; the fracties of the coalition come with it in
// the feed (`coalition_factions`), and for a decision from the hall of that day. Source
// values, put in words; no reading of them.

import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { CHOICE } from '$lib/votes/stemming';

type CoalitionVote = Schema<'CoalitionVoteDTO'>;
type CoalitionFaction = Schema<'CoalitionFactionDTO'>;

/** What the coalition did on a vote, under its line in a Tijdlijn (`bij`, CoalitieRegel). */
export type CoalitieBij = { blok: CoalitionVote; fracties: CoalitionFaction[] };
type Choice = NonNullable<CoalitionFaction['choice']>;

/** A side the coalition took: the choice, its outcome box, its fracties by name, its seats. */
type CoalitionSide = {
	choice: Choice;
	outcome: 'ja' | 'nee';
	names: string[];
	seats: number;
};

/** The line under a vote: "Coalitie tegen", or "Coalitie verdeeld" with its sides. */
type CoalitionLine = {
	/** The side of a coalition that voted as one; null where it split. */
	together: CoalitionSide | null;
	/** Where it split: each side with its fracties, or with its seats where none are known. */
	sides: CoalitionSide[];
	/** The fracties whose seats went both ways (a roll call). */
	splitFactions: string[];
	/** `wisselmeerderheid`, `doorslaggevend`, in the source's own words. */
	labels: string[];
};

const nameOf = (f: CoalitionFaction) => f.short ?? naamVanId(`factions/${f.key}`);

/** The coalition line of a vote; null where the coalition cast no seat. */
export function coalitionLine(
	c: CoalitionVote,
	factions: readonly CoalitionFaction[]
): CoalitionLine | null {
	if (c.coalition_for + c.coalition_against === 0) return null;
	const side = (choice: Choice): CoalitionSide => ({
		choice,
		outcome: choice === CHOICE.for ? 'ja' : 'nee',
		names: factions.filter((f) => f.choice === choice).map(nameOf),
		seats: choice === CHOICE.for ? c.coalition_for : c.coalition_against
	});
	const both = [side(CHOICE.for), side(CHOICE.against)];
	const known = factions.length > 0;
	return {
		together:
			c.pattern === 'together'
				? side(c.coalition_for >= c.coalition_against ? CHOICE.for : CHOICE.against)
				: null,
		sides:
			c.pattern === 'together'
				? []
				: both.filter((s) => (known ? s.names.length > 0 : s.seats > 0)),
		splitFactions: factions.filter((f) => f.choice == null).map(nameOf),
		labels: [
			c.pattern === 'wissel' ? 'wisselmeerderheid' : null,
			c.decisive ? 'doorslaggevend' : null
		].filter((l): l is string => !!l)
	};
}

/** A fractie as a decision's votes give it. */
type Voter = { id: string; name: string; choice: string; seats: number | null };

/**
 * The fracties of the coalition on a decision, from its votes and the hall of that day
 * (`coalition` per fractie key); none without the hall or in a vote by member.
 */
export function coalitionFactionsOf(
	voters: readonly Voter[],
	inCoalition: ReadonlyMap<string, boolean | null> | null
): CoalitionFaction[] {
	if (!inCoalition) return [];
	return voters.flatMap((v) => {
		const key = v.id.startsWith('factions/') ? v.id.slice('factions/'.length) : null;
		if (!key || inCoalition.get(key) !== true) return [];
		const choice = v.choice === CHOICE.for || v.choice === CHOICE.against ? v.choice : null;
		if (!choice) return [];
		const seats = v.seats ?? 0;
		return [
			{
				key,
				short: v.name,
				choice,
				seats_for: choice === CHOICE.for ? seats : 0,
				seats_against: choice === CHOICE.against ? seats : 0
			}
		];
	});
}
