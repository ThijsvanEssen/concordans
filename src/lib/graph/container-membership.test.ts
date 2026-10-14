import { describe, expect, it } from 'vitest';
import {
	containerIdFor,
	isDrawnGroup,
	momentOf,
	type ContainerGroup
} from './container-membership';

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

describe('containerIdFor', () => {
	it('groups a law by its BWB id, an act of the EU without one by its key', () => {
		expect(
			containerIdFor({
				collection: 'instruments',
				key: 'bwbr0001854',
				props: { bwb_id: 'BWBR0001854' }
			})
		).toBe('BWBR0001854');
		expect(containerIdFor({ collection: 'instruments', key: '32011l0036', props: {} })).toBe(
			'32011L0036'
		);
	});
});
