// A concept as the API answers it, for the tests of its block.
import type { Schema } from '$lib/api/types';

export const CONCEPT = {
	key: 'toetsing-van-wetten',
	name: 'Toetsing van wetten',
	explanation: { label: 'Rijksoverheid', url: 'https://www.rijksoverheid.nl/x' },
	articles: [
		{
			id: 'articles/bwbr0001840_93',
			key: 'bwbr0001840_93',
			display_name: 'Art. 93 Gw',
			heading: null,
			opening: 'Bepalingen van verdragen…',
			judgment_total: 548,
			path: '/wetten/BWBR0001840/artikel/93'
		},
		{
			id: 'articles/bwbr0001840_120',
			key: 'bwbr0001840_120',
			display_name: 'Art. 120 Gw',
			heading: null,
			opening: 'De rechter treedt niet in de beoordeling.',
			judgment_total: 1422,
			path: '/wetten/BWBR0001840/artikel/120'
		}
	],
	missing: [],
	judgment_total: 1900,
	judgments: [
		{
			judgment: {
				cite: { short: 'Rb. Den Haag 20 november 2026', full: 'x' },
				outcome: 'ongegrond',
				outcome_text: 'verklaart de beroepen ongegrond',
				key: 'ecli_nl_rbdha_2026_34496',
				id: 'judgments/ecli_nl_rbdha_2026_34496',
				ecli: 'ECLI:NL:RBDHA:2026:34496',
				court: 'RBDHA',
				date: '2026-11-20',
				display_name: 'Rechtbank Den Haag 2026-11-20 / NL26.37367'
			},
			article_ids: ['articles/bwbr0001840_93', 'articles/bwbr0001840_120']
		}
	],
	document_total: 437,
	documents: [
		{
			document: {
				key: 'abc',
				id: 'documents/abc',
				kind: 'Memorie van toelichting',
				title: 'Vaststelling van de begrotingsstaten',
				date: '2026-09-15',
				dossier_number: '37020',
				sequence: 2,
				is_explanatory: true,
				chamber: 'TK',
				source: 'tk'
			},
			article_ids: ['articles/bwbr0001840_120']
		}
	]
} as unknown as Schema<'ConceptResponse'>;
