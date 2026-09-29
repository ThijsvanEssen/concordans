import { describe, expect, it } from 'vitest';
import { timelineKind } from './timeline-kind';

describe('timelineKind', () => {
	it('tells the vote on a motie from the motie', () => {
		expect(timelineKind({ kind: 'motie', node_type: 'decision' })).toBe('Stemming over motie');
		expect(timelineKind({ kind: 'Motie', node_type: 'document' })).toBe('Motie');
	});
	it('names a decision without a case kind a Stemming', () => {
		expect(timelineKind({ kind: null, node_type: 'decision' })).toBe('Stemming');
	});
	it('keeps the kind of an activity', () => {
		expect(timelineKind({ kind: 'Procedurevergadering', node_type: 'activity' })).toBe(
			'Procedurevergadering'
		);
	});
});
