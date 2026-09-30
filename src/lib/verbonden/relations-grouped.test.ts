import { describe, expect, it } from 'vitest';
import type { Collection, Relation } from '$lib/vocabulary';
import { buildGroups, GROUPS } from './groups';
import type { Neighbor } from './rows';

// The endpoints of each relation, as the API defines them (lawgraph core/relations.py).
// A bron of a kind the panel shows gets each relation it can have in a group of its own:
// the group "Andere verbindingen" stays for relations the API adds later.
const ENDS: Record<Relation, [Collection[], Collection[]]> = {
	PART_OF: [
		['articles', 'annexes', 'documents', 'cases'],
		['instruments', 'cases', 'dossiers']
	],
	VERSION_OF: [
		['instrument_versions', 'article_versions'],
		['instruments', 'articles']
	],
	AMENDS: [
		['instruments', 'documents'],
		['instruments', 'articles']
	],
	INTRODUCES: [
		['instruments', 'documents'],
		['instruments', 'articles']
	],
	REPEALS: [
		['instruments', 'documents'],
		['instruments', 'articles']
	],
	BASED_ON: [['instruments'], ['articles']],
	IMPLEMENTS: [['instruments'], ['instruments']],
	LEGISLATED_IN: [['instruments'], ['dossiers']],
	REFERS_TO: [
		['articles', 'documents', 'judgments'],
		['articles', 'instruments', 'judgments']
	],
	EXPLAINS: [['documents'], ['article_versions', 'articles', 'instruments']],
	APPEAL_OF: [['judgments'], ['judgments']],
	ADVISES_ON: [['judgments'], ['judgments']],
	ANSWERS: [['judgments'], ['judgments']],
	CONTINUES: [['judgments'], ['judgments']],
	REFERRED_BY: [['judgments'], ['judgments']],
	SAME_AS: [['judgments'], ['judgments']],
	SCOPED_BY: [['articles'], ['annexes']],
	ABOUT: [
		['activities', 'decisions', 'commitments'],
		['cases', 'dossiers']
	],
	LED_BY: [['activities'], ['committees']],
	MADE_IN: [['commitments'], ['activities']],
	MEMBER_OF: [['members'], ['committees', 'factions']],
	SERVED_IN: [['members'], ['cabinets']],
	AUTHORED: [['members'], ['documents', 'cases']],
	RELATED_TO: [['dossiers'], ['dossiers']],
	REVISES: [['dossiers'], ['dossiers']],
	ACCOMPANIES: [['dossiers'], ['dossiers']],
	SECOND_READING_OF: [['dossiers'], ['dossiers']],
	VOTED: [['members', 'factions'], ['decisions']]
};

const neighbor = (
	relation: Relation,
	direction: 'inbound' | 'outbound',
	collection: Collection
): Neighbor =>
	({
		id: `${collection}/x`,
		key: 'x',
		collection,
		relation,
		direction,
		props: {}
	}) as unknown as Neighbor;

describe('every relation of the API', () => {
	const cases: [Collection, Relation, 'inbound' | 'outbound', Collection][] = [];
	for (const [relation, [from, to]] of Object.entries(ENDS) as [
		Relation,
		[Collection[], Collection[]]
	][])
		for (const source of from)
			for (const target of to) {
				if (source in GROUPS) cases.push([source, relation, 'outbound', target]);
				if (target in GROUPS) cases.push([target, relation, 'inbound', source]);
			}

	it.each(cases)('%s: %s %s from %s has a group of its own', (bron, relation, direction, other) => {
		const groups = buildGroups(bron, [neighbor(relation, direction, other)]);
		expect(groups.find((g) => g.id === 'other')?.rows ?? []).toEqual([]);
	});
});
