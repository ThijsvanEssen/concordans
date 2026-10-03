import { describe, expect, it } from 'vitest';
import { PREVIEW_CHARS, previewFromNode } from './preview';

describe('previewFromNode', () => {
	it('shows a judgment by its court, date and summary', () => {
		const p = previewFromNode('judgments', 'Hoge Raad 2019-07-19 / 18/04298', {
			court_code: 'HR',
			date: '2019-07-19',
			summary: 'Prejudiciële vraag (art. 392 Rv). Aardbevingsschade.'
		});
		expect(p.kicker).toBe('Uitspraak, Hoge Raad');
		expect(p.date).toBe('19 juli 2019');
		expect(p.lines).toContain('Aardbevingsschade');
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
});
