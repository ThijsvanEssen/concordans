import { describe, expect, it } from 'vitest';
import { citePaper, paperParagraphCite } from './paper-cite';

describe('a Kamerstuk and its alineas as they are cited', () => {
	const motion = {
		key: '0c0aab25',
		kind: 'Motie',
		title: 'Motie van het lid Tijmstra c.s. over de Wet DOS',
		chamber: 'TK',
		number: '57',
		dossier_numbers: ['37020-XVI']
	};
	const props = { session_year: '2025-2026', dossier_number: '37020', dossier_suffix: 'XVI' };

	it('cites the paper by its Kamerstuk and keeps it under its dossier', () => {
		const paper = citePaper(motion, props);
		expect(paper.name).toBe('Kamerstukken II 2025/26, 37020 XVI, nr. 57');
		expect(paper.item).toMatchObject({
			id: 'documents/0c0aab25',
			at: '',
			voluit: 'Kamerstukken II 2025/26, 37020 XVI, nr. 57 (Motie)',
			groupKey: 'dossier:37020-XVI'
		});
	});

	it('cites an alinea after the paper, by its number from 1, and keeps it at its anchor', () => {
		const a = paperParagraphCite(citePaper(motion, props))(4, 'https://x/#alinea-4');
		expect(a.kort).toBe('Kamerstukken II 2025/26, 37020 XVI, nr. 57, alinea 4');
		expect(a.voluit).toBe('Kamerstukken II 2025/26, 37020 XVI, nr. 57 (Motie), alinea 4');
		expect(a.link).toBe('https://x/#alinea-4');
		expect(a.bewaar).toMatchObject({ at: 'alinea-4', groupKey: 'dossier:37020-XVI' });
	});

	it('cites a paper that is no Kamerstuk by its title', () => {
		const letter = { key: 'b1', kind: 'Brief', title: 'Antwoord op vragen', number: null };
		const a = paperParagraphCite(citePaper(letter))(1, '');
		expect(a.kort).toBe('Antwoord op vragen, alinea 1');
	});
});
