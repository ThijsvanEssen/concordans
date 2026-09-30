import { describe, expect, it } from 'vitest';
import { timelineKind } from './timeline-kind';

describe('timelineKind', () => {
	it('tells the vote on a motie from the motie', () => {
		expect(timelineKind({ kind: 'motie', node_type: 'decision' })).toBe(
			'Stemming Tweede Kamer, over motie'
		);
		expect(timelineKind({ kind: 'Motie', node_type: 'document' })).toBe('Motie');
	});
	it('names a decision without a case kind a Stemming of its Kamer', () => {
		expect(timelineKind({ kind: null, node_type: 'decision' })).toBe('Stemming Tweede Kamer');
		expect(timelineKind({ kind: 'Stemming', node_type: 'decision' })).toBe('Stemming Tweede Kamer');
	});
	it('names a vote of the Eerste Kamer as such', () => {
		expect(
			timelineKind({
				kind: 'Stemming',
				node_type: 'decision',
				node_id: 'decisions/ek_2026_09_29_36745_1'
			})
		).toBe('Stemming Eerste Kamer');
	});
	it('keeps the kind of an activity', () => {
		expect(timelineKind({ kind: 'Procedurevergadering', node_type: 'activity' })).toBe(
			'Procedurevergadering'
		);
	});
});
