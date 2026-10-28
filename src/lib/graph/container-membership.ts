// Which bronnen a suppressed container currently holds: a wet's articles, a fractie's
// or commissie's leden, a dossier's stukken/zaken/activiteiten. A container itself is
// never drawn as a node when it turns up as someone else's neighbour (see `drawable()`
// in `store/context.ts`); this is where its children are recorded instead, so the
// canvas can draw a hull around them. Membership is canvas state, not a session-wide
// cache: each graph store holds its own (`createContainerGroups`), `prune` keeps it in
// step with what is still on canvas and a reset clears it.

import { instrumentContainerId } from '$lib/text/instrument-meta';
import { isCollection, nodeId, type Relation } from '$lib/vocabulary';
import { writable, type Readable } from 'svelte/store';
import { COLLECTION_ROLE } from './collection-role';

export type ContainerKind = 'instrument' | 'faction' | 'committee' | 'cabinet' | 'dossier';

const CONTAINER_KINDS: ReadonlySet<string> = new Set<ContainerKind>([
	'instrument',
	'faction',
	'committee',
	'cabinet',
	'dossier'
]);

/** Whether a `DrawClass` (or any string) is a container kind: never a canvas node. */
export function isContainerKind(kind: string): kind is ContainerKind {
	return CONTAINER_KINDS.has(kind);
}

/** The container kind a collection is drawn as a hull for, or null for an ordinary bron. */
export function containerKindOf(collection: string): ContainerKind | null {
	return isCollection(collection) ? COLLECTION_ROLE[collection].hull : null;
}

/**
 * The container kind of a bron in focus or chosen: its hull, or the hull it has only then (a
 * ministerie around its bewindspersonen, `focusHull`).
 */
export function focusKindOf(collection: string): ContainerKind | null {
	if (!isCollection(collection)) return null;
	const role = COLLECTION_ROLE[collection];
	return role.hull ?? role.focusHull ?? null;
}

/**
 * Whether an edge to a container kind means the other side belongs in its hull.
 * A wet's members are its articles alone (PART_OF): a stuk that AMENDS or
 * REFERS_TO the wet directly relates to it without being part of it, the same
 * way it would for one of the wet's articles, so that stays a dropped edge, not
 * membership. A fractie holds its leden alone (below). A commissie or dossier has no
 * such second, looser relation in this app's vocabulary, so any relation to one counts: a
 * commissie no longer draws a node either, so an activity it merely leidt
 * would otherwise lose its only link to the canvas rather than join a hull.
 */
export function isContainerMembership(kind: ContainerKind, relation: Relation): boolean {
	if (kind === 'instrument') return relation === 'PART_OF';
	// A fractie holds its leden; the dossiers they signed and the stemmingen it cast stand
	// beside it. Drawn in it, "toon in netwerk" on VVD's 332 dossiers turned the hull black
	// on a phone (Thijs, 9 Oct).
	if (kind === 'faction') return relation === 'MEMBER_OF';
	return true;
}

/**
 * Whether an edge between a bron and a container is containment: the bron stands in the
 * container's hull and no line is drawn, wherever the edge comes from (a focus, a
 * neighbourhood, the paths or a netwerk between chosen bronnen, a row put on the canvas).
 * "Onderdeel van" (PART_OF) is: an article in its wet, a stuk in its dossier. Thijs, 12 Oct:
 * "Een 'onderdeel van'-relatie voor een stuk en een dossier hoort niet getekend te worden;
 * groeperingen moeten om de elementen heen staan." A lid's MEMBER_OF a commissie or
 * fractie two chosen leden share stays a line to its point (`joins` in store/context).
 */
export function isContainment(kind: ContainerKind, relation: Relation): boolean {
	return relation === 'PART_OF' && isContainerMembership(kind, relation);
}

export type ContainerGroup = {
	kind: ContainerKind;
	id: string;
	/** Empty for an instrument: its name comes from `instrumentMetaStore` instead. */
	label: string;
	/** The name in full, shown on hover: a commissie's name, a dossier's number and title. */
	fullLabel: string;
	members: Set<string>;
	/** The members that are PART_OF the container (a dossier's stukken and zaken), not merely about it. */
	parts: Set<string>;
	/** When a member belonged to it (a lid's seat on a commissie or in a fractie), where the edge says. */
	periods: Map<string, Period>;
	/** Drawn around one member too: the dossier of a stuk on a path between chosen bronnen. */
	lone?: boolean;
};

/** A stretch of time as ISO dates, open where null. */
export type Period = { from: string | null; to: string | null };

const overlaps = (a: Period, b: Period) =>
	(a.from === null || b.to === null || a.from <= b.to) &&
	(a.to === null || b.from === null || b.from <= a.to);

/**
 * The moment a lid's hulls stand for when no period is chosen: today, or, for someone
 * no longer on a commissie or in a fractie, the day their last seat ended.
 */
export function momentOf(
	memberId: string | null,
	groups: Iterable<ContainerGroup>,
	today: string
): Period | null {
	if (!memberId) return null;
	let last: string | null = null;
	for (const group of groups) {
		const period = group.periods.get(memberId);
		if (!period) continue;
		if (period.to === null || period.to >= today) return { from: today, to: today };
		if (last === null || period.to > last) last = period.to;
	}
	return last ? { from: last, to: last } : null;
}

