import { describe, expect, it } from 'vitest';
import {
	decisionMethod,
	decisionOutcome,
	decisionResult,
	isHammer,
	uitslag
} from '$lib/votes/decision-kind';

describe('decisionOutcome', () => {
	it('names a vote, a hamerstuk and a decision that is no vote', () => {
		expect(decisionOutcome({ passed: true, decision_kind: 'Stemmen - aangenomen' })).toBe(
			'Aangenomen'
		);
		expect(decisionOutcome({ passed: false, decision_kind: 'Stemmen - verworpen' })).toBe(
			'Verworpen'
		);
		const hammer = {
			kind: null,
			passed: true,
			decision_kind: 'Stemmen - zonder stemming aannemen'
		};
		expect(isHammer(hammer)).toBe(true);
		expect(decisionOutcome(hammer)).toBe('Aangenomen zonder stemming');
		expect(decisionOutcome({ passed: null, decision_kind: 'Stemmen - uitstellen' })).toBe(
			'Uitgesteld'
		);
		expect(decisionOutcome({ decision_kind: null, passed: null })).toBeNull();
	});
});

describe('decisionResult', () => {
	it('passes a vote won and a hamerstuk, rejects a vote lost, and decides nothing else', () => {
		expect(decisionResult({ passed: true })).toBe('aangenomen');
		expect(
			decisionResult({ passed: null, decision_kind: 'Stemmen - zonder stemming aannemen' })
		).toBe('aangenomen');
		expect(decisionResult({ passed: false })).toBe('verworpen');
		expect(decisionResult({ passed: null, decision_kind: 'Stemmen - aangenomen' })).toBe(
			'aangenomen'
		);
		expect(decisionResult({ passed: null, decision_kind: 'Stemmen - verworpen' })).toBe(
			'verworpen'
		);
		expect(decisionResult({ passed: null, decision_kind: 'Stemmen - uitstellen' })).toBeNull();
		expect(decisionResult({ passed: null })).toBeNull();
	});
});

describe('decisionMethod', () => {
	it('takes the Eerste Kamer’s method without the outcome it adds', () => {
		expect(decisionMethod({ method: 'Stemming bij zitten en opstaan, aangenomen' })).toBe(
			'Stemming bij zitten en opstaan'
		);
		expect(decisionMethod({ method: 'Hamerstuk' })).toBe('Hamerstuk');
		expect(decisionMethod({ method: null })).toBeNull();
	});
});

describe('uitslag', () => {
	it('reads passed, the result of the Eerste Kamer and a hamerstuk alike', () => {
		expect(uitslag({ passed: true }).passed).toBe(true);
		expect(uitslag({ passed: false }).passed).toBe(false);
		expect(uitslag({ passed: null, result: 'Aangenomen' }).passed).toBe(true);
		expect(uitslag({ passed: null, result: 'Verworpen' }).passed).toBe(false);
		expect(uitslag({ passed: null, decision_kind: 'Stemmen - zonder stemming aannemen' })).toEqual({
			passed: true,
			hammer: true,
			word: 'aangenomen zonder stemming'
		});
	});

	it('gives no outcome for a postponed vote (36799, 22\u00a0september\u00a02026)', () => {
		expect(uitslag({ passed: null, result: null }).passed).toBeNull();
		expect(uitslag({})).toEqual({ passed: null, hammer: false, word: null });
	});

	it('names a decision that is no vote as the Kamer decided, never "gestemd"', () => {
		const word = (decision_kind: string) => uitslag({ passed: null, decision_kind }).word;
		expect(word('Stemmen - ingetrokken')).toBe('ingetrokken');
		expect(word('Aanhouden')).toBe('aangehouden');
		expect(word('Stemmen - aangehouden')).toBe('aangehouden');
		expect(word('Stemmen - uitstellen')).toBe('uitgesteld');
		expect(word('Vervallen')).toBe('vervallen');
		expect(word('Stemmen')).toBeNull();
	});
});
