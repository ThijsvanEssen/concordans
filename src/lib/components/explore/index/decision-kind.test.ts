import { describe, expect, it } from 'vitest';
import { decisionMethod, decisionOutcome, decisionResult, isHammer } from './decision-kind';

describe('decisionOutcome', () => {
	it('names a vote, a hamerstuk and a decision that is no vote', () => {
		expect(decisionOutcome({ passed: true, decision_kind: 'Stemmen - aangenomen' })).toBe(
			'Aangenomen'
		);
		expect(decisionOutcome({ passed: false, decision_kind: 'Stemmen - verworpen' })).toBe(
			'Verworpen'
		);
		const hammer = { passed: true, decision_kind: 'Stemmen - zonder stemming aannemen' };
		expect(isHammer(hammer)).toBe(true);
		expect(decisionOutcome(hammer)).toBe('Zonder stemming aangenomen');
		expect(decisionOutcome({ passed: null, decision_kind: 'Stemmen - uitstellen' })).toBe(
			'Uitstellen'
		);
		expect(decisionOutcome({ passed: null })).toBeNull();
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
