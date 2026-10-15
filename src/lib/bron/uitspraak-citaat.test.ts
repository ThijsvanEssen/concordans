// One judgment, one citation (code-eenvoud F107): the reader's head, the tab, the canvas and
// Behoort bij cite it as the API does (`cite`), never by a rule of their own. The court of
// the Raad van State is the Afdeling (ABRvS, Thijs 14 Oct), a conclusion signed as
// procureur-generaal is by the P-G.
import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { buildNodeLabel, nodeToGraphNode, type BaseNode } from '$lib/graph/types';
import { tabTitle } from './tab-title';
import { laagVan } from './behoort-layer';
import { uitspraakKop } from '$lib/text/judgment-cite';

type Cite = Schema<'JudgmentCiteDTO'>;

const node = (key: string, props: Record<string, unknown>, cite: Cite): BaseNode => ({
	id: `judgments/${key}`,
	key,
	collection: 'judgments',
	type: 'judgment',
	display_name: null,
	labels: [],
	props,
	cite,
	path: null
});

const neighbor = (n: BaseNode): Schema<'NeighborDTO'> => ({
	...n,
	edge_id: 'e',
	relation: 'APPEAL_OF',
	direction: 'outbound',
	confidence: null,
	status: null,
	meta: null
});

const abrvs = node(
	'ecli_nl_rvs_2026_5670',
	{ ecli: 'ECLI:NL:RVS:2026:5670', date: '2026-09-03', court: 'Raad van State' },
	{ short: 'ABRvS 3 september 2026', full: 'ABRvS 3 september 2026, ECLI:NL:RVS:2026:5670' }
);
const pg = node(
	'ecli_nl_phr_2019_887',
	{
		ecli: 'ECLI:NL:PHR:2019:887',
		date: '2019-09-13',
		court: 'Parket bij de Hoge Raad',
		advocate_general: 'F.F. Langemeijer en M.H. Wissink',
		advocate_general_role: 'procureur-generaal'
	},
	{
		short: 'Conclusie P-G Langemeijer en Wissink 13 september 2019',
		full: 'Conclusie P-G Langemeijer en Wissink 13 september 2019, ECLI:NL:PHR:2019:887'
	}
);

describe('a judgment cited one way', () => {
	for (const n of [abrvs, pg]) {
		const short = n.cite!.short;
		it(`cites ${short} alike in the reader, the tab, the canvas and Behoort bij`, () => {
			expect(uitspraakKop(n)).toEqual(n.cite);
			const g = nodeToGraphNode(n)!;
			expect(tabTitle(g)).toBe(short);
			expect(buildNodeLabel(n, 'judgment')).toBe(short);
			const laag = laagVan(neighbor(n), 'Eerdere aanleg');
			expect([laag.naam, laag.kort]).toEqual([short, short]);
		});
	}

	it('keeps the names a judgment is known by after its citation', () => {
		const urgenda = node(
			'ecli_nl_hr_2019_2006',
			{ ecli: 'ECLI:NL:HR:2019:2006', date: '2019-12-20', court: 'Hoge Raad', names: ['Urgenda'] },
			{ short: 'HR 20 december 2019', full: 'HR 20 december 2019, ECLI:NL:HR:2019:2006' }
		);
		expect(tabTitle(nodeToGraphNode(urgenda)!)).toBe('HR 20 december 2019 (Urgenda)');
		expect(laagVan(neighbor(urgenda), 'Hoger beroep of cassatie').naam).toBe(
			'HR 20 december 2019 (Urgenda)'
		);
	});
});
