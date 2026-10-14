import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { rowsOfExplanations } from '$lib/verbonden/explanatory-documents';
import type { Row } from '$lib/verbonden/rows';
import { bewaarItem } from './map';
import { itemVanRij } from './rij';

// UX-toets 14 Oct, #48: the amendement under Toelichting of art. 126ffa Sv, as `explained-by`
// gives it (its dossier as `dossier_number`, not `dossier_numbers`).
const amendement = {
	document: {
		chamber: 'TK',
		source: 'tk',
		is_explanatory: false,
		id: 'documents/093662ee',
		key: '093662ee',
		kind: 'Amendement',
		title: 'Amendement van de leden Recourt en Tellegen over melding van kwetsbaarheden',
		date: '2016-12-12',
		dossier_number: '34372',
		sequence: 14,
		path: '/kamerstukken/34372/14'
	},
	target: 'article_version',
	target_id: 'article_versions/x',
	article_version_key: 'x',
	confidence: 0.9,
	scope: 'article',
	section_anchor: 's-3',
	heading: 'Toelichting',
	excerpt: null
} as unknown as Schema<'ArticleExplanationDTO'>;

describe('a row of Verbonden kept in the map', () => {
	it('keys a Toelichting row under its dossier, as its reader keys the stuk (#48)', () => {
		const [row] = rowsOfExplanations([amendement]);
		const lezer = bewaarItem(
			'documents/093662ee',
			{ kort: 'Kamerstukken II 2016/17, 34372, nr. 14' },
			{ dossier: '34372' }
		);
		const item = itemVanRij(row)!;
		expect(item.groupKey).toBe('dossier:34372');
		expect(item.groupKey).toBe(lezer.groupKey);
		expect(item.groep).toBe('Kamerstuk 34372');
	});

	it('cites a Kamerstuk row as a Kamerstuk, never with an ISO date (#48)', () => {
		const [row] = rowsOfExplanations([amendement]);
		const { kort } = itemVanRij(row)!;
		expect(kort).toBe('Kamerstukken II, 34372, nr. 14, § Toelichting');
		expect(kort).not.toMatch(/\d{4}-\d{2}-\d{2}/);
	});

	it('keys a stuk without a dossier by itself, never by a name or a group label', () => {
		const row = {
			ref: { collection: 'documents', key: 'los' },
			title: 'Antwoord op vragen',
			context: null,
			kind: 'toelichtingen',
			props: {}
		} as Row;
		const lezer = bewaarItem('documents/los', { kort: 'Antwoord' }, { groep: 'Antwoord' });
		expect(itemVanRij(row)!.groupKey).toBe('documents/los');
		expect(lezer.groupKey).toBe('documents/los');
	});
});

describe('a vote kept in the map (#54)', () => {
	it('is cited as a vote from a row, as from its reader', () => {
		const row = {
			ref: { collection: 'decisions', key: 'fee7da7e' },
			title: 'Amendement van de leden Recourt en Tellegen over melding',
			context: 'aangenomen',
			kind: 'stemmingen',
			date: '2016-12-20',
			props: {
				subject: 'Amendement van de leden Recourt en Tellegen over melding',
				date: '2016-12-20',
				chamber: 'TK',
				dossier_numbers: ['34372']
			}
		} as unknown as Row;
		const item = itemVanRij(row)!;
		expect(item.kort).toBe(
			'Stemming 20 december 2016: Amendement van de leden Recourt en Tellegen over melding'
		);
		expect(item.voluit).toBe(
			'Stemming Tweede Kamer, 20 december 2016: Amendement van de leden Recourt en Tellegen over melding'
		);
		expect(item.groupKey).toBe('dossier:34372');
	});
});
