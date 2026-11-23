import { describe, expect, it } from 'vitest';
import { getalRijen, getallenIn, stapTekst, vorigeStap, type Getal } from './getallen';

const stap = (value: number | null, valid_from: string, selected = false) => ({
	version_key: valid_from,
	valid_from,
	valid_until: null,
	value,
	date: null,
	selected
});
const getal = (over: Partial<Getal> = {}): Getal => ({
	kind: 'bedrag',
	unit: 'EUR',
	text: '€ 3.115',
	part: 'lid-2-onder-a',
	start: 4,
	end: 11,
	source: 'text',
	cell: null,
	history: [stap(3070, '2025-01-01'), stap(3115, '2026-01-01', true)],
	...over
});

describe('stapTekst', () => {
	it('writes each unit as the law does', () => {
		expect(stapTekst('EUR', stap(3115, ''))).toBe('€ 3.115');
		expect(stapTekst('EUR', stap(14.99, ''))).toBe('€ 14,99');
		expect(stapTekst('%', stap(12.5, ''))).toBe('12,5%');
		expect(stapTekst('week', stap(1, ''))).toBe('1 week');
		expect(stapTekst('werkdag', stap(6, ''))).toBe('6 werkdagen');
		expect(stapTekst('datum', { value: null, date: '2026-07-01' })).toBe('1 juli 2026');
		expect(stapTekst('datum', { value: null, date: '--07-01' })).toBe('1 juli');
		expect(stapTekst('EUR', stap(null, ''))).toBeNull();
	});
});

describe('vorigeStap', () => {
	it('is the step before the one read, none at the first', () => {
		expect(vorigeStap(getal())?.value).toBe(3070);
		expect(vorigeStap(getal({ history: [stap(1, '2026-01-01', true)] }))).toBeNull();
	});
});

describe('getallenIn', () => {
	it('keeps only the numbers the text holds where they are said to stand', () => {
		const text = 'Het € 3.115 is';
		expect(getallenIn(text, [getal({ start: 4, end: 11 })])).toHaveLength(1);
		expect(getallenIn(text, [getal({ start: 0, end: 7 })])).toHaveLength(0);
		expect(getallenIn(text, null)).toEqual([]);
	});
	it('reads a no-break space as a space', () => {
		expect(getallenIn('€ 3.115', [getal({ start: 0, end: 7 })])).toHaveLength(1);
	});
});

describe('getalRijen', () => {
	it('gives each number its place and its course, oldest first', () => {
		const [rij] = getalRijen([getal()]);
		expect(rij.plaats).toBe('lid 2, onder a');
		expect(rij.soort).toBe('Bedrag');
		expect(rij.verloop.map((v) => [v.tekst, v.gekozen])).toEqual([
			['€ 3.070', false],
			['€ 3.115', true]
		]);
		expect(rij.verloop[0].vanaf).toBe('vanaf 1 januari 2025');
	});
});
