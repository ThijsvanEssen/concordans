import { describe, expect, it } from 'vitest';
import type { Row } from '$lib/verbonden/rows';
import { isBijWetsvoorstel, naastHetStuk, wetsvoorstelVan } from './zaak';

const rij = (key: string, kind: string): Row =>
	({
		ref: { collection: 'documents', key },
		title: key,
		context: null,
		kind: 'kamerstuk',
		props: { kind }
	}) as Row;

describe('naastHetStuk', () => {
	const voorstel = rij('nr2', 'Voorstel van wet (initiatiefvoorstel)');
	const brief = rij('nr1', 'Geleidende brief');
	const zaak = {
		rows: [voorstel, brief],
		order: 'Het stuk zelf eerst, de begeleidende brief als laatste'
	};

	it('laat het wetsvoorstel weg naast een stuk dat er bij hoort: dat staat al als kernregel', () => {
		expect(isBijWetsvoorstel('Memorie van toelichting (initiatiefvoorstel)')).toBe(true);
		expect(wetsvoorstelVan(zaak.rows)).toBe(voorstel);
		expect(naastHetStuk('Memorie van toelichting', zaak)).toEqual({
			rows: [brief],
			order: undefined
		});
	});

	it('houdt alles naast een stuk zonder die regel', () => {
		expect(naastHetStuk('Geleidende brief', zaak)).toBe(zaak);
		expect(naastHetStuk('Motie', zaak)).toBe(zaak);
	});
});
