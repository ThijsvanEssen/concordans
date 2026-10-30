import { describe, expect, it } from 'vitest';
import { asRun, noteBlocks, firstLine, noteHtml, plainText, segmentsOfLine } from './markup';
import { referencePath } from './references';

const question = `# Onderzoeksvraag
Wanneer is het laten bestaan van een **gevaarlijke situatie** onrechtmatig op grond van art. 6:162 BW?

# Deelvragen
1. Welke factoren weegt de Hoge Raad in ECLI:NL:HR:1965:AB7079?
2. Hoe verhoudt dat zich tot de relativiteit van art. 6:163 BW?
3. Geldt voor een *wegbeheerder* een andere maatstaf?

Art. 6:162 lid 2 BW:
> Als onrechtmatige daad worden aangemerkt…`;

describe('noteBlocks', () => {
	it('reads kop, paragraph, numbered list and citaat', () => {
		expect(noteBlocks(question).map((b) => b.kind)).toEqual([
			'heading',
			'paragraph',
			'heading',
			'numbered',
			'paragraph',
			'quote'
		]);
	});

	it('keeps a note of before as lines: one Enter is a new line', () => {
		const [b] = noteBlocks('Eerste regel\nTweede regel');
		expect(b.kind === 'paragraph' && b.lines).toHaveLength(2);
	});

	it('starts a numbered list at its first number', () => {
		expect(noteBlocks('3. drie\n4. vier')[0]).toMatchObject({ kind: 'numbered', start: 3 });
	});

	it('reads points with - and *, but *woord* as cursief', () => {
		expect(noteBlocks('- een\n* twee')[0]).toMatchObject({ kind: 'bullets' });
		expect(noteBlocks('*wegbeheerder* weegt')[0].kind).toBe('paragraph');
	});

	it('reads vet and cursief, and leaves a lone sign as it is', () => {
		const [b] = noteBlocks('een **vet** en *schuin* woord, 5 * 3 en ** niets');
		expect(b.kind === 'paragraph' && b.lines[0].map((d) => d.kind)).toEqual([
			'text',
			'bold',
			'text',
			'italic',
			'text'
		]);
	});

	it('finds verwijzingen inside vet, and web addresses without their full stop', () => {
		const [b] = noteBlocks('**zie art. 6:162 BW** en https://wetten.overheid.nl/BWBR0005289.');
		const [bold, , url] = b.kind === 'paragraph' ? b.lines[0] : [];
		expect(bold.kind === 'bold' && bold.parts.map((d) => d.kind)).toEqual(['text', 'reference']);
		expect(url).toEqual({ kind: 'url', text: 'https://wetten.overheid.nl/BWBR0005289' });
	});
});

describe('segmentsOfLine', () => {
	it('gives back every character typed, signs and verwijzingen apart', () => {
		for (const line of question.split('\n').concat(['', '  ', '**open', '#kop', '1) een']))
			expect(
				segmentsOfLine(line)
					.map((s) => s.text)
					.join('')
			).toBe(line);
		expect(segmentsOfLine('1. Welke *wegbeheerder* in art. 6:163 BW')).toEqual([
			{ kind: 'sign', text: '1. ' },
			{ kind: 'text', text: 'Welke ' },
			{ kind: 'sign', text: '*' },
			{ kind: 'text', text: 'wegbeheerder' },
			{ kind: 'sign', text: '*' },
			{ kind: 'text', text: ' in ' },
			{ kind: 'reference', text: 'art. 6:163 BW' }
		]);
	});
});

describe('out of the bundel', () => {
	it('is plain text without signs, the form in lines', () => {
		expect(plainText(question)).toBe(`Onderzoeksvraag

Wanneer is het laten bestaan van een gevaarlijke situatie onrechtmatig op grond van art. 6:162 BW?

Deelvragen

1. Welke factoren weegt de Hoge Raad in ECLI:NL:HR:1965:AB7079?
2. Hoe verhoudt dat zich tot de relativiteit van art. 6:163 BW?
3. Geldt voor een wegbeheerder een andere maatstaf?

Art. 6:162 lid 2 BW:

    „Als onrechtmatige daad worden aangemerkt…"`);
	});

	it('is HTML with links for a word processor', () => {
		const html = noteHtml('# Vraag\nZie **art. 6:162 BW** en <script>\n- een', (r) =>
			referencePath(r) ? `https://concordans.nl${referencePath(r)}` : null
		);
		expect(html).toBe(
			'<h3>Vraag</h3><p>Zie <strong><a href="https://concordans.nl/wetten/BWBR0005289/artikel/6:162">art. 6:162 BW</a></strong> en &lt;script&gt;</p><ul><li>een</li></ul>'
		);
	});

	it('is one run of words for a card: points after each other', () => {
		const run = asRun('De **factoren**:\n- kans\n- ernst')
			.map((d) =>
				'parts' in d ? `[${d.parts.map((x) => ('text' in x ? x.text : '')).join('')}]` : d.text
			)
			.join('');
		expect(run).toBe('De [factoren]: kans, ernst');
	});

	it('names a bundel by its first line that is no kop', () => {
		expect(firstLine(question)).toBe(
			'Wanneer is het laten bestaan van een gevaarlijke situatie onrechtmatig op grond van art. 6:162 BW?'
		);
		expect(firstLine('# Alleen een kop')).toBeNull();
		expect(firstLine(null)).toBeNull();
	});
});
