import { describe, expect, it } from 'vitest';
import { NODE_TYPES, type Collection } from '$lib/vocabulary';
import { kolomVan } from '$lib/selection/kolommen';
import { COLLECTION_ROLE, GROUP_LABEL, isDrawn } from './collection-role';
import { containerKindOf, focusKindOf } from './container-membership';
import { drawClassOf } from './types';

// The role of every collection, as the canvas has it: its kind, the hull it is drawn as
// (a cabinet as a commissie's), whether it is asked and drawn as a neighbour of a focus,
// and its column in a netwerk's first layout.
const ROLES: Record<Collection, [string, string | null, boolean, 0 | 1 | 2]> = {
	instruments: ['instrument', 'instrument', true, 1],
	instrument_versions: ['other', null, false, 1],
	articles: ['article', null, true, 1],
	article_versions: ['other', null, false, 1],
	annexes: ['other', null, true, 1],
	judgments: ['judgment', null, true, 2],
	dossiers: ['dossier', 'dossier', true, 0],
	cases: ['activity', null, false, 0],
	documents: ['document', null, true, 0],
	activities: ['activity', null, true, 0],
	decisions: ['activity', null, true, 0],
	commitments: ['activity', null, true, 0],
	members: ['member', null, true, 0],
	factions: ['faction', 'faction', true, 0],
	committees: ['committee', 'committee', true, 0],
	cabinets: ['cabinet', 'cabinet', true, 0],
	ministries: ['cabinet', null, true, 0]
};

describe('the role of a collection', () => {
	it('is one row per collection, read by every place that asks', () => {
		for (const c of Object.keys(NODE_TYPES) as Collection[]) {
			const [kind, hull, neighbour, column] = ROLES[c];
			expect([drawClassOf(c), containerKindOf(c), kolomVan(c)], c).toEqual([kind, hull, column]);
			expect(COLLECTION_ROLE[c].neighbour, c).toBe(neighbour);
		}
	});

	it('draws a ministerie in focus as the hull of its bewindspersonen, as a neighbour as none (N5)', () => {
		expect(focusKindOf('ministries')).toBe('cabinet');
		expect(containerKindOf('ministries')).toBeNull();
		for (const c of Object.keys(NODE_TYPES) as Collection[])
			if (c !== 'ministries') expect(focusKindOf(c), c).toBe(containerKindOf(c));
	});

	it('names a hull as its collection is named', () => {
		expect(GROUP_LABEL).toEqual({
			instrument: 'Wet of regeling',
			faction: 'Fractie',
			committee: 'Commissie',
			cabinet: 'Kabinet',
			dossier: 'Dossier'
		});
	});

	it('draws no VERSION_OF: the reader’s version navigation, not the network’s', () => {
		expect(isDrawn('VERSION_OF')).toBe(false);
	});
});
