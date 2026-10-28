import { describe, expect, it } from 'vitest';
import {
	LIGHT_CONTRAST,
	LINE_CONTRAST,
	TONE_WINDOW,
	contrast,
	floorStrength,
	lineStrength,
	mixed,
	toneStrength
} from './line-strength';
import { LINE_KINDS, LINE_KIND_STYLE, type Tone } from './line-kind';
import { FALLBACK } from '$lib/components/graph/nodeSprites';

const paper = FALLBACK.paper;
const colours = [
	FALLBACK.moss,
	FALLBACK.rubriekWetten,
	FALLBACK.slate,
	FALLBACK.plum,
	FALLBACK.ink3
];

describe('the strength of a line at rest', () => {
	it('keeps every line of a chosen bron at 3:1 against the paper, however many there are', () => {
		for (const colour of colours)
			for (const tone of Object.keys(TONE_WINDOW) as Tone[])
				for (const n of [1, 9, 50, 200, 5000]) {
					const drawn = mixed(colour, paper, lineStrength(colour, paper, tone, n));
					const least = tone === 'licht' ? LIGHT_CONTRAST : LINE_CONTRAST;
					expect(contrast(drawn, paper), `${colour} ${tone} of ${n}`).toBeGreaterThanOrEqual(
						least - 0.05
					);
				}
	});

	it('draws a fan of up to nine in full and a larger one paler, down to the floor', () => {
		expect(lineStrength(FALLBACK.rubriekWetten, paper, 'donker', 9)).toBe(1);
		expect(lineStrength(FALLBACK.rubriekWetten, paper, 'donker', 100)).toBeLessThan(1);
		expect(lineStrength(FALLBACK.rubriekWetten, paper, 'licht', 1e6)).toBeCloseTo(
			floorStrength(FALLBACK.rubriekWetten, paper, LIGHT_CONTRAST),
			5
		);
	});

	it('draws a hovered bron’s own lines in full', () => {
		expect(mixed(FALLBACK.moss, paper, 1)).toBe(FALLBACK.moss);
	});
});

// The lightness (CIE L*) of a colour mixed to a strength.
const lstar = (hex: string) => {
	const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	const [r, g, b] = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
};

describe('the tones (Netwerkcanvas, Lijnen)', () => {
	const colourOf = { ...FALLBACK } as unknown as Record<string, string>;
	const families = [
		['change', 'structural'],
		['explanation', 'citation'],
		['submitter', 'member'],
		['submitter', 'part']
	] as const;

	it('open the windows dark, middle and light, each inside the next', () => {
		expect(TONE_WINDOW.donker[0]).toBeGreaterThan(TONE_WINDOW.middel[0]);
		expect(TONE_WINDOW.middel[0]).toBeGreaterThan(TONE_WINDOW.licht[0]);
		for (const tone of Object.keys(TONE_WINDOW) as Tone[]) {
			const [lo, hi] = TONE_WINDOW[tone];
			expect(toneStrength(tone, 1)).toBeCloseTo(hi, 5);
			expect(toneStrength(tone, 1e9)).toBeCloseTo(lo, 3);
		}
	});

	it('keep the kinds of one family 21 ΔL* apart in the windows, in a fan of a few and of many', () => {
		for (const n of [1, 100])
			for (const [x, y] of families) {
				const [a, b] = [x, y].map((k) => {
					const s = LINE_KIND_STYLE[k];
					return lstar(mixed(colourOf[s.colour], paper, toneStrength(s.tone, n)));
				});
				expect(Math.abs(a - b), `${x} ${y} ${n}`).toBeGreaterThanOrEqual(21);
			}
	});

	it('lets the floor win over a window below it (besluit 36): 3:1, for light 2,5:1', () => {
		const slate = FALLBACK.slate;
		expect(toneStrength('licht', 1e6)).toBeLessThan(floorStrength(slate, paper, LIGHT_CONTRAST));
		expect(lineStrength(slate, paper, 'licht', 1e6)).toBeCloseTo(
			floorStrength(slate, paper, LIGHT_CONTRAST),
			5
		);
		expect(lineStrength(slate, paper, 'middel', 1e6)).toBeCloseTo(floorStrength(slate, paper), 5);
		expect(LIGHT_CONTRAST).toBeLessThan(LINE_CONTRAST);
	});

	// As drawn, floors included, in a busy fan (75) and a small one. The least that holds: the
	// kinds of Noemt and of Ingediend door against Lid van are 21 apart; Wijziging against
	// Structureel and Ingediend door against Deel van sit on the 3:1 floor of middle, 19 apart;
	// Deel van and Lid van (both dots) differ by tone and colour only, 5 apart.
	it('keeps the kinds of a family apart as drawn, floors included', () => {
		const drawn = (k: (typeof LINE_KINDS)[number], n: number) => {
			const s = LINE_KIND_STYLE[k];
			const c = colourOf[s.colour];
			return lstar(mixed(c, paper, lineStrength(c, paper, s.tone, n)));
		};
		const least: [(typeof LINE_KINDS)[number], (typeof LINE_KINDS)[number], number][] = [
			['explanation', 'citation', 21],
			['submitter', 'member', 21],
			['change', 'structural', 19],
			['submitter', 'part', 19],
			['part', 'member', 5]
		];
		for (const n of [1, 75])
			for (const [x, y, min] of least)
				expect(Math.abs(drawn(x, n) - drawn(y, n)), `${x} ${y} ${n}`).toBeGreaterThanOrEqual(min);
	});
});
