import { describe, expect, it } from 'vitest';
import { PREVIEW_CHARS, eersteZin, indieners, previewFromNode, uitslagVan } from './preview';

describe('previewFromNode', () => {
	it('shows a judgment by its court, date and the first sentence of its summary', () => {
		const p = previewFromNode('judgments', 'Hoge Raad 2019-07-19 / 18/04298', {
			court_code: 'HR',
			date: '2019-07-19',
			summary: 'Prejudiciële vraag (art. 392 Rv). Aardbevingsschade.'
		});
		expect(p.kicker).toBe('Uitspraak, Hoge Raad');
		expect(p.date).toBe('19 juli 2019');
		expect(p.lines).toBe('Prejudiciële vraag (art. 392 Rv).');
	});

	it('names a judgment as its heading does, without an ISO date', () => {
		const p = previewFromNode('judgments', 'Hoge Raad 2026-08-25 / 24/01299', {
			ecli: 'ECLI:NL:HR:2026:1357',
			court: 'Hoge Raad',
			date: '2026-08-25'
		});
		expect(p.title).toBe('HR 25 augustus 2026');
		expect(p.date).toBeNull();
		const named = previewFromNode('judgments', 'Hoge Raad 2019-12-20 / 19/00135', {
			ecli: 'ECLI:NL:HR:2019:2006',
			court: 'Hoge Raad',
			date: '2019-12-20',
			names: ['Urgenda']
		});
		expect(named.title).toBe('HR 20 december 2019 (Urgenda)');
	});

	it('names a stemming and an activity without an ISO date', () => {
		const vote = previewFromNode(
			'decisions',
			'Eerste Kamer 2026-09-29: Wet toekomstbestendige huurcommissie (36.791)',
			{ subject: 'Wet toekomstbestendige huurcommissie', chamber: 'EK', date: '2026-09-29' }
		);
		expect(vote.title).toBe(
			'Eerste Kamer, 29 september 2026: Wet toekomstbestendige huurcommissie'
		);
		const activity = previewFromNode('activities', 'Stemmingen (2026-09-29)', {
			kind: 'Stemmingen',
			date: '2026-09-29'
		});
		expect([activity.title, activity.date]).toEqual(['Stemmingen', '29 september 2026']);
		for (const t of [vote.title, activity.title]) expect(t).not.toMatch(/\d{4}-\d{2}-\d{2}|\u00b7/);
	});

	it('shows a dossier by its number, title and where it stands', () => {
		const p = previewFromNode('dossiers', null, {
			label: '34372',
			title: 'Wijziging van het Wetboek van Strafrecht',
			outcome: 'aangenomen'
		});
		expect([p.kicker, p.title, p.lines]).toEqual([
			'Dossier 34372',
			'Wijziging van het Wetboek van Strafrecht',
			'Aangenomen'
		]);
	});

	it('names a BW article by its book and cuts long text', () => {
		expect(previewFromNode('articles', 'Artikel 162 Burgerlijk Wetboek Boek 6', {}).title).toBe(
			'Artikel 6:162 BW'
		);
		const long = previewFromNode('judgments', 'x', { summary: 'a'.repeat(PREVIEW_CHARS + 50) });
		expect(long.lines!.length).toBe(PREVIEW_CHARS + 1);
	});

	it('places a stuk by its dossier and its indieners', () => {
		const p = previewFromNode('documents', null, {
			kind: 'Amendement (gewijzigd/nader/vervangend)',
			number: '66',
			title: 'Gewijzigd amendement van het lid Madlener',
			date: '2024-04-24',
			dossier_number: '36496',
			dossier_title: 'Wijziging van de Wet goed verhuurderschap (Wet betaalbare huur)',
			actors: [
				{ name: 'H. de Jong', faction: 'GL-PvdA', role: 'Medeondertekenaar' },
				{ name: 'B. Madlener', faction: 'PVV', role: 'Eerste ondertekenaar' }
			]
		});
		expect(p.kicker).toBe('Amendement, nr. 66');
		expect(p.date).toBe('24 april 2024');
		expect(p.dossier).toMatch(/^Dossier 36496, /);
		expect(p.wie).toBe('Ingediend door B. Madlener (PVV), mede namens H. de Jong (GL-PvdA)');
	});
});

describe('preview helpers', () => {
	it('takes the first sentence past the usual abbreviations', () => {
		expect(eersteZin('Onrechtmatige daad (art. 6:162 BW). Causaal verband.')).toBe(
			'Onrechtmatige daad (art. 6:162 BW).'
		);
		expect(eersteZin('Zie r.o. 4.3 en mr. Jansen. Tweede zin.')).toBe(
			'Zie r.o. 4.3 en mr. Jansen.'
		);
		expect(eersteZin('Eén zin zonder punt')).toBe('Eén zin zonder punt');
	});

	it('names the indieners and the vote as the source gives them', () => {
		expect(indieners([{ name: 'B. Madlener', faction: 'PVV', role: 'Eerste ondertekenaar' }])).toBe(
			'Ingediend door B. Madlener (PVV)'
		);
		expect(indieners([])).toBeNull();
		expect(uitslagVan({ decision_text: 'Aangenomen.', tally: { Voor: 137, Tegen: 13 } })).toBe(
			'Aangenomen, 137 voor en 13 tegen'
		);
		expect(uitslagVan({ passed: false })).toBe('Verworpen');
		expect(uitslagVan({})).toBeNull();
	});
});
