import { describe, expect, it } from 'vitest';
import { activiteitGroepen, stukNummer } from './activiteit';

describe('what was made in an activity', () => {
	it('groups its record, motions, toezeggingen and besluiten, leaving out what is empty', () => {
		const { groepen, inhoud } = activiteitGroepen({
			activity_id: 'activities/a',
			documents: [
				{
					date: null,
					dossier_suffix: null,
					dictum: null,
					kind_group: null,
					id: 'documents/v',
					key: 'v',
					kind: 'Verslag van een wetgevingsoverleg',
					title: 'Verslag',
					dossier_number: '36764',
					sequence: 32,
					has_text: true,
					path: null
				}
			],
			motions: [
				{
					date: null,
					dossier_number: null,
					dossier_suffix: null,
					sequence: null,
					kind_group: null,
					id: 'documents/m',
					key: 'm',
					kind: 'Motie',
					title: 'Motie van het lid X',
					dictum: 'verzoekt de regering',
					has_text: false,
					path: null
				}
			],
			commitments: [],
			decisions: [
				{
					date: null,
					kind: null,
					decision_kind: null,
					decision_text: null,
					kind_group: null,
					id: 'decisions/d',
					key: 'd',
					subject: 'Motie van het lid X',
					passed: false,
					tally: { Voor: 65, Tegen: 85 },
					path: null
				}
			],
			cases: []
		});
		expect(groepen.map((g) => g.titel)).toEqual([
			'Verslag en stenogram',
			'Moties ingediend in dit debat',
			'Besluiten'
		]);
		expect(groepen[0].regels[0].meta).toBe('Kamerstukken II, 36764, nr. 32');
		expect(groepen[2].regels[0]).toMatchObject({ teken: 'nee', meta: '65–85' });
		// A motie opens on its dictum from the answer, without its text.
		expect(inhoud.get('documents/m')).toMatchObject({ als: 'dictum' });
		expect(inhoud.get('decisions/d')?.als).toBe('stemming');
	});

	it('cites a paper by its dossier and number', () => {
		expect(
			stukNummer({
				dossier_number: '36600',
				dossier_suffix: 'VIII',
				sequence: 5,
				date: '2025-10-02'
			})
		).toBe('Kamerstukken II 2025/26, 36600 VIII, nr. 5');
		expect(
			stukNummer({ dossier_suffix: null, dossier_number: null, sequence: null, date: null })
		).toBeNull();
	});
});
