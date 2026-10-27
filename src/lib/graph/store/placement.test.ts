import { describe, expect, it } from 'vitest';
import type { ContainerKind } from '../container-membership';
import type { DrawClass } from '../types';
import type { Relation } from '$lib/vocabulary';
import { placeConnection, type End, type Placement } from './placement';

const bron = (drawClass: DrawClass, drawn = true): End => ({ hull: null, drawn, drawClass });
const hull = (h: ContainerKind, drawn = false): End => ({ hull: h, drawn, drawClass: h });
/** A container the reader chose, or chosen bronnen share. */
const tying = (h: ContainerKind): End => ({ ...hull(h), ties: true });

const at = (source: End, relation: Relation, target: End, confidence?: number): Placement =>
	placeConnection({ relation, source, target, confidence, threshold: 0.6 });

describe('where a verbinding lands', () => {
	it.each<[string, Placement, Placement]>([
		[
			'a stuk in its dossier: in the hull, without a line',
			at(bron('document'), 'PART_OF', hull('dossier')),
			{ place: 'member', hull: 'target', seat: true }
		],
		[
			'a lid in a fractie, with the seat',
			at(bron('member'), 'MEMBER_OF', hull('faction')),
			{ place: 'member', hull: 'target', seat: true }
		],
		[
			"VVD's stemming: a line to the fractie's anchor, not in its hull",
			at(bron('activity'), 'VOTED', hull('faction', true)),
			{ place: 'line', meta: true }
		],
		[
			'a stuk that amends a wet: a line to the wet’s anchor',
			at(bron('document'), 'AMENDS', hull('instrument')),
			{ place: 'line', meta: false, anchor: 'target' }
		],
		[
			'a stuk that amends the wet in focus: a line with its meta',
			at(bron('document'), 'AMENDS', hull('instrument', true)),
			{ place: 'line', meta: true }
		],
		[
			'a wet that amends the article in focus: its anchor alone',
			at(hull('instrument'), 'AMENDS', bron('article')),
			{ place: 'none', anchor: 'source' }
		],
		[
			'what became of an old article, to the new law in focus: nothing drawn',
			at(bron('article'), 'TRANSPOSED_TO', hull('instrument', true)),
			{ place: 'none' }
		],
		[
			'an old article in the place of a new one: a line',
			at(bron('article'), 'TRANSPOSED_TO', bron('article')),
			{ place: 'line', meta: true }
		],
		[
			'a stuk that refers to a wet: no member of its hull, and no line',
			at(bron('document'), 'REFERS_TO', hull('instrument')),
			{ place: 'none' }
		],
		[
			'on a path, the same stuk ends at the wet’s anchor',
			at(bron('document'), 'REFERS_TO', tying('instrument')),
			{ place: 'line', meta: true, anchor: 'target' }
		],
		[
			'a commissie two chosen leden share: a point with a line',
			at(bron('member'), 'MEMBER_OF', tying('committee')),
			{ place: 'line', meta: true, anchor: 'target' }
		],
		[
			'a dossier two chosen stukken share: its point, and the stukken in its hull',
			at(bron('document'), 'PART_OF', tying('dossier')),
			{ place: 'member', hull: 'target', seat: false, anchor: 'target' }
		],
		[
			'a bewindspersoon of the cabinet in focus, from Verbonden: in the hull, with the seat',
			at(bron('member'), 'SERVED_IN', hull('committee', true)),
			{ place: 'member', hull: 'target', seat: true }
		],
		[
			'a semantic verbinding under the threshold: off the canvas',
			at(bron('judgment'), 'REFERS_TO', bron('judgment'), 0.1),
			{ place: 'none' }
		],
		[
			'an article that refers to an article: structural, whatever its confidence',
			at(bron('article'), 'REFERS_TO', bron('article'), 0.1),
			{ place: 'line', meta: true }
		],
		[
			'a neighbour the canvas does not draw (a zaak): off the canvas',
			at(bron('document'), 'PART_OF', bron('activity', false)),
			{ place: 'none' }
		]
	])('%s', (_, placement, expected) => expect(placement).toEqual(expected));
});

describe('a publication of the Staatsblad (Netwerkcanvas, Staatsblad-publicatie)', () => {
	const publicatie: End = { ...hull('instrument'), publication: true };

	it('draws a line to the wet it changes, where an amending act is drawn without one', () => {
		expect(at(publicatie, 'AMENDS', bron('article'))).toEqual({
			place: 'line',
			meta: false,
			anchor: 'source'
		});
		expect(at(publicatie, 'REPEALS', bron('article'))).toMatchObject({ place: 'line' });
		expect(at(hull('instrument'), 'AMENDS', bron('article'))).toEqual({
			place: 'none',
			anchor: 'source'
		});
	});

	it('does not put it in its dossier’s outline: the dossier is a line to it, aangenomen als', () => {
		expect(at({ ...publicatie, drawn: true }, 'LEGISLATED_IN', hull('dossier', true))).toEqual({
			place: 'line',
			meta: true
		});
		expect(at({ ...publicatie, drawn: true }, 'LEGISLATED_IN', hull('dossier'))).toEqual({
			place: 'line',
			meta: true,
			anchor: 'target'
		});
	});
});
