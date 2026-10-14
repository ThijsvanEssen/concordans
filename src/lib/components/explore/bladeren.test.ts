import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nog, verderLabel, volgendeBladzijden, vorigeBladzijde } from './bladeren';

describe('bladeren', () => {
	it('labels both ways alike', () => {
		expect(verderLabel('vorige', '12')).toBe('Vorige artikelen, nog 12');
		expect(verderLabel('volgende', '1.234')).toBe('Volgende artikelen, nog 1.234');
	});

	it('counts what lies before and after the shown range', () => {
		expect(nog('vorige', 250, 40, 900)).toBe(250);
		expect(nog('volgende', 250, 40, 900)).toBe(610);
		expect(nog('vorige', 0, 40, 40)).toBe(0);
		expect(nog('volgende', 0, 40, 30)).toBe(0);
	});

	it('takes the previous page right before the start, never past the first article', () => {
		expect(vorigeBladzijde(250, 100)).toEqual({ offset: 150, limit: 100 });
		expect(vorigeBladzijde(30, 100)).toEqual({ offset: 0, limit: 30 });
		expect(vorigeBladzijde(100, 100)).toEqual({ offset: 0, limit: 100 });
	});

	it('takes the next page, or every page up to a place', () => {
		expect(volgendeBladzijden(100, 0, 900, 100)).toEqual([100]);
		expect(volgendeBladzijden(100, 350, 900, 100)).toEqual([100, 200, 300]);
		expect(volgendeBladzijden(100, 5000, 250, 100)).toEqual([100, 200]);
	});

	// Equal controls, one piece: the reader draws both from the one snippet and label.
	it('the whole-law reader draws Vorige and Volgende from the one control', () => {
		const src = readFileSync(join(__dirname, 'WholeLawReader.svelte'), 'utf8');
		expect(src).not.toMatch(/(Vorige|Volgende) artikelen/);
		expect(src.match(/\{#snippet verder\(/g)).toHaveLength(1);
		expect(src).toContain("{@render verder('vorige')}");
		expect(src).toContain("{@render verder('volgende')}");
	});
});
