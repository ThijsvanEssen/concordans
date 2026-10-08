import { describe, expect, it } from 'vitest';
import type { ContainerGroup, ContainerKind } from './container-membership';
import { metGroepVerborgen } from './met-groep';

const group = (kind: ContainerKind, id: string, members: string[]): ContainerGroup => ({
	kind,
	id,
	label: id,
	fullLabel: id,
	members: new Set(members),
	parts: new Set(members),
	periods: new Map()
});

// Dossier D (its own bron d) holds stukken s1 to s4; s3 also changes the focus f; s2 is in
// commissie C too; s1 changes law l, which is in view through D as well.
const lines: Record<string, string[]> = {
	d: ['s1', 's2', 's3', 's4'],
	s1: ['d', 'l'],
	s2: ['d'],
	s3: ['d', 'f'],
	s4: ['d'],
	f: ['s3'],
	l: ['s1']
};
const run = (uit: string[], houd: string[] = ['f']) =>
	metGroepVerborgen({
		groups: [group('dossier', 'D', ['d', 's1', 's2', 's3', 's4']), group('committee', 'C', ['s2'])],
		uit: new Set(uit),
		houd: (id) => houd.includes(id),
		buren: (id) => lines[id] ?? [],
		anker: (id) => id === 'd'
	});

describe('metGroepVerborgen', () => {
	it('hides what is in the grouping, keeps a bron with a line of its own to the focus', () => {
		expect([...run(['dossier']).keys()].sort()).toEqual(['d', 's1', 's4']);
	});

	it('keeps a bron that is in a grouping still on', () => {
		expect(run(['dossier']).has('s2')).toBe(false);
		expect(run(['dossier', 'committee']).get('s2')).toBe('dossier');
	});

	it('takes the focused dossier itself for no route: its stukken go with it', () => {
		const focused = run(['dossier'], ['d']);
		expect([...focused.keys()].sort()).toEqual(['s1', 's2', 's3', 's4'].filter((s) => s !== 's2'));
	});

	it('hides nothing while every grouping is on', () => {
		expect(run([]).size).toBe(0);
	});
});
