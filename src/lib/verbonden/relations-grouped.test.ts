import { describe, expect, it } from 'vitest';
import type { Collection, Relation } from '$lib/vocabulary';
import { buildGroups, GROUPS } from './groups';
import type { Neighbor } from '$lib/api/nodes';

// The endpoints of each relation, as the API defines them (lawgraph core/relations.py), as
// pairs of sources and targets where a relation joins only some of them. A bron of a kind
// the panel shows gets each relation it can have in a group of its own, also when another
// kind of bron already has one for it: the group "Andere verbindingen" stays for relations
// the API adds later.
type Ends = [Collection[], Collection[]];
const ENDS: Record<Relation, Ends | Ends[]> = {
	PART_OF: [
		['articles', 'annexes', 'documents', 'cases'],
		['instruments', 'cases', 'dossiers']
	],
	VERSION_OF: [
		['instrument_versions', 'article_versions'],
		['instruments', 'articles']
	],
	ESTABLISHES: [['instruments'], ['articles']],
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
	PUBLISHED_IN: [['instruments'], ['instruments']],
	REFERS_TO: [
		[
			['articles', 'documents', 'judgments'],
			['articles', 'instruments', 'judgments']
		],
		[['documents'], ['documents']]
	],
	EXPLAINS: [['documents'], ['article_versions', 'articles', 'instruments']],
	APPEAL_OF: [['judgments'], ['judgments']],
	ADVISES_ON: [['judgments'], ['judgments']],
	ANSWERS: [
		[['judgments'], ['judgments']],
		[['documents'], ['commitments', 'documents']]
	],
	CONTINUES: [['judgments'], ['judgments']],
	REFERRED_BY: [['judgments'], ['judgments']],
	SAME_AS: [['judgments'], ['judgments']],
	SCOPED_BY: [['articles'], ['annexes']],
	ABOUT: [
		['activities', 'decisions', 'commitments'],
		['cases', 'dossiers']
	],
	LED_BY: [['activities'], ['committees']],
	MADE_IN: [['commitments', 'documents', 'decisions'], ['activities']],
	MEMBER_OF: [['members'], ['committees', 'factions']],
	SERVED_IN: [['members'], ['cabinets']],
	AUTHORED: [['members'], ['documents', 'cases']],
	RELATED_TO: [
		[['dossiers'], ['dossiers']],
		[['judgments'], ['judgments']],
		[['cases'], ['cases']]
	],
	REVISES: [
		[['dossiers'], ['dossiers']],
		[['documents'], ['documents']]
	],
	ACCOMPANIES: [
		[['dossiers'], ['dossiers']],
		[['documents'], ['documents']]
	],
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

const pairs = (ends: Ends | Ends[]): Ends[] =>
	Array.isArray(ends[0][0]) ? (ends as Ends[]) : [ends as Ends];

describe('every relation of the API', () => {
	const cases: [Collection, Relation, 'inbound' | 'outbound', Collection][] = [];
	for (const [relation, ends] of Object.entries(ENDS) as [Relation, Ends | Ends[]][])
		for (const [from, to] of pairs(ends))
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

// A known relation no group matches is left out without a word. Between Kamerstukken and
// toezeggingen each end shows the other, in a group of its own (PR #595: the papers a
// subject names; the letter that fulfils a toezegging).
describe('the verbindingen between Kamerstukken and toezeggingen', () => {
	const cases: [Collection, Relation, 'inbound' | 'outbound', Collection, string][] = [
		['documents', 'ANSWERS', 'outbound', 'documents', 'answers'],
		['documents', 'ANSWERS', 'inbound', 'documents', 'answered-by'],
		['documents', 'ANSWERS', 'outbound', 'commitments', 'fulfils'],
		['commitments', 'ANSWERS', 'inbound', 'documents', 'fulfilled-by'],
		['documents', 'REFERS_TO', 'outbound', 'documents', 'names'],
		['documents', 'REFERS_TO', 'inbound', 'documents', 'named-by']
	];
	it.each(cases)('%s: %s %s from %s stands in %s', (bron, relation, direction, other, id) => {
		const groups = buildGroups(bron, [neighbor(relation, direction, other)]);
		expect(groups.filter((g) => g.rows.length).map((g) => g.id)).toEqual([id]);
	});
});
