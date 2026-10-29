import { describe, expect, it, vi } from 'vitest';
import type { NodeGraph } from '$lib/api/nodes';
import type { Schets } from './wetsnetwerk';

const item = (
	collection: string,
	key: string,
	relation: string,
	direction: string,
	props = {}
) => ({
	id: `${collection}/${key}`,
	key,
	collection,
	type: collection,
	display_name: key,
	props,
	relation,
	direction
});
const bucket = (
	relation: string,
	direction: string,
	collection: string,
	total: number,
	keys: string[],
	props = {}
) => ({
	relation,
	direction,
	collection,
	type: collection,
	total,
	items: keys.map((k) => item(collection, k, relation, direction, props))
});
const node = (props: Record<string, unknown>, buckets: ReturnType<typeof bucket>[]) =>
	({ node: { props }, neighbors: { total: 0, buckets } }) as unknown as NodeGraph;

const artikel = node({ bwb_id: 'BWBR0001854', instrument_abbreviation: 'Sr' }, [
	bucket('PART_OF', 'outbound', 'instruments', 1, ['bwbr0001854']),
	bucket('VERSION_OF', 'inbound', 'article_versions', 1, ['v1']),
	bucket('AMENDS', 'inbound', 'documents', 1, ['d2'], { dossier_number: '36547' }),
	bucket('REFERS_TO', 'inbound', 'documents', 9, ['d3', 'd4'], { dossier_number: '36547' }),
	bucket('REFERS_TO', 'inbound', 'judgments', 1, ['ecli_a']),
	bucket('REFERS_TO', 'inbound', 'articles', 12, ['a1', 'a2'])
]);
const dossier = node({}, [
	bucket('LED_BY', 'outbound', 'ministries', 1, ['jenv']),
	bucket('LED_BY', 'outbound', 'committees', 2, ['tk_jenv', 'ek_jenv']),
	bucket('PART_OF', 'inbound', 'documents', 22, ['d2'])
]);

vi.mock('$lib/api/records', () => ({
	getNodeVerbonden: async (collection: string) => (collection === 'articles' ? artikel : dossier)
}));

const { homeNetwork, HOME_LIMIT } = await import('./home-network');

const schets = {
	kandidaat: { number: '36547', naam: 'Mensenhandel', titel: '', datum: '2026-09-29', kamer: 'EK' },
	exploreHref: '/explore',
	centrum: { id: 'articles/bwbr0001854_273f', naam: 'Artikel 273f' }
} satisfies Schets;

describe('homeNetwork', () => {
	it('draws the article in its law, one step out, within the budget', async () => {
		const s = await homeNetwork(schets);
		expect(s.hulls.some((h) => h.id === 'home' && h.label === 'Sr')).toBe(true);
		// The law is the hull and the version the article: neither is a bron of its own.
		const ids = [...s.singles.map((b) => b.id), ...s.clusters.map((c) => c.group)];
		expect(ids.some((id) => id.includes('instruments') || id.includes('article_versions'))).toBe(
			false
		);
		expect(s.singles.length).toBeLessThanOrEqual(HOME_LIMIT);
	});

	it('makes a soort past the budget one circle with its count', async () => {
		const s = await homeNetwork(schets);
		expect(s.clusters.find((c) => c.group === 'articles')?.count).toBe(12);
		expect(s.clusters.find((c) => c.group === 'documents')?.count).toBe(10);
	});

	it('puts the ministerie and the first commissie in the hull of the dossier', async () => {
		const s = await homeNetwork(schets);
		const inDossier = s.singles.filter((b) => b.hull && b.hull !== 'home' && b.hull !== 'centre');
		expect(inDossier.map((b) => b.id).sort()).toEqual(['committees/tk_jenv', 'ministries/jenv']);
		expect(s.hulls.some((h) => h.kind === 'dossier')).toBe(true);
	});
});
