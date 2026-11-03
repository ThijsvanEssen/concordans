import { describe, expect, it } from 'vitest';
import { billOf } from './article-meta';

const entry = {
	dossier_id: 'dossiers/32450',
	dossier_number: '32450',
	dossier_title: 'Wijziging van de Algemene wet bestuursrecht',
	dossier_short_title: 'Wet aanpassing bestuursprocesrecht',
	date: '2012-12-27',
	kind: 'publicatie',
	change: 'amends',
	status: 'canoniek',
	summary: 'Stb. 2012, 682',
	document_id: 'instruments/stb_2012_682'
} as Parameters<typeof billOf>[0];

describe('billOf', () => {
	it('names a bill by its short name, with its number and publication', () => {
		expect(billOf(entry)).toEqual({
			title: 'Wet aanpassing bestuursprocesrecht',
			line: '32450, Stb. 2012, 682',
			id: 'instruments/stb_2012_682'
		});
	});

	it('leaves a title the data lacks empty, for the panel to say so', () => {
		const bill = billOf({
			...entry,
			dossier_id: null,
			dossier_title: null,
			dossier_short_title: null
		});
		expect(bill.title).toBeNull();
		expect(bill.line).toBe('32450, Stb. 2012, 682');
	});
});
