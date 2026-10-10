import { describe, expect, it } from 'vitest';
import type { GraphNode } from '$lib/graph/types';
import { tabTitle } from './tab-title';

const node = (collection: string, label: string, display_name: string | null, props = {}) =>
	({ collection, label, raw: { display_name, props } }) as unknown as GraphNode;

describe('tabTitle', () => {
	it('names a dossier by its number and short title', () => {
		const title =
			'Wijziging van de Uitvoeringswet Algemene verordening gegevensbescherming en enkele andere wetten (Verzamelwet gegevensbescherming)';
		expect(
			tabTitle(
				node('dossiers', '36264', `Kamerstukdossier 36264: ${title}`, { label: '36264', title })
			)
		).toBe('36264 Verzamelwet gegevensbescherming');
	});

	it('names a judgment by its label and name, a BW article by its book', () => {
		expect(tabTitle(node('judgments', 'HR 2019/2006', null, { names: ['Urgenda'] }))).toBe(
			'HR 2019/2006 (Urgenda)'
		);
		expect(tabTitle(node('articles', 'Art. 6:162', 'Artikel 162 Burgerlijk Wetboek Boek 6'))).toBe(
			'Artikel 6:162 BW'
		);
	});

	it('names an article by its law where it has no abbreviation', () => {
		expect(
			tabTitle(
				node('articles', 'Art. 419', null, {
					instrument_citation_title: 'Wetboek van Burgerlijke Rechtsvordering'
				})
			)
		).toBe('Art. 419 Wetboek van Burgerlijke Rechtsvordering');
	});

	it('names a bijlage as the reader does, not by the data\'s "Annex"', () => {
		expect(tabTitle(node('annexes', 'Annex II', 'Annex II', { label: 'II' }))).toBe('Bijlage II');
	});

	it('names a translation as such: it shares the date and name of its original', () => {
		const props = {
			ecli: 'ECLI:NL:HR:2019:2007',
			date: '2019-12-20',
			court: 'Hoge Raad',
			names: ['Urgenda'],
			translation_of: 'ECLI:NL:HR:2019:2006'
		};
		expect(tabTitle(node('judgments', 'x', null, props))).toBe(
			'HR 20 december 2019 (Urgenda), vertaling'
		);
	});

	it('names a conclusion by its A-G, as it is cited', () => {
		const props = {
			ecli: 'ECLI:NL:PHR:2019:887',
			date: '2019-09-13',
			court: 'Parket bij de Hoge Raad',
			advocate_general: 'F.F. Langemeijer en M.H. Wissink'
		};
		expect(tabTitle(node('judgments', 'x', null, props))).toBe(
			'Conclusie A-G Langemeijer en Wissink 13 september 2019'
		);
	});

	it('names a stemming as its heading does: Kamer, day and subject, no ISO date', () => {
		const subject =
			'Wijziging van de Wet structuur uitvoeringsorganisatie werk en inkomen (Wet proactieve dienstverlening SZW) ';
		expect(
			tabTitle(
				node('decisions', 'x', `Wetgeving 2025Z15911: ${subject}`, { subject, date: '2026-09-29' })
			)
		).toBe('Tweede Kamer, 29 september 2026: Wet proactieve dienstverlening SZW');
		const ek = 'Eerste Kamer 2026-09-29: Goedkeuring Verdrag (36.455 (R2188))';
		expect(
			tabTitle(
				node('decisions', 'x', ek, {
					subject: 'Goedkeuring Verdrag',
					chamber: 'EK',
					date: '2026-09-29'
				})
			)
		).toBe('Eerste Kamer, 29 september 2026: Goedkeuring Verdrag');
	});

	it('cuts a long name at a word', () => {
		const long =
			'Motie 2026Z19641 — Gewijzigde motie van het lid Grinwis over optionele varianten van steward ownership en werknemerseigendom';
		const title = tabTitle(node('decisions', 'x', long));
		expect(title.length).toBeLessThanOrEqual(81);
		expect(title.endsWith('…')).toBe(true);
		expect(title).not.toMatch(/\s…$/);
	});
});
