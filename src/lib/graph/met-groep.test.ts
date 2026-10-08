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

// Dossier D (its own bron d) holds stukken s1 to s3; s2 is in commissie C too.
const groups = [group('dossier', 'D', ['d', 's1', 's2', 's3']), group('committee', 'C', ['s2'])];
const run = (uit: string[], houd: string[] = []) =>
	metGroepVerborgen({ groups, uit: new Set(uit), houd: (id) => houd.includes(id) });

describe('metGroepVerborgen', () => {
	it('hides everything in a grouping that is off, chosen or with a line of its own', () => {
		expect([...run(['dossier']).keys()].sort()).toEqual(['d', 's1', 's3']);
	});

	it('keeps a bron that is in a grouping still on, and the focus', () => {
		expect(run(['dossier']).has('s2')).toBe(false);
		expect(run(['dossier', 'committee']).get('s2')).toBe('dossier');
		expect(run(['dossier'], ['s1']).has('s1')).toBe(false);
	});

	it('hides nothing while every grouping is on', () => {
		expect(run([]).size).toBe(0);
	});
});
