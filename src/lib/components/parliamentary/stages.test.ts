import { describe, expect, it } from 'vitest';
import openapi from '$lib/api/openapi.json';
import {
	OUTCOME_LABEL,
	STAGES,
	STAGE_LABEL,
	TRACK_LABEL,
	isBill,
	isStage,
	type Track
} from './stages';

// The values the API may send, read from the schema the types were generated from.
const dossier = openapi.components.schemas.DossierSummaryDTO.properties;
const valuesOf = (field: 'current_stage' | 'track' | 'outcome') =>
	dossier[field].anyOf.flatMap((a) => ('enum' in a ? a.enum : []));

describe('dossier labels', () => {
	it.each([
		['current_stage', STAGE_LABEL],
		['track', TRACK_LABEL],
		['outcome', OUTCOME_LABEL]
	] as const)('label every %s of the schema, and nothing else', (field, labels) => {
		expect(Object.keys(labels).sort()).toEqual(valuesOf(field).sort());
	});

	it('orders the stages as the schema does', () => {
		expect(STAGES).toEqual(valuesOf('current_stage'));
		expect(isStage('behandeling')).toBe(true);
		expect(isStage('nota')).toBe(false);
	});

	it('gives stages to a bill only', () => {
		const bills: Track[] = ['wetsvoorstel', 'initiatiefwetsvoorstel', 'begroting', 'verdrag'];
		const others: (Track | null)[] = ['initiatiefnota', 'motie', 'overig', null];
		expect(bills.every(isBill)).toBe(true);
		expect(others.some(isBill)).toBe(false);
	});
});
