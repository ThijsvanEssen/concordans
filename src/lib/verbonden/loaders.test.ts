import { describe, expect, it } from 'vitest';
import { basesLine } from './loaders';

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
