import { describe, expect, it, vi } from 'vitest';
import type { Schema } from '$lib/api/types';
import type { ChosenBron } from './targets';
import { previewOfBron, rowSaysAll, whatOpens, type PreviewRest } from './palette-preview';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

type Hit = Schema<'SearchResultItem'>;
const NOW = new Date('2026-11-05');
/** A date keeps its day and month together (a hard space). */
const read = (s: string | null) => s?.replaceAll('\u00a0', ' ');

const hit = (over: Partial<Hit>): Hit =>
	({ id: 'x', key: 'x', type: '', display_name: 'x', score: 1, extra: {}, ...over }) as Hit;
const ofHit = (h: Hit, label: string): ChosenBron => ({ ref: h.id, label, hit: h });
const card = (over: Partial<NonNullable<PreviewRest['card']>>): PreviewRest['card'] => ({
	kicker: 'Wet',
	title: 'x',
	date: null,
	lines: null,
	...over
});

describe('voorbeeldVan: what the right column of ⌘K reads', () => {
	const law = hit({
		id: 'instruments/bwbr0006',
		collection: 'instruments',
		display_name: 'Politiewet 1993',
		extra: { kind: 'wet', expired_on: '2012-10-01', date_in_force: '1994-04-01' }
	});

	it('says a law that no longer holds in words, its kind and name once', () => {
		const v = previewOfBron(ofHit(law, 'Politiewet 1993'), 'politiewet', null, NOW)!;
		expect(v).toMatchObject({ kind: 'Wet', name: 'Politiewet 1993', places: [], passage: null });
		expect(read(v.status)).toBe('Ingetrokken per 1 oktober 2012');
	});

	it('says since when a law holds, and reads its first article once it is in', () => {
		const inForce = hit({ ...law, extra: { kind: 'wet', date_in_force: '1994-04-01' } });
		const v = previewOfBron(
			ofHit(inForce, 'Politiewet 1993'),
			'politiewet',
			{ card: card({}), first: 'Artikel 1: In deze wet wordt verstaan.', standing: [] },
			NOW
		)!;
		expect(read(v.status)).toBe('In werking sinds 1 april 1994');
		expect(v.passage).toEqual([{ text: 'Artikel 1: In deze wet wordt verstaan.', mark: false }]);
	});

	it('reads an article from its row: the passage with the word marked, nothing asked', () => {
		const article = hit({
			id: 'articles/a',
			collection: 'articles',
			snippet: 'Hij die een onrechtmatige daad pleegt',
			extra: { article_number: '6:162', bwb_id: 'BWBR0005289', short_title: 'BW' }
		});
		const bron = ofHit(article, 'Art. 6:162 BW');
		const v = previewOfBron(bron, 'onrechtmatige', null, NOW)!;
		expect(v.kind).toBe('Artikel');
		expect(v.places).toEqual(['BW']);
		expect(v.passage?.filter((p) => p.mark).map((p) => p.text)).toEqual(['onrechtmatige']);
		expect(rowSaysAll(bron)).toBe(true);
	});

	it('places a judgment by its ECLI, its first sentence once the card is in', () => {
		const judgment = hit({
			id: 'judgments/u',
			collection: 'judgments',
			display_name: 'Hoge Raad 2019-12-20 / 19/00135',
			extra: { ecli: 'ECLI:NL:HR:2019:2006' }
		});
		const bron = ofHit(judgment, 'HR 20 december 2019');
		expect(rowSaysAll(bron)).toBe(false);
		const v = previewOfBron(
			bron,
			'urgenda',
			{
				card: card({
					kicker: 'Uitspraak, Hoge Raad',
					lines: 'De Staat moet de uitstoot beperken.'
				}),
				first: null,
				standing: []
			},
			NOW
		)!;
		expect(v.kind).toBe('Uitspraak, Hoge Raad');
		expect(v.places).toEqual(['ECLI:NL:HR:2019:2006']);
		expect(v.passage?.[0].text).toBe('De Staat moet de uitstoot beperken.');
	});

	it('places a judgment found by a person by that person, and reads its summary', () => {
		const judgment = hit({
			id: 'judgments/u',
			collection: 'judgments',
			display_name: 'Hoge Raad 2019-12-20 / 19/00135',
			extra: {
				ecli: 'ECLI:NL:HR:2019:2006',
				person: { name: 'STICHTING URGENDA', role: 'verweerder' }
			}
		});
		const v = previewOfBron(
			ofHit(judgment, 'HR 20 december 2019'),
			'urgenda',
			{ card: card({ lines: 'De Staat moet de uitstoot beperken.' }), first: null, standing: [] },
			NOW
		)!;
		expect(v.places).toContain('STICHTING URGENDA, verweerder');
		expect(v.passage?.[0].text).toBe('De Staat moet de uitstoot beperken.');
	});

	it('says who brought a dossier in and its last stuk', () => {
		const dossier = hit({
			id: 'dossiers/36496',
			collection: 'dossiers',
			display_name: 'Wet betaalbare huur',
			extra: { number: '36496', outcome: 'aangenomen' }
		});
		const v = previewOfBron(
			ofHit(dossier, 'Wet betaalbare huur'),
			'huur',
			{
				card: null,
				first: null,
				standing: ['Ingediend door H.M. de Jonge', 'Laatste stuk op 1 juli 2024']
			},
			NOW
		)!;
		expect(v.places).toContain('Ingediend door H.M. de Jonge');
		expect(v.places).toContain('Laatste stuk op 1 juli 2024');
	});

	it('reads a citation without a row: its kind from its address, its status from the API', () => {
		const v = previewOfBron(
			{
				ref: { collection: 'articles', key: 'a' },
				label: 'Art. 1 Politiewet',
				expiredOn: '2012-10-01'
			},
			'x',
			null,
			NOW
		)!;
		expect(v.kind).toBe('Artikel');
		expect(read(v.status)).toBe('Vervallen per 1 oktober 2012');
	});
});

describe('a bron cited by what was typed (B117)', () => {
	it('takes the name its card gives, and names the kind once', () => {
		const bron: ChosenBron = { ref: 'dossiers/36600_vii', label: '36600-VII', unnamed: true };
		const rest: PreviewRest = {
			card: card({ kicker: 'Dossier 36600 VII', title: 'Begroting BZK 2025' }),
			first: null,
			standing: []
		};
		expect(previewOfBron(bron, '36600-VII', null, NOW)!.name).toBe('36600-VII');
		expect(previewOfBron(bron, '36600-VII', rest, NOW)).toMatchObject({
			kind: 'Dossier 36600 VII',
			name: 'Begroting BZK 2025'
		});
	});
});

describe('whatOpens', () => {
	it('says what Enter opens with its article', () => {
		expect(whatOpens('instruments')).toBe('de wet');
		expect(whatOpens('articles')).toBe('het artikel');
		expect(whatOpens('judgments')).toBe('de uitspraak');
		expect(whatOpens('dossiers')).toBe('het dossier');
	});

	it('says a regeling by its own kind (B117)', () => {
		expect(whatOpens('instruments', 'Beleidsregel')).toBe('de beleidsregel');
		expect(whatOpens('instruments', 'AMvB')).toBe('de AMvB');
		expect(whatOpens('instruments', 'Koninklijk besluit')).toBe('het koninklijk besluit');
		expect(whatOpens('instruments', 'Verdrag')).toBe('het verdrag');
		expect(whatOpens('instruments', 'Wet')).toBe('de wet');
	});
});
