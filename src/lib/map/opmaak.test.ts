import { describe, expect, it } from 'vitest';
import { alsRegels, blokken, eersteRegel, htmlVan, inline, platteTekst, segmenten } from './opmaak';
import { padVan } from './verwijzingen';

const vraag = `# Onderzoeksvraag
Wanneer is het laten bestaan van een **gevaarlijke situatie** onrechtmatig op grond van art. 6:162 BW?

# Deelvragen
1. Welke factoren weegt de Hoge Raad in ECLI:NL:HR:1965:AB7079?
2. Hoe verhoudt dat zich tot de relativiteit van art. 6:163 BW?
3. Geldt voor een *wegbeheerder* een andere maatstaf?

Art. 6:162 lid 2 BW:
> Als onrechtmatige daad worden aangemerkt…`;

describe('blokken', () => {
	it('reads kop, alinea, numbered list and citaat', () => {
		expect(blokken(vraag).map((b) => b.soort)).toEqual([
			'kop',
			'alinea',
			'kop',
			'lijst',
			'alinea',
			'citaat'
		]);
	});

	it('keeps a note of before as lines: one Enter is a new line', () => {
		const [b] = blokken('Eerste regel\nTweede regel');
		expect(b).toMatchObject({ soort: 'alinea' });
		expect(b.soort === 'alinea' && b.regels).toHaveLength(2);
	});

	it('starts a numbered list at its first number', () => {
		expect(blokken('3. drie\n4. vier')[0]).toMatchObject({ soort: 'lijst', start: 3 });
	});

	it('reads points with - and *, but *woord* as cursief', () => {
		expect(blokken('- een\n* twee')[0]).toMatchObject({ soort: 'opsomming' });
		expect(blokken('*wegbeheerder* weegt')[0].soort).toBe('alinea');
	});
});

describe('inline', () => {
	it('reads vet and cursief, and leaves a lone sign as it is', () => {
		expect(inline('een **vet** en *schuin* woord')).toEqual([
			{ soort: 'tekst', tekst: 'een ' },
			{ soort: 'vet', delen: [{ soort: 'tekst', tekst: 'vet' }] },
			{ soort: 'tekst', tekst: ' en ' },
			{ soort: 'cursief', delen: [{ soort: 'tekst', tekst: 'schuin' }] },
			{ soort: 'tekst', tekst: ' woord' }
		]);
		expect(inline('5 * 3 en ** niets')).toEqual([{ soort: 'tekst', tekst: '5 * 3 en ** niets' }]);
	});

	it('finds verwijzingen and web addresses inside vet', () => {
		const [vet] = inline('**zie art. 6:162 BW**');
		expect(vet.soort === 'vet' && vet.delen.map((d) => d.soort)).toEqual(['tekst', 'verwijzing']);
		expect(inline('https://wetten.overheid.nl/BWBR0005289.')[0]).toEqual({
			soort: 'url',
			tekst: 'https://wetten.overheid.nl/BWBR0005289'
		});
	});
});

describe('segmenten', () => {
	it('gives back every character typed, signs and verwijzingen apart', () => {
		for (const line of vraag.split('\n').concat(['', '  ', '**open', '#kop', '1) een']))
			expect(
				segmenten(line)
					.map((s) => s.tekst)
					.join('')
			).toBe(line);
		expect(segmenten('1. Welke *wegbeheerder* in art. 6:163 BW')).toEqual([
			{ soort: 'teken', tekst: '1. ' },
			{ soort: 'tekst', tekst: 'Welke ' },
			{ soort: 'teken', tekst: '*' },
			{ soort: 'tekst', tekst: 'wegbeheerder' },
			{ soort: 'teken', tekst: '*' },
			{ soort: 'tekst', tekst: ' in ' },
			{ soort: 'verwijzing', tekst: 'art. 6:163 BW' }
		]);
	});
});

describe('out of the bundel', () => {
	it('is plain text without signs, the form in lines', () => {
		expect(platteTekst(vraag)).toBe(`Onderzoeksvraag

Wanneer is het laten bestaan van een gevaarlijke situatie onrechtmatig op grond van art. 6:162 BW?

Deelvragen

1. Welke factoren weegt de Hoge Raad in ECLI:NL:HR:1965:AB7079?
2. Hoe verhoudt dat zich tot de relativiteit van art. 6:163 BW?
3. Geldt voor een wegbeheerder een andere maatstaf?

Art. 6:162 lid 2 BW:

    „Als onrechtmatige daad worden aangemerkt…"`);
	});

	it('is HTML with links for a word processor', () => {
		const html = htmlVan('# Vraag\nZie **art. 6:162 BW** en <script>\n- een', (v) =>
			padVan(v) ? `https://concordans.nl${padVan(v)}` : null
		);
		expect(html).toBe(
			'<h3>Vraag</h3><p>Zie <strong><a href="https://concordans.nl/wetten/BWBR0005289/artikel/6:162">art. 6:162 BW</a></strong> en &lt;script&gt;</p><ul><li>een</li></ul>'
		);
	});

	it('is one run of words for a card: points after each other', () => {
		const tekst = alsRegels('De **factoren**:\n- kans\n- ernst')
			.map((d) =>
				'delen' in d ? `[${d.delen.map((x) => ('tekst' in x ? x.tekst : '')).join('')}]` : d.tekst
			)
			.join('');
		expect(tekst).toBe('De [factoren]: kans, ernst');
	});

	it('names a bundel by its first line that is no kop', () => {
		expect(eersteRegel(vraag)).toBe(
			'Wanneer is het laten bestaan van een gevaarlijke situatie onrechtmatig op grond van art. 6:162 BW?'
		);
		expect(eersteRegel('# Alleen een kop')).toBeNull();
		expect(eersteRegel(null)).toBeNull();
	});
});
