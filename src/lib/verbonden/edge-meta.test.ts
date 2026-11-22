// Guard: the lid, place and phrase of one edge's meta are read in one place (code-eenvoud F15).
import { describe, expect, it } from 'vitest';
import { parseOutcome, readEdge, readTranspositionOutcome } from './edge-meta';

describe('readEdge', () => {
	it('reads the lid from the leden, then the lid, then the phrase', () => {
		const lid = (meta: Record<string, unknown>) =>
			readEdge(meta, { direction: 'inbound', citingEcli: null }).lid;
		expect(lid({ leden: ['4'], lid: '6', raw_match: 'tweede lid' })).toBe('4');
		expect(lid({ lid: '6', raw_match: 'tweede lid' })).toBe('6');
		expect(lid({ raw_match: 'tweede lid' })).toBe('2');
		expect(lid({ qualifier: 'derde lid' })).toBe('3');
		// Of an outbound edge the phrase names the other end's lid, not the selected one's.
		expect(
			readEdge({ raw_match: 'tweede lid' }, { direction: 'outbound', citingEcli: null }).lid
		).toBe(null);
	});

	it('cites r.o. 6 and 7 with the anchor of the first', () => {
		const e = readEdge(
			{ paragraphs: ['6', '7'] },
			{ direction: 'inbound', citingEcli: 'ECLI:NL:HR:2019:2006' }
		);
		expect([e.position, e.at]).toEqual(['r.o. 6 en 7', 'rov-6']);
	});
});

describe('readTranspositionOutcome (lawgraph #860)', () => {
	it('reads what the table says of an old article it places in no article', () => {
		expect(parseOutcome('vervallen')).toEqual({ kind: 'vervallen', law: null });
		expect(parseOutcome('niet_overgenomen')).toEqual({ kind: 'niet_overgenomen', law: null });
		expect(parseOutcome('blijft_in:Waterwet')).toEqual({ kind: 'blijft_in', law: 'Waterwet' });
		expect(parseOutcome('gat')).toEqual({ kind: 'gat', law: null });
		expect(parseOutcome('iets nieuws')).toBeNull();
	});

	it('reads the other law a part goes to without an article (lawgraph #879)', () => {
		expect(parseOutcome('naar:Gratiewet')).toEqual({ kind: 'naar', law: 'Gratiewet' });
		expect(parseOutcome('naar:Wetboek van Strafrecht')).toEqual({
			kind: 'naar',
			law: 'Wetboek van Strafrecht'
		});
		expect(parseOutcome('naar:')).toBeNull();
		expect(
			readTranspositionOutcome({
				outcome: 'naar:Omgevingswet',
				parts: [{ from: '', to: 'later', outcome: 'naar:Omgevingswet' }]
			}).parts
		).toEqual([{ from: '', to: 'later', outcome: { kind: 'naar', law: 'Omgevingswet' } }]);
		expect(parseOutcome(undefined)).toBeNull();
	});

	it('reads the parts, each with its own outcome, and the source', () => {
		expect(
			readTranspositionOutcome({
				basis: 'transposition_table',
				source: 'blg-1081574',
				outcome: 'gat',
				parts: [
					{ from: '1', to: 'vervallen (mvt)', outcome: 'vervallen' },
					{ from: '2', to: 'Besluit B2', outcome: 'gat' }
				]
			})
		).toEqual({
			outcome: { kind: 'gat', law: null },
			parts: [
				{ from: '1', to: 'vervallen (mvt)', outcome: { kind: 'vervallen', law: null } },
				{ from: '2', to: 'Besluit B2', outcome: { kind: 'gat', law: null } }
			],
			source: 'blg-1081574'
		});
		expect(readTranspositionOutcome(null)).toEqual({ outcome: null, parts: [], source: null });
	});
});
