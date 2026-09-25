import { describe, expect, it } from 'vitest';
import openapi from '$lib/api/openapi.json';
import {
	OUTCOME_LABEL,
	STAGES,
	STAGE_LABEL,
	TRACK_LABEL,
	isBill,
	isStage,
	stepState,
	type Stage,
	type Track
} from './stages';

// The values the API may send, read from the schema the types were generated from.
const dossier = openapi.components.schemas.DossierSummaryDTO.properties;
const valuesOf = (field: 'current_stage' | 'track' | 'outcome') =>
	dossier[field].anyOf.flatMap((a) => ('enum' in a ? a.enum : []));

describe('dossier labels', () => {
	it.each([
		['current_stage', STAGE_LABEL],
		['outcome', OUTCOME_LABEL]
	] as const)('label every %s of the schema, and nothing else', (field, labels) => {
		expect(Object.keys(labels).sort()).toEqual(valuesOf(field).sort());
	});

	// The track labels also cover the values of the API before and after `overig` was split.
	it('label every track of the schema', () => {
		expect(valuesOf('track').filter((t) => !t || !(t in TRACK_LABEL))).toEqual([]);
	});

	it('orders the stages as the schema does', () => {
		expect(STAGES).toEqual(valuesOf('current_stage'));
		expect(isStage('behandeling')).toBe(true);
		expect(isStage('nota')).toBe(false);
	});

	it('gives stages to a bill only', () => {
		const bills: Track[] = ['wetsvoorstel', 'initiatiefwetsvoorstel', 'begroting', 'verdrag'];
		const others = ['initiatiefnota', 'nota', 'overig', 'eu', 'beleid', null] as (Track | null)[];
		expect(bills.every(isBill)).toBe(true);
		expect(others.some(isBill)).toBe(false);
	});
});

describe('stepState', () => {
	// Dossier 36264: aangenomen, with three stages on record.
	const stages: Stage[] = [
		'wetsvoorstel',
		'nota_naar_aanleiding_van_verslag',
		'amendementen',
		'afgehandeld'
	];
	const states = () => STAGES.map((s) => stepState(s, stages, 'afgehandeld', false));

	it('marks a stage before the furthest one that the data does not record as unknown', () => {
		expect(states()).toEqual([
			'done',
			'unknown',
			'unknown',
			'unknown',
			'done',
			'done',
			'unknown',
			'unknown',
			'active'
		]);
	});

	it('leaves the stages after the current one open', () => {
		expect(stepState('stemming', ['wetsvoorstel', 'mvt'], 'mvt', false)).toBe('open');
		expect(stepState('wetsvoorstel', ['wetsvoorstel', 'mvt'], 'mvt', false)).toBe('done');
		expect(stepState('wetsvoorstel', [], null, false)).toBe('open');
	});

	it('claims no passed stage where the record is complete or unknown', () => {
		// Belastingplan 2027 (37022): amendments a week after Prinsjesdag, no verslag yet.
		const early: Stage[] = ['wetsvoorstel', 'mvt', 'advies_rvs', 'amendementen'];
		expect(stepState('verslag', early, 'amendementen', true)).toBe('open');
		expect(stepState('verslag', early, 'amendementen', null)).toBe('open');
	});
});
