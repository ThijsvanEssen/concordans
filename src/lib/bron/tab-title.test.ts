import { describe, expect, it } from 'vitest';
import type { GraphNode } from '$lib/graph/types';
import { documentTitle, pageName } from './tab-title';
import { previewFromNode } from './preview';

const node = (
	collection: string,
	label: string,
	display_name: string | null,
	props = {},
	title?: string | null
) => ({ collection, label, raw: { display_name, props, title } }) as unknown as GraphNode;

describe('pageName', () => {
	it('names a Kamerstuk by its kind, title and place as a citation writes it (#84)', () => {
		const brief = node(
			'documents',
			'x',
			'Kamerstuk 36600-VIII, nr. 5. Brief regering: Werkprogramma',
			{
				kind: 'Brief regering',
				title: 'Werkprogramma AWTI 2025',
				dossier_number: '36600',
				dossier_suffix: 'VIII',
				sequence: 5
			}
		);
		expect(documentTitle(brief)).toBe(
			'Brief regering: Werkprogramma AWTI 2025 (36600 VIII, nr. 5)'
		);
		expect(pageName(brief, 'Brief regering: Werkprogramma AWTI 2025 (36600-VIII-5)')).toBe(
			documentTitle(brief)
		);
		expect(documentTitle(node('documents', 'x', 'Sprekerslijst', { kind: 'Sprekerslijst' }))).toBe(
			null
		);
	});

	it('takes the API title for any other bron, cut at a word, without a heading in capitals', () => {
		const wet = node('instruments', 'x', 'Wet', {});
		expect(pageName(wet, 'Burgerlijk Wetboek Boek 6')).toBe('Burgerlijk Wetboek Boek 6');
		expect(
			pageName(node('instruments', 'x', null, {}, 'Stb. 2026, 187: BEGRIPSBEPALING'), null)
		).toBe('Stb. 2026, 187');
		const long =
			'Stemming over Gewijzigde motie van het lid Grinwis over optionele varianten van steward ownership en werknemerseigendom, 29 september 2026: aangenomen';
		const title = pageName(node('decisions', 'x', null), long);
		expect(title.length).toBeLessThanOrEqual(81);
		expect(title.endsWith('…')).toBe(true);
		expect(title).not.toMatch(/\s…$/);
	});

	it('names a bron as a reader reads it before its title is in, never by its key', () => {
		expect(pageName(node('annexes', 'Annex II', 'Annex II', { label: 'II' }), null)).toBe(
			'Bijlage II'
		);
		expect(
			pageName(node('commitments', 'c8a96d5e_1f2a', null, { number: 'TZ202609-124' }), null)
		).toBe('Toezegging TZ202609-124');
	});
});

describe('the card of a judgment and a stemming', () => {
	const title = (collection: 'judgments' | 'decisions', props: Record<string, unknown>) =>
		previewFromNode(collection, null, props).title;

	it('names a judgment by its citation and name, a translation as such', () => {
		const props = {
			ecli: 'ECLI:NL:HR:2019:2007',
			date: '2019-12-20',
			court: 'Hoge Raad',
			names: ['Urgenda'],
			translation_of: 'ECLI:NL:HR:2019:2006'
		};
		expect(title('judgments', props)).toBe('HR 20 december 2019 (Urgenda), vertaling');
	});

	it('names a conclusion by its A-G, as it is cited', () => {
		const props = {
			ecli: 'ECLI:NL:PHR:2019:887',
			date: '2019-09-13',
			court: 'Parket bij de Hoge Raad',
			advocate_general: 'F.F. Langemeijer en M.H. Wissink'
		};
		expect(title('judgments', props)).toBe(
			'Conclusie A-G Langemeijer en Wissink 13 september 2019'
		);
	});

	it('names a stemming as its heading does: Kamer, day and subject, no ISO date', () => {
		const subject =
			'Wijziging van de Wet structuur uitvoeringsorganisatie werk en inkomen (Wet proactieve dienstverlening SZW) ';
		expect(title('decisions', { subject, date: '2026-09-29' })).toBe(
			'Tweede Kamer, 29 september 2026: Wet proactieve dienstverlening SZW'
		);
		expect(
			title('decisions', { subject: 'Goedkeuring Verdrag', chamber: 'EK', date: '2026-09-29' })
		).toBe('Eerste Kamer, 29 september 2026: Goedkeuring Verdrag');
	});
});
