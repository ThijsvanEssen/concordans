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

	it('names the Kamer of a stemming, and its subject', () => {
		const subject =
			'Wijziging van de Wet structuur uitvoeringsorganisatie werk en inkomen (Wet proactieve dienstverlening SZW) ';
		expect(tabTitle(node('decisions', 'x', `Wetgeving 2025Z15911: ${subject}`, { subject }))).toBe(
			'Tweede Kamer: Wet proactieve dienstverlening SZW'
		);
		const ek = 'Eerste Kamer 2026-09-29: Goedkeuring Verdrag (36.455 (R2188))';
		expect(tabTitle(node('decisions', 'x', ek, { subject: 'Goedkeuring Verdrag' }))).toBe(ek);
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
