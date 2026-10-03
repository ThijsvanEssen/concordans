import { describe, expect, it } from 'vitest';
import { basesLine, implementationLine } from './loaders';

describe('basesLine', () => {
	it('says what an implementation rests on', () => {
		expect(basesLine(['national_implementing_measure'])).toBe(
			'uitvoeringsmaatregel volgens EUR-Lex'
		);
		expect(basesLine(['national_implementing_measure', 'considerans'])).toBe(
			'uitvoeringsmaatregel volgens EUR-Lex, volgens de considerans'
		);
		expect(basesLine([])).toBeNull();
		expect(basesLine(undefined)).toBeNull();
	});
});

describe('implementationLine (BE-58)', () => {
	const via = [
		{ publication: 'stb-1992-315', citation: 'Stb. 1992, 315' },
		{ publication: 'stb-2013-102', citation: 'Stb. 2013, 102' }
	];
	const bases = ['national_implementing_measure'];

	it('says a change to implement only for a measure that amends the law (Awb, Richtlijn 2018/1972)', () => {
		expect(implementationLine({ bases, via }, new Set(['stb_2013_102']))).toBe(
			'gewijzigd ter implementatie door Stb. 2013, 102; uitvoeringsmaatregel Stb. 1992, 315 volgens EUR-Lex'
		);
	});

	it('names the measures as EUR-Lex has them when none amends the law', () => {
		expect(implementationLine({ bases, via: [via[0]] }, new Set())).toBe(
			'uitvoeringsmaatregel Stb. 1992, 315 volgens EUR-Lex'
		);
	});

	it('keeps the bases where EUR-Lex names no measure', () => {
		expect(implementationLine({ bases: ['considerans'], via: [] }, new Set())).toBe(
			'volgens de considerans'
		);
	});
});
