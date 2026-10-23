// The rules of text the API applies as well, against text-rules.json (the same file is
// tests/data/text-rules.json in lawgraph, tested there by test_text_rules.py): a word found
// from its start and a short one whole, a long date, the anchors of a breadcrumb, the length
// of a summary.
import { describe, expect, it } from 'vitest';
import rules from './text-rules.json';
import { KORT, markeer } from './treffer';
import { langeDatum } from './datum';
import { deelIds } from './division';
import { PREVIEW_CHARS } from '$lib/bron/preview';

describe('text-rules.json', () => {
	it('matches a word of up to whole_word_max characters whole', () => {
		expect(KORT).toBe(rules.whole_word_max);
	});

	it.each(rules.words)('finds $q in "$text": $found', ({ q, text, found }) => {
		expect(markeer([q], text) !== null).toBe(found);
	});

	it.each(rules.long_dates)('writes $iso as "$text"', ({ iso, text }) => {
		// The API writes the plain spaces; the page keeps a date on one line with no-break ones.
		expect(langeDatum(iso).replaceAll('\u00a0', ' ')).toBe(text);
	});

	it.each(rules.division_anchors)('anchors $anchors', ({ breadcrumb, anchors }) => {
		expect(deelIds(breadcrumb)).toEqual(anchors);
	});

	it('cuts a card at the length the API cuts a summary', () => {
		expect(PREVIEW_CHARS).toBe(rules.summary_chars);
	});
});
