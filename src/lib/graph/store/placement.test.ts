import { describe, expect, it } from 'vitest';
import type { ContainerKind } from '../container-membership';
import type { GraphNodeKind } from '../types';
import type { Relation } from '$lib/vocabulary';
import { placeConnection, type Connection, type End, type Mode, type Placement } from './placement';

const bron = (kind: GraphNodeKind, drawn = true): End => ({ hull: null, drawn, kind });
const hull = (h: ContainerKind, drawn = false): End => ({ hull: h, drawn, kind: h });

const at = (
	mode: Mode,
	source: End,
	relation: Relation,
	target: End,
	more: Partial<Connection> = {}
): Placement => placeConnection({ mode, relation, source, target, threshold: 0.6, ...more });

describe('where a verbinding lands', () => {
	it.each<[string, Placement, Placement]>([
		[
			'a stuk in its dossier: in the hull, without a line',
			at('node', bron('document'), 'PART_OF', hull('dossier'), { focus: 'source' }),
			{ place: 'member', hull: 'target', seat: true }
		],
		[
			'a lid in a fractie, with the seat',
			at('subgraph', bron('member'), 'MEMBER_OF', hull('faction'), {}),
			{ place: 'member', hull: 'target', seat: true }
		],
		[
			"VVD's stemming: a line to the fractie's anchor, not in its hull",
			at('node', bron('activity'), 'VOTED', hull('faction', true), { focus: 'target' }),
			{ place: 'line', meta: true }
		],
		[
			'a stuk that amends a wet: a line to the wet’s anchor',
			at('node', bron('document'), 'AMENDS', hull('instrument'), { focus: 'source' }),
			{ place: 'line', meta: false, anchor: 'target' }
		],
		[
			'a wet that amends the article in focus: its anchor alone',
			at('node', hull('instrument'), 'AMENDS', bron('article'), { focus: 'target' }),
			{ place: 'none', anchor: 'source' }
		],
		[
			'a stuk that refers to a wet: no member of its hull, and no line',
			at('subgraph', bron('document'), 'REFERS_TO', hull('instrument'), {}),
			{ place: 'none' }
		],
		[
			'on a path, the same stuk ends at the wet’s anchor',
			at('path', bron('document'), 'REFERS_TO', hull('instrument'), {}),
			{ place: 'line', meta: true, anchor: 'target' }
		],
		[
			'a commissie two chosen leden share: a point with a line',
			at('node', bron('member'), 'MEMBER_OF', hull('committee'), { focus: 'source', joins: true }),
			{ place: 'line', meta: true, anchor: 'target' }
		],
		[
			'a dossier two chosen stukken share: its point, and the stukken in its hull',
			at('node', bron('document'), 'PART_OF', hull('dossier'), { focus: 'source', joins: true }),
			{ place: 'member', hull: 'target', seat: false, anchor: 'target' }
		],
		[
			'a bewindspersoon of the cabinet in focus, from Verbonden: in the hull, with the seat',
			at('rows', bron('member'), 'SERVED_IN', hull('committee', true), { focus: 'target' }),
			{ place: 'member', hull: 'target', seat: true }
		],
		[
			'the dossier of the stuk in focus, from Verbonden: the stuk in its hull',
			at('rows', bron('document'), 'PART_OF', hull('dossier', true), { focus: 'source' }),
			{ place: 'member', hull: 'target', seat: false }
		],
		[
			'a semantic verbinding under the threshold: off the canvas',
			at('subgraph', bron('judgment'), 'REFERS_TO', bron('judgment'), { confidence: 0.1 }),
			{ place: 'none' }
		],
		[
			'an article that refers to an article: structural, whatever its confidence',
			at('subgraph', bron('article'), 'REFERS_TO', bron('article'), { confidence: 0.1 }),
			{ place: 'line', meta: true }
		],
		[
			'a neighbour the canvas does not draw (a zaak): off the canvas',
			at('node', bron('document'), 'PART_OF', bron('activity', false), { focus: 'source' }),
			{ place: 'none' }
		]
	])('%s', (_, placement, expected) => expect(placement).toEqual(expected));
});
