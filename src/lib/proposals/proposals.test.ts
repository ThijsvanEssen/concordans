import { describe, expect, it } from 'vitest';
import type { InFluxDossier } from '$lib/api/overlays';
import { openDossierName, billIdOf, proposalRows } from './proposals';

const dossier = (over: Partial<InFluxDossier> = {}): InFluxDossier => ({
	id: 'dossiers/33723',
	dossier_number: '33723',
	title: 'Voorstel van wet tot wijziging van Boek 3',
	bill_id: 'documents/16bc127f_3cdf',
	closed_known: true,
	count: 2,
	...over
});

describe('proposals', () => {
	it('names a dossier by its number and its title, as the rest of the site does', () => {
		expect(openDossierName(dossier())).toBe(
			'Dossier 33723 Voorstel van wet tot wijziging van Boek 3'
		);
		expect(openDossierName(dossier({ dossier_number: null, title: null }))).toBe('Dossier');
	});

	it('takes the voorstel of a dossier from its bill, never from anything else', () => {
		expect(billIdOf(dossier())).toBe('documents/16bc127f_3cdf');
		expect(billIdOf(dossier({ bill_id: null }))).toBeNull();
		expect(billIdOf(dossier({ bill_id: 'instruments/bwbr0001827' }))).toBeNull();
	});

	it('draws a voorstel as a proposed change coming in, and leaves a dossier without bill out', () => {
		const rows = proposalRows([dossier(), dossier({ id: 'dossiers/1', bill_id: null })]);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			ref: { collection: 'documents', key: '16bc127f_3cdf' },
			relation: 'AMENDS',
			direction: 'inbound',
			proposed: true
		});
	});
});
