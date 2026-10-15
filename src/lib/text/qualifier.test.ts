import { describe, expect, it } from 'vitest';
import hr1769 from '$lib/fixtures/judgment-hr-2024-1769.json';
import { anchorOf, parseQualifier } from './qualifier';

describe('parseQualifier', () => {
	it.each([
		['artikel 28, eerste lid Sv', '', 'lid-1'],
		['art. 27c lid 2 Sv', '', 'lid-2'],
		['artikel 6 lid 1 EVRM', '', 'lid-1'],
		['139d', ', eerste en tweede lid, 139g, 140, tweede lid', 'lid-1'],
		['artikel 416', ', tweede lid, van het Wetboek van Strafvordering', 'lid-2'],
		['artikel 7', ', eerste lid, onderdelen a en c, van de Wegenverkeerswet 1994', 'lid-1-onder-a'],
		['art. 359a lid 1 onder b Sv', '', 'lid-1-onder-b'],
		['artikel 47, eerste lid, onder 1°', '', 'lid-1-onder-1'],
		['artikel 1, aanhef en onder a', '', 'onder-a'],
		['artikel 3', ', aanhef, van de wet', 'aanhef']
	])('%s%s → %s', (span, following, anchor) => {
		expect(anchorOf(parseQualifier(span, following))).toBe(anchor);
	});

	it('does not take a qualifier that belongs to the next reference', () => {
		expect(parseQualifier('132', ', 138a, 138aa, 139d, eerste en tweede lid')).toBeNull();
		expect(parseQualifier('art. 359a Sv', ' en het tweede lid van art. 27 Sv')).toBeNull();
	});

	it('reads the spans of a real judgment', () => {
		const paragraph = hr1769.judgment.paragraphs[0];
		const found = paragraph.citations.map((c) =>
			anchorOf(parseQualifier(c.text ?? '', paragraph.text.slice(c.end!, c.end! + 80)))
		);
		expect(found).toContain('lid-2');
		expect(found).toContain(null);
	});
});
