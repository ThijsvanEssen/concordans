// Art. 126ffa Sv and its place in the new Wetboek van Strafvordering (Stb. 2026, 56), as the
// live API gives them (0.79.65): the article of a law of the Staatsblad has no `path` of its
// own, only its instrument has one.
import type { Schema } from '$lib/api/types';

type Succession = Schema<'ArticleSuccessionDTO'>;
type NodeGraph = Schema<'NodeGraphResponse'>;

const table = {
	basis: 'transposition_table',
	source: 'blg-1081574',
	source_url: 'https://zoek.officielebekendmakingen.nl/blg-1081574.html'
};

const lid = (old: string, lid: string) => ({
	old_part: old,
	new_place: `2.8.6, ${lid}`,
	new_article: '2.8.6',
	new_leden: [lid]
});

const parts = [lid('1', '1'), lid('2', '1'), lid('3', '1'), lid('4', '2')];

/** On art. 126ffa Sv: the article that takes its place. */
export const newSv: Succession = {
	article: {
		id: 'articles/stb_2026_56_2_8_6',
		key: 'stb_2026_56_2_8_6',
		display_name: 'Art. 2.8.6 Wetboek van Strafvordering',
		bwb_id: null,
		celex: null,
		article_number: '2.8.6',
		path: null,
		instrument: {
			series_id: null,
			series_position: null,
			series_size: null,
			series_basis: null,
			id: 'instruments/wet_stb_2026_56',
			key: 'wet_stb_2026_56',
			bwb_id: null,
			celex: null,
			title: 'Wetboek van Strafvordering',
			citation_title: 'Wetboek van Strafvordering',
			short_title: null,
			abbreviation: null,
			signed_on: null,
			display_name: 'Wetboek van Strafvordering (Stb. 2026, 56)',
			official_url: 'https://zoek.officielebekendmakingen.nl/stb-2026-56.html',
			article_count: 1230,
			inbound_citation_count: 1269,
			judgment_count: null,
			outbound_citation_count: null,
			path: '/wetten/STB-2026-56'
		}
	},
	in_force: false,
	status: 'vastgesteld',
	parts,
	...table
};

/** On art. 2.8.6 of the new code: the article whose place it takes. */
export const oldSv: Succession = {
	article: {
		id: 'articles/bwbr0001903_126ffa',
		key: 'bwbr0001903_126ffa',
		display_name: 'Artikel 126ffa Wetboek van Strafvordering',
		bwb_id: 'BWBR0001903',
		celex: null,
		article_number: '126ffa',
		path: '/wetten/BWBR0001903/artikel/126ffa',
		instrument: {
			series_id: null,
			series_position: null,
			series_size: null,
			series_basis: null,
			id: 'instruments/bwbr0001903',
			key: 'bwbr0001903',
			bwb_id: 'BWBR0001903',
			celex: null,
			title: 'Wetboek van Strafvordering',
			citation_title: 'Wetboek van Strafvordering',
			short_title: 'Sv',
			abbreviation: 'Sv',
			signed_on: null,
			display_name: 'Wetboek van Strafvordering',
			official_url: 'https://wetten.overheid.nl/BWBR0001903',
			article_count: 1260,
			inbound_citation_count: 0,
			judgment_count: null,
			outbound_citation_count: null,
			path: '/wetten/BWBR0001903'
		}
	},
	in_force: true,
	status: null,
	parts,
	...table
};

/**
 * The light node of an old article no new article takes the place of: TRANSPOSED_TO the new
 * law with what the table says (lawgraph #860, `meta.outcome`): art. 3.14 of the Waterwet not
 * taken over in the Omgevingswet (kst-34986-3), art. 3.6a "Blijft in Waterwet".
 */
export const outcomeNode = (
	meta: Record<string, unknown>,
	law: { key: string; citation_title: string; abbreviation?: string } = {
		key: 'bwbr0037885',
		citation_title: 'Omgevingswet'
	}
): NodeGraph =>
	({
		node: { id: 'articles/bwbr0025458_3.14', key: 'bwbr0025458_3.14', collection: 'articles' },
		neighbors: {
			buckets: [
				{
					relation: 'TRANSPOSED_TO',
					direction: 'outbound',
					collection: 'instruments',
					type: 'instrument',
					total: 1,
					items: [
						{
							id: `instruments/${law.key}`,
							key: law.key,
							collection: 'instruments',
							type: 'instrument',
							display_name: law.citation_title,
							props: { ...law, bwb_id: law.key.toUpperCase() },
							relation: 'TRANSPOSED_TO',
							direction: 'outbound',
							confidence: 1,
							meta: { basis: 'transposition_table', source: 'kst-34986-3', ...meta }
						}
					]
				}
			]
		}
	}) as unknown as NodeGraph;
