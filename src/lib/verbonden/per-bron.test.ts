// Verbonden of one bron of each kind, as the API answered once (src/lib/fixtures/verbonden):
// its groups in their order with their counts, which of them are the kern the band shows,
// each row's title, its line of the verbinding and its meta line, and the CSV of the export.
// What a change to Verbonden's code must leave as it is (code-eenvoud F95, F97).
import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { fileURLToPath } from 'node:url';
import type { GraphStore } from '$lib/graph/store/types';
import type { GraphNode } from '$lib/graph/types';
import type { Collection } from '$lib/vocabulary';
import { getNodeGraph } from '$lib/api/nodes';
import { isInhoudGroep, isKernGroep } from '$lib/bron/behoort';
import { OPNAME, opname } from '$lib/test/opname';
import { createVerbondenSource } from './source';
import { countLabel } from './groups';
import { hoeVan } from './hoe';
import { metaParts, type Row } from './rows';
import { exportRows, rowsToCsv } from './export';
import { EMPTY_FILTER } from './filter';

const BRONNEN: { naam: string; collection: Collection; key: string }[] = [
	{ naam: 'artikel', collection: 'articles', key: 'bwbr0005537_8_72' },
	{ naam: 'wet', collection: 'instruments', key: 'bwbr0005537' },
	{ naam: 'uitspraak', collection: 'judgments', key: 'ecli_nl_hr_2024_1769' },
	{ naam: 'dossier', collection: 'dossiers', key: '36764' },
	{ naam: 'kamerstuk', collection: 'documents', key: '04739c40_e398_4e5a_a205_654b789b6731' }
];

/** A row in words, as the panel shows it: title; line of the verbinding; meta line. */
function rij(row: Row, selected: Collection): string {
	const hoe = hoeVan(row, selected);
	const regel = hoe
		? [
				hoe.werkwoord,
				hoe.rest,
				hoe.afgeleid ? '(afgeleid)' : null,
				hoe.herkomst && `[${hoe.herkomst}]`
			]
				.filter(Boolean)
				.join(' ')
		: '';
	const meta = metaParts(row, !!hoe)
		.map((p) => p.text)
		.join(', ');
	return [`${row.ref.collection}/${row.ref.key}`, row.title, regel, meta].join(' | ');
}

describe.each(BRONNEN)('Verbonden of a $naam', ({ naam, collection, key }) => {
	it(
		'keeps its groups, rows, kern and export',
		{ timeout: OPNAME ? 120_000 : 10_000 },
		async () => {
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			const api = opname(
				fileURLToPath(new URL(`../fixtures/verbonden/${naam}.json`, import.meta.url))
			);
			const store = {
				nodeResponse: (c: Collection, k: string) => getNodeGraph(c, k)
			} as unknown as GraphStore;
			const source = createVerbondenSource(store);
			source.load({ id: `${collection}/${key}`, collection, key } as GraphNode);
			await vi.waitFor(
				() => {
					const st = get(source);
					expect(st.groups.length).toBeGreaterThan(0);
					expect(st.loading).toBe(false);
				},
				{ timeout: OPNAME ? 100_000 : 5_000 }
			);
			api.bewaar();
			const st = get(source);
			source.destroy();
			const node = await getNodeGraph(collection, key, { limit: 1, wait: 'short' });
			const props = (node.node.props ?? {}) as Record<string, unknown>;
			const groups = st.groups.map((g) => ({
				id: g.id,
				label: g.label,
				section: g.section ?? null,
				count: g.failed ? 'mislukt' : countLabel(g),
				plaats: isKernGroep(collection, g)
					? 'kern'
					: isInhoudGroep(collection, g, props)
						? 'inhoud'
						: 'verbonden',
				rows: g.rows.map((r) => rij(r, collection))
			}));
			expect(groups).toMatchSnapshot('groups');
			expect(
				rowsToCsv(exportRows(st.groups, EMPTY_FILTER), collection, 'https://concordans.nl')
			).toMatchSnapshot('csv');
		}
	);
});
