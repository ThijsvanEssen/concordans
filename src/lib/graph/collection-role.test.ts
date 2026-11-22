import { describe, expect, it } from 'vitest';
import { NODE_TYPES, type Collection } from '$lib/vocabulary';
import { COLLECTION_ROLE, GROUP_LABEL, isDrawn } from './collection-role';
import { containerKindOf, focusKindOf } from './container-membership';
import { drawClassOf } from './types';

// The role of every collection, as the canvas has it: its kind, the hull it is drawn as
// (a cabinet as a commissie's), and whether it is asked and drawn as a neighbour of a focus.
const ROLES: Record<Collection, [string, string | null, boolean]> = {
	instruments: ['instrument', 'instrument', true],
	instrument_versions: ['other', null, false],
	articles: ['article', null, true],
	article_versions: ['other', null, false],
	annexes: ['other', null, true],
	judgments: ['judgment', null, true],
	dossiers: ['dossier', 'dossier', true],
	cases: ['activity', null, false],
	documents: ['document', null, true],
	activities: ['activity', null, true],
	decisions: ['activity', null, true],
	commitments: ['activity', null, true],
	members: ['member', null, true],
	factions: ['faction', 'faction', true],
	committees: ['committee', 'committee', true],
	cabinets: ['cabinet', 'cabinet', true],
	ministries: ['cabinet', null, true]
};

describe('the role of a collection', () => {
	it('is one row per collection, read by every place that asks', () => {
		for (const c of Object.keys(NODE_TYPES) as Collection[]) {
			const [kind, hull, neighbour] = ROLES[c];
			expect([drawClassOf(c), containerKindOf(c)], c).toEqual([kind, hull]);
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
