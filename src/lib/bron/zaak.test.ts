import { describe, expect, it } from 'vitest';
import type { Row } from '$lib/verbonden/rows';
import { fakeApi, slow } from '$lib/test/fakeApi';
import { naastHetStuk, stukkenInDezelfdeZaak, wetsvoorstelVan } from './zaak';

const rij = (key: string, kind: string): Row =>
	({
		ref: { collection: 'documents', key },
		title: key,
		context: null,
		kind: 'toelichtingen',
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
		expect(wetsvoorstelVan(zaak.rows)).toBe(voorstel);
		expect(naastHetStuk('Memorie van toelichting', zaak)).toEqual({
			rows: [brief],
			order: undefined
		});
	});

	it('houdt alles naast een stuk zonder die regel', () => {
		expect(naastHetStuk('Motie', zaak)).toBe(zaak);
	});

	it('laat bij een geleidende brief de aangeboden stukken weg: die zijn zijn kernregel', () => {
		const mvt = rij('nr3', 'Memorie van toelichting');
		const metMvt = { rows: [voorstel, mvt], order: undefined };
		expect(naastHetStuk('Geleidende brief', metMvt).rows).toEqual([]);
		expect(
			naastHetStuk('Aanbiedingsbrief', { rows: [voorstel, brief], order: undefined }).rows
		).toEqual([brief]);
	});
});

describe('stukkenInDezelfdeZaak', () => {
	it('asks the zaken of a stuk again after a time-out', async () => {
		const answers: unknown[] = [slow(), { node: {}, neighbors: { total: 0, buckets: [] } }];
		const fake = fakeApi({ '/api/nodes/{collection}/{key}': () => answers.shift() });
		await expect(stukkenInDezelfdeZaak({ key: 's1' })).rejects.toMatchObject({
			name: 'TimeoutError'
		});
		expect((await stukkenInDezelfdeZaak({ key: 's1' })).rows).toEqual([]);
		expect(fake.asked('/api/nodes/{collection}/{key}')).toHaveLength(2);
	});
});