/**
 * Whether a group is drawn as a hull.
 * - A dossier is, when it holds a stuk or zaak of its own or is the focus: an activity
 *   about forty dossiers (a regeling van werkzaamheden) would otherwise draw forty hulls
 *   around that one activity.
 * - A commissie or fractie the focused lid sat in is, when that seat overlaps `period`:
 *   thirteen commissies over nine years would otherwise stack around one person.
 */
export function isDrawnGroup(
	group: ContainerGroup,
	focusId: string | null,
	focusNodeId: string | null = null,
	period: Period | null = null
): boolean {
	if (group.kind === 'dossier') return group.parts.size > 0 || group.id === focusId;
	const seat = focusNodeId ? group.periods.get(focusNodeId) : undefined;
	return !seat || !period || overlaps(seat, period);
}

/** The id a container is grouped under: an instrument by law id, the rest by node id. */
export function containerIdFor(node: {
	collection: string;
	key: string;
	props?: Record<string, unknown> | null;
}): string | null {
	// A law without a BWB id (an act of the EU) by its key, as its articles name it (CELEX).
	if (node.collection === 'instruments')
		return instrumentContainerId({ key: node.key.toUpperCase(), ...node.props });
	return isCollection(node.collection) ? nodeId(node.collection, node.key) : null;
}

/**
 * The hulls of one canvas: which bronnen each suppressed container holds. Each graph
 * store has its own, and a reset starts it afresh. Subscribers get one new map per
 * microtask, however many members a load records.
 */
export function createContainerGroups() {
	const groups = new Map<string, ContainerGroup>();
	const store = writable(new Map(groups));

	let flushQueued = false;
	const flush = () => {
		if (flushQueued) return;
		flushQueued = true;
		queueMicrotask(() => {
			flushQueued = false;
			store.set(new Map(groups));
		});
	};

	const ensureGroup = (kind: ContainerKind, id: string): ContainerGroup => {
		let group = groups.get(id);
		if (!group) {
			group = {
				kind,
				id,
				label: '',
				fullLabel: '',
				members: new Set(),
				parts: new Set(),
				periods: new Map()
			};
			groups.set(id, group);
		}
		return group;
	};

	return {
		groups: { subscribe: store.subscribe } as Readable<Map<string, ContainerGroup>>,

		/** Registers the names of a suppressed container bron. Keeps an existing name where one is empty. */
		recordMeta(kind: ContainerKind, id: string | null, label: string, fullLabel = ''): void {
			if (!id) return;
			const group = ensureGroup(kind, id);
			if (label) group.label = label;
			if (fullLabel) group.fullLabel = fullLabel;
			flush();
		},

		/** Registers that `childId` (a bron on canvas) belongs to the container `id`, by `relation`. */
		recordMember(
			kind: ContainerKind,
			id: string | null,
			childId: string,
			relation: Relation = 'PART_OF',
			period: Period | null = null
		): void {
			if (!id) return;
			const group = ensureGroup(kind, id);
			const part = relation === 'PART_OF';
			const known = group.members.has(childId) && (!part || group.parts.has(childId));
			if (known && (!period || group.periods.has(childId))) return;
			group.members.add(childId);
			if (part) group.parts.add(childId);
			if (period) group.periods.set(childId, period);
			flush();
		},

		/** Lets a container's hull stand around a single member (a stuk on a path, BE-49). */
		markLone(id: string | null): void {
			const group = id ? groups.get(id) : undefined;
			if (!group || group.lone) return;
			group.lone = true;
			flush();
		},

		/** The current group for a container id, if any bron has been recorded into it. */
		get(id: string): ContainerGroup | undefined {
			return groups.get(id);
		},

		/** Whether a bron is currently held by some hull: its own relation is bookkeeping, not a
		 *  drawn edge, so it would otherwise look orphaned and be swept off the canvas. */
		holds(id: string): boolean {
			for (const group of groups.values()) if (group.members.has(id)) return true;
			return false;
		},

		/** Drops children no longer on canvas, so a hull does not outlive its bronnen. */
		prune(keepIds: ReadonlySet<string>): void {
			let changed = false;
			for (const group of groups.values()) {
				for (const id of group.members) {
					if (!keepIds.has(id)) {
						group.members.delete(id);
						group.parts.delete(id);
						group.periods.delete(id);
						changed = true;
					}
				}
			}
			if (changed) flush();
		},

		/** Forgets every hull, its names and `lone` included: the canvas starts afresh. */
		clear(): void {
			if (groups.size === 0) return;
			groups.clear();
			flush();
		}
	};
}

/**
 * The members of a group who left before it ended, with the day they left: drawn as an
 * outline without a name, a current member filled and named (the one marking, N13). A cabinet
 * that has ended does not make all its bewindspersonen former ones, only those who left before.
 */
export function formerMembers(
	group: Pick<ContainerGroup, 'periods'> | undefined,
	today: string
): Map<string, string> {
	const seats = [...(group?.periods ?? [])];
	const end = seats.some(([, p]) => p.to === null)
		? today
		: (seats
				.map(([, p]) => p.to as string)
				.sort()
				.at(-1) ?? '');
	return new Map(
		seats.filter(([, p]) => p.to !== null && p.to < end).map(([id, p]) => [id, p.to as string])
	);
}
