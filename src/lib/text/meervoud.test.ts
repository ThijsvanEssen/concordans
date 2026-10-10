import { describe, expect, it } from 'vitest';
import { splitsOpNummers } from './meervoud';

const span = (nummer: string) => ({ target: { article_number: nummer }, id: nummer });

describe('a span that cites several articles', () => {
	it('links each article at its number, the words between staying text', () => {
		const tekst = 'art. 2 en 8 EVRM';
		const delen = splitsOpNummers(tekst, [span('2'), span('8')])!;
		expect(delen.map((d) => [tekst.slice(d.van, d.tot), d.span?.id ?? null])).toEqual([
			['art. 2', '2'],
			[' en ', null],
			['8', '8'],
			[' EVRM', null]
		]);
	});

	it('finds a number with a book and does not take a number inside another', () => {
		const tekst = 'art. 6:162 en 6:163 BW';
		const delen = splitsOpNummers(tekst, [span('6:162'), span('6:163')])!;
		expect(delen.filter((d) => d.span).map((d) => tekst.slice(d.van, d.tot))).toEqual([
			'art. 6:162',
			'6:163'
		]);
		// A BW article as the API numbers it, with its book in the text.
		const bw = 'art. 6:162 en 6:163 BW';
		expect(
			splitsOpNummers(bw, [span('162'), span('163')])!
				.filter((d) => d.span)
				.map((d) => bw.slice(d.van, d.tot))
		).toEqual(['art. 6:162', '6:163']);
		// In the order of the text, whatever the order of the API.
		const twaalf = 'art. 12 en 2 Sr';
		expect(
			splitsOpNummers(twaalf, [span('2'), span('12')])!
				.filter((d) => d.span)
				.map((d) => [twaalf.slice(d.van, d.tot), d.span!.id])
		).toEqual([
			['art. 12', '12'],
			['2', '2']
		]);
	});

	it('gives up where a number is not in the text', () => {
		expect(splitsOpNummers('art. 2 EVRM', [span('2'), span('8')])).toBeNull();
	});
});
