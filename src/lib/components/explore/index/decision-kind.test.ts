import { describe, expect, it } from 'vitest';
import { decisionKindFromParam, decisionOutcome, isHammer } from './decision-kind';

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

describe('decisionKindFromParam', () => {
	it('reads a kind as the Kamer writes it, and one of before API 0.52 as its word', () => {
		expect(decisionKindFromParam('Motie')).toBe('Motie');
		expect(decisionKindFromParam('motie')).toBe('Motie');
		expect(decisionKindFromParam('wetsvoorstel')).toBe('Wetgeving');
		expect(decisionKindFromParam('overig')).toBeUndefined();
		expect(decisionKindFromParam('')).toBeUndefined();
	});
});
