// Which bronnen a suppressed container currently holds: a wet's articles, a fractie's
// or commissie's leden, a dossier's stukken/zaken/activiteiten. A container itself is
// never drawn as a node when it turns up as someone else's neighbour (see `drawable()`
// in `store/context.ts`); this is where its children are recorded instead, so the
// canvas can draw a hull around them. Membership is canvas state, not a session-wide
// cache: `pruneContainerMembers` keeps it in step with what is still on canvas.

import { instrumentContainerId } from '$lib/api/instrument-cache';
import { isCollection, nodeId, type Relation } from '$lib/vocabulary';
import { writable, type Readable } from 'svelte/store';

export type ContainerKind = 'instrument' | 'faction' | 'committee' | 'dossier';

const CONTAINER_KINDS: ReadonlySet<string> = new Set<ContainerKind>([
	'instrument',
	'faction',
	'committee',
	'dossier'
]);

/** Whether a `GraphNodeKind` (or any string) is a container kind: never a canvas node. */
export function isContainerKind(kind: string): kind is ContainerKind {
	return CONTAINER_KINDS.has(kind);
}

// A node's `collection` comes off the API as a plain string, so this looks it up
// by string rather than by the stricter `Collection` type `nodeToGraphNode` uses.
const KIND_OF_COLLECTION: Partial<Record<string, ContainerKind>> = {
	instruments: 'instrument',
	factions: 'faction',
	committees: 'committee',
	dossiers: 'dossier'
};

/** The container kind a collection is drawn as a hull for, or null for an ordinary bron. */
export function containerKindOf(collection: string): ContainerKind | null {
	return KIND_OF_COLLECTION[collection] ?? null;
}

/**
 * Whether an edge to a container kind means the other side belongs in its hull.
 * A wet's members are its articles alone (PART_OF): a stuk that AMENDS or
 * REFERS_TO the wet directly relates to it without being part of it, the same
 * way it would for one of the wet's articles, so that stays a dropped edge, not
 * membership. A fractie, commissie or dossier has no such second, looser
 * relation in this app's vocabulary, so any relation to one counts: a
 * commissie no longer draws a node either, so an activity it merely leidt
 * would otherwise lose its only link to the canvas rather than join a hull.
 */
export function isContainerMembership(kind: ContainerKind, relation: Relation): boolean {
	return kind === 'instrument' ? relation === 'PART_OF' : true;
}

export type ContainerGroup = {
	kind: ContainerKind;
	id: string;
	/** Empty for an instrument: its name comes from `instrumentMetaStore` instead. */
	label: string;
	members: Set<string>;
	/** The members that are PART_OF the container (a dossier's stukken and zaken), not merely about it. */
	parts: Set<string>;
};

/**
 * Whether a group is drawn as a hull. A dossier is, when it holds a stuk or zaak of its
 * own or is the focus: an activity about forty dossiers (a regeling van werkzaamheden)
 * would otherwise draw forty hulls around that one activity.
 */
export const isDrawnGroup = (group: ContainerGroup, focusId: string | null): boolean =>
	group.kind !== 'dossier' || group.parts.size > 0 || group.id === focusId;

/** The id a container is grouped under: an instrument by law id, the rest by node id. */
export function containerIdFor(node: {
	collection: string;
	key: string;
	props?: Record<string, unknown> | null;
}): string | null {
	if (node.collection === 'instruments') return instrumentContainerId(node.props ?? {});
	return isCollection(node.collection) ? nodeId(node.collection, node.key) : null;
}

const groups = new Map<string, ContainerGroup>();
const store = writable(groups);

let flushQueued = false;
function flush() {
	if (flushQueued) return;
	flushQueued = true;
	queueMicrotask(() => {
		flushQueued = false;
		store.set(new Map(groups));
	});
}

function ensureGroup(kind: ContainerKind, id: string): ContainerGroup {
	let group = groups.get(id);
	if (!group) {
		group = { kind, id, label: '', members: new Set(), parts: new Set() };
		groups.set(id, group);
	}
	return group;
}

/** Registers the name of a suppressed container bron. Keeps the existing name if `label` is empty. */
export function recordContainerMeta(kind: ContainerKind, id: string | null, label: string): void {
	if (!id) return;
	const group = ensureGroup(kind, id);
	if (label && label !== group.label) group.label = label;
	flush();
}

/** Registers that `childId` (a bron on canvas) belongs to the container `id`, by `relation`. */
export function recordContainerMember(
	kind: ContainerKind,
	id: string | null,
	childId: string,
	relation: Relation = 'PART_OF'
): void {
	if (!id) return;
	const group = ensureGroup(kind, id);
	const part = relation === 'PART_OF';
	if (group.members.has(childId) && (!part || group.parts.has(childId))) return;
	group.members.add(childId);
	if (part) group.parts.add(childId);
	flush();
}

/** The current group for a container id, if any bron has been recorded into it. */
export function getContainerGroup(id: string): ContainerGroup | undefined {
	return groups.get(id);
}

/** Whether a bron is currently held by some hull: its own relation is bookkeeping, not a
 *  drawn edge, so it would otherwise look orphaned and be swept off the canvas. */
export function isContainerMember(id: string): boolean {
	for (const group of groups.values()) if (group.members.has(id)) return true;
	return false;
}

/** Drops children no longer on canvas, so a hull does not outlive its bronnen. */
export function pruneContainerMembers(keepIds: ReadonlySet<string>): void {
	let changed = false;
	for (const group of groups.values()) {
		for (const id of group.members) {
			if (!keepIds.has(id)) {
				group.members.delete(id);
				group.parts.delete(id);
				changed = true;
			}
		}
	}
	if (changed) flush();
}

export const containerMembershipStore: Readable<Map<string, ContainerGroup>> = {
	subscribe: store.subscribe
};
