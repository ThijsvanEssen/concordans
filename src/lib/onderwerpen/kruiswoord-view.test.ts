import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Kruiswoord, { type KolomKop } from './Kruiswoord.svelte';
import { tel, type Kolom } from './kruiswoord';

const kolommen: KolomKop[] = [
	{ k: 'moties', label: 'Moties', groep: 'Stukken', titel: 'Moties' },
	{ k: 'brieven', label: 'Brieven', groep: 'Stukken', titel: 'Brieven' },
	{ k: 'aangenomen', label: 'Aangenomen', groep: 'Stemmingen', titel: 'Aangenomen' }
];

const html = (failed: Kolom[]) =>
	render(Kruiswoord, {
		props: {
			kolommen,
			vakken: ['2026-10', '2026-09'],
			rijen: tel([], [{ date: '2026-10-02', kolom: 'aangenomen' }], 'maand', null),
			keuze: null,
			onKies: () => {},
			failed: new Set(failed)
		}
	}).body;

/** What the cells of a row say, in the order of the columns. */
const cells = (body: string, row: string) => {
	const start = body.indexOf(row, body.indexOf('role="rowheader"'));
	const end = body.indexOf('role="row"', start);
	return [...body.slice(start, end).matchAll(/role="gridcell"[^>]*>([^<]*)</g)].map((m) =>
		m[1].trim()
	);
};

describe('the Kruiswoord with a column that could not be counted', () => {
	it('leaves them not counted, never a 0, and says which columns failed', () => {
		const body = html(['moties', 'brieven']);
		expect(cells(body, 'Totaal')).toEqual(['', '', '1']);
		expect(cells(body, '>2026<')).toEqual(['', '', '1']);
		expect(body.match(/aria-label="Niet geteld"/g)).toHaveLength(4);
		expect(body).toContain('role="alert"');
		expect(body).toContain('Moties en brieven konden niet worden geteld.');
	});

	it('counts as before where every column came', () => {
		const body = html([]);
		expect(cells(body, 'Totaal')).toEqual(['0', '0', '1']);
		expect(body).not.toContain('role="alert"');
	});
});
