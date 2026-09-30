import { describe, expect, it } from 'vitest';
import { isDrawnGroup, momentOf, type ContainerGroup } from './container-membership';
import { periodLabel } from '$lib/verbonden/rows';

const lid = 'members/jetten';
const group = (id: string, from: string | null, to: string | null): ContainerGroup => ({
	kind: 'committee',
	id,
	label: '',
	fullLabel: '',
	members: new Set([lid]),
	parts: new Set(),
	periods: new Map([[lid, { from, to }]])
});

const lnv = group('committees/lnv', '2017-11-14', '2021-04-06');
const iv = group('committees/iv', '2025-11-12', '2026-02-09');

describe('momentOf', () => {
	it('is the end of the last seat for someone who no longer sits', () => {
		expect(momentOf(lid, [lnv, iv], '2026-09-24')).toEqual({
			from: '2026-02-09',
			to: '2026-02-09'
		});
	});

	it('is today for someone who still sits', () => {
		const now = group('committees/biza', '2025-11-12', null);
		expect(momentOf(lid, [lnv, now], '2026-09-24')).toEqual({
			from: '2026-09-24',
			to: '2026-09-24'
		});
	});
});

describe('isDrawnGroup', () => {
	it('draws the commissies of the lid for the period only', () => {
		const moment = { from: '2026-02-09', to: '2026-02-09' };
		expect(isDrawnGroup(iv, null, lid, moment)).toBe(true);
		expect(isDrawnGroup(lnv, null, lid, moment)).toBe(false);
		expect(isDrawnGroup(lnv, null, lid, { from: '2019-01-01', to: '2019-12-31' })).toBe(true);
		expect(isDrawnGroup(lnv, null, null, moment)).toBe(true);
	});

	it('draws a dossier for its own stukken or as the focus', () => {
		const dossier: ContainerGroup = {
			...lnv,
			kind: 'dossier',
			id: 'dossiers/1',
			periods: new Map()
		};
		expect(isDrawnGroup(dossier, null)).toBe(false);
		expect(isDrawnGroup(dossier, 'dossiers/1')).toBe(true);
		expect(isDrawnGroup({ ...dossier, parts: new Set(['documents/a']) }, null)).toBe(true);
	});
});

describe('periodLabel', () => {
	it('writes a seat as years, with a role other than plain membership', () => {
		expect(periodLabel({ from: '2017-11-14', to: '2021-04-06', role: null })).toBe('2017–2021');
		expect(periodLabel({ from: '2025-11-12', to: null, role: 'Lid' })).toBe('sinds 2025');
		expect(periodLabel({ from: '2023-12-06', to: '2026-02-09', role: 'Fractievoorzitter' })).toBe(
			'fractievoorzitter, 2023–2026'
		);
		// The end date is the last day of the seat (TotEnMet).
		expect(periodLabel({ from: null, to: '2026-06-09', role: null })).toBe('tot en met 2026');
	});
});
