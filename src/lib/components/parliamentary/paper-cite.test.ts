import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { itemKey } from '$lib/map/map';
import { itemVanRij } from '$lib/map/rij';
import { rowsOfExplanations } from '$lib/verbonden/explanatory-documents';
import { citePaper, dossierInLight, paperParagraphCite, paperSectionCite } from './paper-cite';

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
		const a = paperParagraphCite(citePaper(motion, props))(
			4,
			'p-360a090c',
			'https://x/#p-360a090c'
		);
		expect(a.kort).toBe('Kamerstukken II 2025/26, 37020 XVI, nr. 57, alinea 4');
		expect(a.voluit).toBe('Kamerstukken II 2025/26, 37020 XVI, nr. 57 (Motie), alinea 4');
		expect(a.link).toBe('https://x/#p-360a090c');
		expect(a.bewaar).toMatchObject({ at: 'p-360a090c', groupKey: 'dossier:37020-XVI' });
	});

	it('cites a paper that is no Kamerstuk by its title', () => {
		const letter = { key: 'b1', kind: 'Brief', title: 'Antwoord op vragen', number: null };
		const a = paperParagraphCite(citePaper(letter))(1, 'p-00000000', '');
		expect(a.kort).toBe('Antwoord op vragen, alinea 1');
	});
});

describe('a passage of a memorie as it is cited and kept (A28, Thijs 20 Oct)', () => {
	// Art. 11 SW, explained by the MvT Belastingplan 2026 at its section s-300 (live, 20 Oct).
	const explanation = {
		document: {
			chamber: 'TK',
			key: '8c1a3474',
			kind: 'Memorie van toelichting',
			title: 'Wijziging van enkele belastingwetten en enige andere wetten (Belastingplan 2026)',
			date: '2025-09-16',
			dossier_number: '36812',
			sequence: 3
		},
		scope: 'article',
		target: 'article_version',
		section_anchor: 's-300',
		heading: 'Artikel X, onderdeel A (artikel 11 van de Successiewet 1956)',
		confidence: 0.95
	} as unknown as Schema<'ArticleExplanationDTO'>;
	const mvt = {
		key: '8c1a3474',
		kind: 'Memorie van toelichting',
		title: explanation.document.title,
		chamber: 'TK',
		number: '3',
		dossier_numbers: ['36812']
	};
	const passage = paperSectionCite(citePaper(mvt, { session_year: '2025-2026' }))(
		{ id: 's-300', heading: ' Artikel X, onderdeel A (artikel 11 van de Successiewet 1956) ' },
		'https://x/#s-300'
	);

	it('cites the passage by its heading, as the memorie prints it', () => {
		expect(passage.kort).toBe(
			'Kamerstukken II 2025/26, 36812, nr. 3, § Artikel X, onderdeel A (artikel 11 van de Successiewet 1956)'
		);
		expect(passage.voluit).toBe(
			'Kamerstukken II 2025/26, 36812, nr. 3 (Memorie van toelichting), § Artikel X, onderdeel A (artikel 11 van de Successiewet 1956)'
		);
		expect(passage.bewaar).toMatchObject({ at: 's-300', groupKey: 'dossier:36812' });
	});

	it('keeps the passage as one item, from the memorie and from its row under the article', () => {
		const [row] = rowsOfExplanations([explanation]);
		const item = itemVanRij(row)!;
		expect(itemKey(item)).toBe(itemKey(passage.bewaar));
		expect(item.kort).toBe(passage.kort);
		expect(item.groupKey).toBe(passage.bewaar.groupKey);
	});
});

describe('a paper kept under its dossier by the name of the dossier (A53)', () => {
	// The MvT of Kamerstuk 32621, nr. 3, its light node as the API gives it (live, 21 Oct): the
	// paper's props lack the dossier's name, its PART_OF neighbour has it.
	const mvt = {
		key: '6c33ccba',
		kind: 'Memorie van toelichting',
		title: 'Aanvulling van de Algemene wet bestuursrecht (…)',
		chamber: 'TK',
		number: '3',
		dossier_numbers: ['32621']
	};
	const props = { session_year: '2010-2011', dossier_number: '32621', dossier_title: null };
	const light = {
		neighbors: {
			total: 1,
			buckets: [
				{
					relation: 'PART_OF',
					direction: 'outbound',
					collection: 'dossiers',
					items: [
						{
							id: 'dossiers/32621',
							key: '32621',
							collection: 'dossiers',
							display_name:
								'Kamerstukdossier 32621: Aanvulling van de Algemene wet bestuursrecht (…)',
							props: {
								number: '32621',
								title: 'Aanvulling van de Algemene wet bestuursrecht (…)',
								short_title: 'Wet nadeelcompensatie en schadevergoeding bij onrechtmatige besluiten'
							}
						}
					]
				}
			]
		}
	} as unknown as Parameters<typeof dossierInLight>[0];

	it('names the group of a kept passage as the dossier, not by its number alone', () => {
		const paper = citePaper(mvt, props, dossierInLight(light));
		const passage = paperSectionCite(paper)({ id: 's-24', heading: 'Artikel 3:4' }, '').bewaar;
		expect(passage.groep).toBe(
			'Kamerstuk 32621 Wet nadeelcompensatie en schadevergoeding bij onrechtmatige besluiten'
		);
		expect(passage.groupKey).toBe('dossier:32621');
		expect(paper.item.groep).toBe(passage.groep);
	});

	it('keeps the number as the name where the dossier is not known', () => {
		expect(citePaper(mvt, {}, dossierInLight(null)).item.groep).toBe('Kamerstuk 32621');
	});
});
