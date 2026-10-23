import { describe, expect, it } from 'vitest';
import { discussedIn, discussedPhrase, dossiersByBasis } from './toezegging';

describe('dossiersByBasis', () => {
	const d = (key: string, basis?: 'nakoming' | 'agenda' | null) => ({ key, basis });

	it('takes the dossier of the letter that fulfils it as its own', () => {
		expect(dossiersByBasis([d('29389', 'nakoming')])).toEqual({
			own: [d('29389', 'nakoming')],
			agenda: []
		});
	});

	it('keeps the dossiers of its debate’s agenda apart', () => {
		expect(dossiersByBasis([d('22112', 'agenda'), d('36512', 'agenda')])).toEqual({
			own: [],
			agenda: [d('22112', 'agenda'), d('36512', 'agenda')]
		});
	});

	it('takes every dossier as its own without a basis (the API before #888)', () => {
		expect(dossiersByBasis([d('22112'), d('36512', null)]).own).toHaveLength(2);
		expect(dossiersByBasis(undefined)).toEqual({ own: [], agenda: [] });
	});
});

describe('discussedIn', () => {
	it('names the debate by its subject', () => {
		expect(
			discussedIn({ agenda_title: 'Staat van de Volkshuisvesting', date: '2026-03-11' })
		).toEqual({
			label: 'Besproken',
			before: 'in het debat over',
			link: 'Staat van de Volkshuisvesting'
		});
	});

	it('names it by its day without a subject, and by nothing without either', () => {
		expect(discussedIn({ agenda_title: ' ', date: '2026-03-11' })).toEqual({
			label: 'Besproken',
			before: 'in het debat van',
			link: '11\u00a0maart\u00a02026'
		});
		expect(discussedIn(null)).toEqual({ label: 'Besproken', before: 'in het debat', link: null });
	});

	it('reads as one phrase in a line', () => {
		expect(discussedPhrase({ agenda_title: 'Staat van de Volkshuisvesting' })).toBe(
			'besproken in het debat over Staat van de Volkshuisvesting'
		);
	});
});
