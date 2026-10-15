import { describe, expect, it } from 'vitest';
import type { Row } from '$lib/verbonden/rows';
import { fakeApi, slow } from '$lib/test/fakeApi';
import { naastHetStuk, stukkenInDezelfdeZaak, wetsvoorstelVan } from './zaak';
import { zaakRang } from './zaak';

const rij = (key: string, kind: string): Row =>
	({
		ref: { collection: 'documents', key },
		title: key,
		context: null,
		filterGroup: 'toelichtingen',
		props: { kind }
	}) as Row;

describe('naastHetStuk', () => {
	const voorstel = rij('nr2', 'Voorstel van wet (initiatiefvoorstel)');
	const brief = rij('nr1', 'Geleidende brief');
	const zaak = {
		rows: [voorstel, brief],
		order: 'Het stuk zelf eerst, de begeleidende brief als laatste'
	};

	it('leaves the wetsvoorstel out beside a stuk that belongs to it: it is a kern line already', () => {
		expect(wetsvoorstelVan(zaak.rows)).toBe(voorstel);
		expect(naastHetStuk('Memorie van toelichting', zaak)).toEqual({
			rows: [brief],
			order: undefined
		});
	});

	it('keeps everything beside a stuk without that line', () => {
		expect(naastHetStuk('Motie', zaak)).toBe(zaak);
	});

	it('leaves the stukken offered out beside a covering letter: they are its kern line', () => {
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

describe('zaakRang', () => {
	it('puts the substance first and the geleidende brief last, by the kind the source gives', () => {
		const rang = (kind: string) => zaakRang({ props: { kind } });
		expect(rang('Memorie van toelichting (initiatiefvoorstel)')).toBe(0);
		expect(rang('Bijlage')).toBe(0);
		expect(rang('Nota n.a.v. het (nader/tweede nader/enz.) verslag')).toBe(0);
		expect(rang('Brief regering')).toBe(1);
		expect(rang('Geleidende brief')).toBe(2);
	});
});
