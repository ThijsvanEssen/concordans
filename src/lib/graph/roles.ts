// Who makes, in three lanes: Regering, Raad van State, Parlement. A person's lane and function are
// those on the day of the first stuk they signed on the canvas (`government_functions`), else a
// seat in the Eerste Kamer (`ek`); who signed the advies of the Raad van State stands in its lane.
// Where the data has no function for the person, the scene marks a gap and fills nothing in.
import { isMinister, sortOf } from '$lib/bron/rubrieken';
import { textOf } from '$lib/text/words';
import type { GraphNode } from './types';

export type MakerLane = 'government' | 'council' | 'parliament';

/** The cards of Wie maakt, from top to bottom. */
export const MAKER_LANE_ORDER: readonly MakerLane[] = ['government', 'council', 'parliament'];

type MakerRole = {
	lane: MakerLane;
	/** The function on the day, as the lane names it: "minister VWS", "advies Raad van State". */
	role: string | null;
	/** A Kamerlid's Kamer: EK by a seat in the Eerste Kamer, TK by one in a fractie of the Tweede. */
	chamber: 'TK' | 'EK' | null;
	/** The data has no function for this person on that day. */
	gap: boolean;
};

type Spell = { from_date?: unknown; to_date?: unknown; post?: unknown; ministry?: unknown };

const spellsOf = (v: unknown): Spell[] => (Array.isArray(v) ? (v as Spell[]) : []);

/** Whether a spell covers `day`: begun on or before it, ended on or after it, or not ended. */
const covers = (s: Spell, day: string): boolean =>
	(typeof s.from_date !== 'string' || s.from_date.slice(0, day.length) <= day) &&
	(typeof s.to_date !== 'string' || !s.to_date || s.to_date.slice(0, day.length) >= day);

/** The government function on `day`, one with a ministerie first: "minister VWS". */
function functionOn(
	props: Record<string, unknown>,
	day: string,
	ministryName: (key: string) => string
): string | null {
	const on = spellsOf(props.government_functions).filter((s) => covers(s, day));
	const pick = on.find((s) => textOf(s.ministry)) ?? on[0];
	if (!pick) return null;
	const post = (textOf(pick.post) ?? '').replace(/_/g, ' ');
	const ministry = textOf(pick.ministry);
	return [post, ministry ? ministryName(ministry) : null].filter(Boolean).join(' ') || null;
}

/** The latest government function, for a person without a stuk on the canvas. */
const latestFunction = (props: Record<string, unknown>) =>
	spellsOf(props.government_functions)
		.map((s) => textOf(s.to_date) ?? '9999')
		.sort()
		.at(-1);

/**
 * Whether a stuk is the advies of the Raad van State, by its kind. The advies with the nader
 * rapport is the government's answer to it, signed by the minister.
 */
export const isCouncilAdvice = (kind: string | null): boolean =>
	!!kind && /^advies\b.*raad van state\s*$/i.test(kind);

type MakerFacts = {
	/** The day of the first stuk the person signed on the canvas. */
	firstDay: string | null;
	/** They signed an advies of the Raad van State. */
	council: boolean;
	/** The abbreviation of a ministerie by its key: `vws` → "VWS". */
	ministryName: (key: string) => string;
};

/** The lane and function of a person on the canvas. */
function personRole(node: GraphNode, facts: MakerFacts): MakerRole {
	const props = node.raw?.props ?? {};
	const day = facts.firstDay ?? latestFunction(props) ?? null;
	const held = day ? functionOn(props, day, facts.ministryName) : null;
	if (facts.council)
		return { lane: 'council', role: 'advies Raad van State', chamber: null, gap: !held };
	if (held && (facts.firstDay || isMinister(props)))
		return { lane: 'government', role: held, chamber: null, gap: false };
	if (props.ek) return { lane: 'parliament', role: null, chamber: 'EK', gap: false };
	const seated = spellsOf(props.faction_memberships).length > 0;
	return { lane: 'parliament', role: null, chamber: seated ? 'TK' : null, gap: !seated };
}

/** The lane of a maker: a person by their function, a ministerie or kabinet in the Regering. */
export function makerRole(node: GraphNode, facts: MakerFacts): MakerRole {
	if (node.collection === 'members') return personRole(node, facts);
	const sort = sortOf(node.collection, node.key, node.raw?.props);
	const government = sort === 'ministeries' || sort === 'kabinetten';
	return { lane: government ? 'government' : 'parliament', role: null, chamber: null, gap: false };
}
