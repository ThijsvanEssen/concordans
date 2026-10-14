import { describe, expect, it } from 'vitest';
import { bevindingen, strekking } from './uitkomst';
import { activiteitGroepen, stukNummer } from './activiteit';
import { uitkomstVan } from '$lib/bron/behoort';

describe('how a judgment ended', () => {
	it('says what a conclusie proposes', () => {
		expect(strekking('verwerping')).toBe('strekt tot verwerping');
		expect(strekking(null)).toBeNull();
	});

	it('says what the ECHR found per article, in the order of HUDOC', () => {
		expect(
			bevindingen([
				{ article: '8', finding: 'geen schending' },
				{ article: '13', combined_with: '8', finding: 'schending' },
				{ article: '1', protocol: '1', finding: 'schending', aspect: 'procedureel' }
			])
		).toBe(
			'geen schending van art. 8; schending van art. 13 in samenhang met art. 8; schending van art. 1 van Protocol nr. 1 (procedureel)'
		);
		expect(bevindingen([])).toBeNull();
	});

	it('names an instance of the procesgang by its remedy and outcome', () => {
		expect(uitkomstVan('verworpen', 'Cassatie')).toBe('cassatie verworpen');
		expect(uitkomstVan('bekrachtigd', null)).toBe('bekrachtigd');
		expect(uitkomstVan(null, 'Cassatie')).toBeNull();
	});
});

describe('what was made in an activity', () => {
	it('groups its record, motions, toezeggingen and besluiten, leaving out what is empty', () => {
		const { groepen, inhoud } = activiteitGroepen({
			activity_id: 'activities/a',
			documents: [
				{
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
		expect(groepen[0].regels[0].meta).toBe('Kamerstuk 36764, nr. 32');
		expect(groepen[2].regels[0]).toMatchObject({ teken: 'nee', meta: '65–85' });
		// A motie opens on its dictum from the answer, without its text.
		expect(inhoud.get('documents/m')).toMatchObject({ als: 'dictum' });
		expect(inhoud.get('decisions/d')?.als).toBe('stemming');
	});

	it('cites a paper by its dossier and number', () => {
		expect(stukNummer({ dossier_number: '36600', dossier_suffix: 'VIII', sequence: 5 })).toBe(
			'Kamerstuk 36600 VIII, nr. 5'
		);
		expect(stukNummer({ dossier_number: null, sequence: null })).toBeNull();
	});
});
