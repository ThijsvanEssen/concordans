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
