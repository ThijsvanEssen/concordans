import { describe, expect, it } from 'vitest';
import openapi from '$lib/api/openapi.json';
import { OUTCOME_LABEL, dossierStatus, kindFromParam, phaseFromParam } from './stages';

// The outcomes the API may send, read from the schema the types were generated from.
const outcomes = openapi.components.schemas.DossierSummaryDTO.properties.outcome.anyOf.flatMap(
	(a) => ('enum' in a ? a.enum : [])
);

describe('dossier phases and outcome', () => {
	it('labels every outcome of the schema, and nothing else', () => {
		expect(Object.keys(OUTCOME_LABEL).sort()).toEqual([...outcomes].sort());
	});

	it('says where a dossier stands: its outcome, else its current phase', () => {
		expect(dossierStatus({ outcome: 'verworpen', current_phase: 'Stemmingen' })).toBe('Verworpen');
		expect(dossierStatus({ current_phase: 'Verslag' })).toBe('Verslag');
		expect(dossierStatus({})).toBeNull();
	});
});

describe('old links', () => {
	it('read a track or stage of before API 0.52 as the Kamer’s word, or leave it out', () => {
		expect(kindFromParam('Wetgeving')).toBe('Wetgeving');
		expect(kindFromParam('wetsvoorstel')).toBe('Wetgeving');
		expect(kindFromParam('structuurvisie')).toBe('PKB/Structuurvisie');
		expect(kindFromParam('beleid')).toBeNull();
		expect(phaseFromParam('mvt')).toBe('Memorie van toelichting');
		expect(phaseFromParam('Stemmingen')).toBe('Stemmingen');
		expect(phaseFromParam('behandeling')).toBeNull();
	});
});
