// The room of the canvas, shared out fairly. Past the soft cap, a netwerk of several
// bronnen does not let the one that came last (or the largest) take it all: every chosen bron
// first gets an equal share, what one does not use goes to the others, and within a share
// the oldest go first. A group drawn as one cluster bron costs one place. What the netwerk is
// about is never dropped: the chosen bronnen, their hulls and the lines between them.
import { neighbours } from '../adjacency';

type BudgetSlot = {
	/** Cluster id, or the id of a bron standing alone. */
	id: string;
	/** The nodes it stands for: one, or the members of a folded cluster. */
	members: string[];
	/** Insertion order of the newest member. */
	order: number;
	weight: number;
	protected: boolean;
	owner: string | null;
};

export type BudgetInput = {
	ids: readonly string[];
	edges: readonly { source: string; target: string }[];
	/** Insertion order per node: the lower, the older. */
	order: (id: string) => number;
	cap: number;
	/** The chosen bronnen of a netwerk (empty outside one). */
	chosen: readonly string[];
	/** The hull of a chosen law: its articles. */
	hullOf: (id: string) => ReadonlySet<string> | undefined;
	/** What ties the chosen bronnen. */
	core: ReadonlySet<string> | null;
	/** Protected whatever the share (the selection, its lines). */
	protect: ReadonlySet<string>;
	/**
	 * How much a bron weighs where there is no room for all: higher stays. Without, the newest
	 * stay.
	 */
	weight?: (id: string) => number;
	/** The groups drawn as one: id and members. */
	clusters: readonly { id: string; members: readonly string[] }[];
};

/** Places the canvas takes: a folded cluster is one. */
export function costOf(ids: readonly string[], clusters: BudgetInput['clusters']): number {
	let cost = ids.length;
	const have = new Set(ids);
	for (const c of clusters) {
		const inside = c.members.filter((m) => have.has(m)).length;
		if (inside > 1) cost -= inside - 1;
	}
	return cost;
}

/** `cap` shared out among demands: each gets its demand or an equal share of what is left. */
export function shareOut(demands: readonly number[], cap: number): number[] {
	const out = demands.map(() => 0);
	const byDemand = demands.map((d, i) => i).sort((a, b) => demands[a] - demands[b]);
	let left = cap;
	byDemand.forEach((i, j) => {
		const share = Math.floor(left / (byDemand.length - j));
		out[i] = Math.min(demands[i], share);
		left -= out[i];
	});
	return out;
}

/** Who each node belongs to: a chosen bron, its hull, or the chosen bron nearest by lines. */
function ownersOf(input: BudgetInput, ids: ReadonlySet<string>): Map<string, string> {
	const owner = new Map<string, string>();
	const load = new Map<string, number>();
	const give = (id: string, to: string) => {
		owner.set(id, to);
		load.set(to, (load.get(to) ?? 0) + 1);
	};
	for (const c of input.chosen) if (ids.has(c)) give(c, c);
	for (const c of input.chosen)
		for (const m of input.hullOf(c) ?? []) if (ids.has(m) && !owner.has(m)) give(m, c);
	const adjacent = neighbours(input.edges);
	let frontier = [...owner.keys()];
	while (frontier.length > 0) {
		const claims = new Map<string, Set<string>>();
		for (const id of frontier)
			for (const next of adjacent.get(id) ?? []) {
				if (!ids.has(next) || owner.has(next)) continue;
				const set = claims.get(next) ?? new Set<string>();
				set.add(owner.get(id)!);
				claims.set(next, set);
			}
		frontier = [];
		for (const [next, owners] of claims) {
			// Tied to several: to the one with the least so far.
			const [pick] = [...owners].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
			give(next, pick);
			frontier.push(next);
		}
	}
	return owner;
}

/** What a netwerk never loses: the chosen, their hulls, what ties them, the lines between them. */
function netwerkProtected(input: BudgetInput, ids: ReadonlySet<string>): Set<string> {
	const keep = new Set<string>(input.protect);
	const home = new Map<string, string>();
	for (const c of input.chosen) {
		home.set(c, c);
		keep.add(c);
		for (const m of input.hullOf(c) ?? []) {
			keep.add(m);
			if (!home.has(m)) home.set(m, c);
		}
	}
	for (const id of input.core ?? []) keep.add(id);
	// A line from one chosen bron (or its hull) to another: both ends stay.
	for (const e of input.edges) {
		const from = home.get(e.source);
		const to = home.get(e.target);
		if (from && to && from !== to) {
			keep.add(e.source);
			keep.add(e.target);
		}
	}
	for (const id of [...keep]) if (!ids.has(id)) keep.delete(id);
	return keep;
}

function unitsOf(input: BudgetInput, ids: ReadonlySet<string>): BudgetSlot[] {
	const keep = netwerkProtected(input, ids);
	const weight = input.weight ?? (() => 0);
	const owner = ownersOf(input, ids);
	const folded = new Map<string, BudgetSlot>();
	const units: BudgetSlot[] = [];
	for (const c of input.clusters) {
		const members = c.members.filter((m) => ids.has(m));
		if (members.length < 2) continue;
		const unit: BudgetSlot = {
			id: c.id,
			members,
			order: Math.max(...members.map(input.order)),
			weight: Math.max(...members.map(weight)),
			// A cluster with a protected end stays whole.
			protected: members.some((m) => keep.has(m)),
			owner: owner.get(members[0]) ?? null
		};
		for (const m of members) folded.set(m, unit);
		units.push(unit);
	}
	for (const id of ids) {
		if (folded.has(id)) continue;
		units.push({
			id,
			members: [id],
			order: input.order(id),
			weight: weight(id),
			protected: keep.has(id),
			owner: owner.get(id) ?? null
		});
	}
	return units;
}

/**
 * The nodes to take off so the canvas is within `cap` places, or none. A share per chosen bron
 * (the cap over their number, what one leaves unused to the rest), the protected first, then the
 * newest, within each share.
 */
export function planTrim(input: BudgetInput): string[] {
	const ids = new Set(input.ids);
	if (costOf(input.ids, input.clusters) <= input.cap) return [];
	const units = unitsOf(input, ids);
	const parties = [...new Set(input.chosen.filter((c) => ids.has(c)))];
	const byParty = new Map<string | null, BudgetSlot[]>();
	for (const u of units) {
		const key = u.owner !== null && parties.includes(u.owner) ? u.owner : null;
		byParty.set(key, [...(byParty.get(key) ?? []), u]);
	}
	// No chosen bron: one share for everything. Else equal shares, the unowned get what is left.
	const keys: (string | null)[] = parties.length > 0 ? parties : [null];
	const shares = shareOut(
		keys.map((k) => byParty.get(k)?.length ?? 0),
		input.cap
	);
	const allowed = new Map<string | null, number>(keys.map((k, i) => [k, shares[i]]));
	if (parties.length > 0) {
		const used = shares.reduce((a, b) => a + b, 0);
		allowed.set(null, Math.max(0, input.cap - used));
	}
	const drop: string[] = [];
	for (const [key, list] of byParty) {
		const room = allowed.get(key) ?? 0;
		const sorted = [...list].sort(
			(a, b) =>
				Number(b.protected) - Number(a.protected) || b.weight - a.weight || b.order - a.order
		);
		let kept = 0;
		for (const u of sorted) {
			if (u.protected || kept < room) kept++;
			else drop.push(...u.members);
		}
	}
	return drop;
}
