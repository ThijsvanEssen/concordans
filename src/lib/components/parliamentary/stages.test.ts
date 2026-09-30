import { describe, expect, it } from 'vitest';
import openapi from '$lib/api/openapi.json';
import {
	openedOnBasis,
	OUTCOME_LABEL,
	PHASES,
	PHASE_SHORT,
	dossierStatus,
	kindFromParam,
	phaseFromParam,
	stepState
} from './stages';

// The outcomes the API may send, read from the schema the types were generated from.
const outcomes = openapi.components.schemas.DossierSummaryDTO.properties.outcome.anyOf.flatMap(
	(a) => ('enum' in a ? a.enum : [])
);

describe('dossier phases and outcome', () => {
	it('labels every outcome of the schema, and nothing else', () => {
		expect(Object.keys(OUTCOME_LABEL).sort()).toEqual([...outcomes].sort());
	});

	it('has a short word for every phase', () => {
		expect(PHASES.filter((p) => !PHASE_SHORT[p])).toEqual([]);
	});

	it('says where a dossier stands: its outcome, else its current phase', () => {
		expect(dossierStatus({ outcome: 'verworpen', current_phase: 'Stemmingen' })).toBe('Verworpen');
		expect(dossierStatus({ current_phase: 'Verslag' })).toBe('Verslag');
		expect(dossierStatus({})).toBeNull();
	});
});

describe('stepState', () => {
	const phase = (name: string, done: boolean) => ({
		name,
		chamber: 'TK' as const,
		done,
		date: null
	});

	it('lights the current phase, the ones a record marks, and assumes nothing else', () => {
		expect(stepState(phase('Verslag', true), 'Verslag')).toBe('active');
		expect(stepState(phase('Voorstel van wet', true), 'Verslag')).toBe('done');
		// Nothing marks the advice, though a later phase is done: it stays open.
		expect(stepState(phase('Advies Raad van State', false), 'Verslag')).toBe('open');
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

describe('openedOnBasis', () => {
	it('says what the opening date is the date of, and nothing for none', () => {
		expect(openedOnBasis('first_paper')).toBe('Datum van nr. 1 van het dossier');
		expect(openedOnBasis('royal_message')).toBe('Datum van de Koninklijke boodschap');
		expect(openedOnBasis(null)).toBeUndefined();
	});
});
