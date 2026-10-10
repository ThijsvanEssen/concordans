import { describe, expect, it } from 'vitest';
import { inhoudVan, openingVan, toelichtingVan, type MetInhoud } from './rij-inhoud';

const item = (kind: string, extra: Partial<MetInhoud> = {}) =>
	({
		kind,
		node: { collection: 'documents', key: 'k' },
		summary: null,
		vote: null,
		...extra
	}) as never;

describe('what an opened row shows', () => {
	it('shows the content of each kind, and nothing for a toezegging', () => {
		expect(inhoudVan(item('Motie'))).toBe('dictum');
		expect(inhoudVan(item('Amendement'))).toBe('toelichting');
		expect(inhoudVan(item('Nota van wijziging'))).toBe('opening');
		expect(inhoudVan(item('toezegging'))).toBeNull();
	});

	it('opens a stemming only with a tally, a uitspraak only with its indicatie', () => {
		expect(inhoudVan(item('stemming'))).toBeNull();
		expect(inhoudVan(item('stemming', { vote: { tally: { Voor: 80, Tegen: 70 } } as never }))).toBe(
			'stemming'
		);
		expect(inhoudVan(item('uitspraak'))).toBeNull();
		expect(inhoudVan(item('uitspraak', { summary: 'Klimaatzaak.' }))).toBe('samenvatting');
	});

	it('takes the opening of a stuk past its letterhead, to the end of a sentence', () => {
		const lang = 'In deze nota van wijziging wordt het wetsvoorstel op enkele punten aangepast. ';
		const tekst = `Tweede Kamer der Staten-Generaal\n36000\nNr. 7\n${lang.repeat(12)}`;
		const o = openingVan(tekst)!;
		expect(o.startsWith('In deze nota')).toBe(true);
		expect(o.endsWith('.')).toBe(true);
		expect(o.length).toBeLessThanOrEqual(600);
		expect(openingVan('Kort\nNr. 3')).toBeNull();
	});

	it('finds the toelichting of an amendement by its section', () => {
		const tekst =
			'I\nIn artikel 1 wordt ...\nToelichting\nDit amendement regelt dat de rechter-commissaris toestemming geeft voor elke inzet van het middel.';
		const start = tekst.indexOf('Toelichting');
		const t = toelichtingVan(tekst, [
			{ heading: 'Toelichting', char_start: start, char_end: tekst.length }
		]);
		expect(t).toBe(
			'Dit amendement regelt dat de rechter-commissaris toestemming geeft voor elke inzet van het middel.'
		);
	});
});
