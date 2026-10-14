import { describe, expect, it } from 'vitest';
import type { BodyItem } from '$lib/components/explore/readers/judgment-text';
import { citaatUit, overwegingVan, rondCitaat } from './inhoud';

describe('the content of a kept item', () => {
	it('reads the words a note quotes', () => {
		expect(citaatUit('"Met het wetsvoorstel gelden ook verplichtingen." -- MvT')).toBe(
			'Met het wetsvoorstel gelden ook verplichtingen.'
		);
		expect(citaatUit('Zie “de zorgplicht van het bestuur” hier')).toBe(
			'de zorgplicht van het bestuur'
		);
		expect(citaatUit('Een "kort" woord')).toBeNull();
		expect(citaatUit(null)).toBeNull();
	});

	it('finds the quote in the text around it, whatever its spaces and quotes', () => {
		const tekst = `${'Inleiding. '.repeat(60)}Zij moeten   een opleiding volgen over risico’s op het gebied\nvan cyberbeveiliging. ${'Slot. '.repeat(100)}`;
		const r = rondCitaat(
			tekst,
			"een opleiding volgen over risico's op het gebied van cyberbeveiliging",
			40
		)!;
		expect(r.citaat).toBe('een opleiding volgen over risico’s op het gebied van cyberbeveiliging');
		expect(r.voor.startsWith('…')).toBe(true);
		expect(r.voor.endsWith('Zij moeten ')).toBe(true);
		expect(r.na.endsWith('…')).toBe(true);
		expect(rondCitaat(tekst, 'staat er niet in')).toBeNull();
		expect(rondCitaat(null, 'iets')).toBeNull();
	});

	it('shows an overweging with what continues it, and those around it a click further', () => {
		const rov = (num: string): BodyItem => ({
			kind: 'rov',
			num,
			subTitle: null,
			body: `r.o. ${num}`,
			id: `rov-${num}`
		});
		const items: BodyItem[] = [
			rov('5.5'),
			rov('5.6'),
			rov('5.7'),
			rov('5.7.1'),
			{ kind: 'prose', body: 'vervolg', within: true },
			rov('5.7.2'),
			rov('5.8'),
			rov('5.9'),
			rov('5.10'),
			rov('5.11')
		];
		const eigen = overwegingVan(items, 'rov-5.7')!;
		expect(eigen.items.map((i) => (i.kind === 'rov' ? i.num : i.kind))).toEqual([
			'5.7',
			'5.7.1',
			'prose',
			'5.7.2'
		]);
		const ruim = overwegingVan(items, 'rov-5.7', true)!;
		expect(ruim.items.map((i) => (i.kind === 'rov' ? i.num : i.kind))).toEqual([
			'5.5',
			'5.6',
			'5.7',
			'5.7.1',
			'prose',
			'5.7.2',
			'5.8',
			'5.9',
			'5.10'
		]);
		expect([...ruim.eigen]).toEqual([2, 3, 4, 5]);
		expect(overwegingVan(items, 'rov-9')).toBeNull();
		// By the paragraph's own anchor too, where the API gives one.
		const eigenId: BodyItem[] = [
			{ kind: 'rov', num: '6', subTitle: null, body: 'r.o. 6', id: 'p-3f2a9c1e' },
			rov('7')
		];
		expect(overwegingVan(eigenId, 'p-3f2a9c1e')?.items).toHaveLength(1);
		expect(overwegingVan(eigenId, 'rov-6')?.items).toHaveLength(1);
	});
});
