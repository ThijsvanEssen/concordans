// The kern of the band "Behoort bij" is said once, in its table (behoort-rules): what its
// lines name is what Verbonden leaves out, so a bron never stands in both (code-eenvoud F94).
import { describe, expect, it } from 'vitest';
import { behoort, KERN } from '$lib/bron/behoort';
import { BANDS } from '$lib/bron/behoort-rules';
import { NODE_TYPES, RELATION_NAMES, type Collection } from '$lib/vocabulary';

const COLLECTIONS = Object.keys(NODE_TYPES) as Collection[];
const bucketId = (b: { relation: string; direction: string; collection: string }) =>
	`${b.relation}/${b.direction}/${b.collection}`;

/** A light node with a bron in every bucket there is, each keyed by its bucket. */
const everyBucket = {
	node: { key: 'bron', labels: [] },
	neighbors: {
		total: 0,
		buckets: RELATION_NAMES.flatMap((relation) =>
			(['inbound', 'outbound'] as const).flatMap((direction) =>
				COLLECTIONS.map((collection) => {
					const key = bucketId({ relation, direction, collection });
					return {
						relation,
						direction,
						collection,
						total: 1,
						items: [{ key, collection, display_name: key, relation, direction, props: {} }]
					};
				})
			)
		)
	}
} as never;

describe('the kern of the band, said once (code-eenvoud F94)', () => {
	it('puts the bucket of every line of the table in KERN', () => {
		const missing = Object.entries(BANDS).flatMap(([c, band]) => {
			const kern = new Set((KERN[c as Collection] ?? []).map(bucketId));
			return band!.lines
				.flatMap((l) => ('bak' in l ? [l.bak] : l.kern))
				.map(bucketId)
				.filter((b) => !kern.has(b))
				.map((b) => `${c}: ${b}`);
		});
		expect(missing).toEqual([]);
	});

	it('names in a line only bronnen of a bucket in KERN', () => {
		const outside = COLLECTIONS.flatMap((c) => {
			const kern = new Set((KERN[c] ?? []).map(bucketId));
			return behoort(c, {}, everyBucket)
				.regels.flatMap((r) => r.lagen)
				.flatMap((l) => (l.ref && !kern.has(l.ref.key) ? [`${c}: ${l.ref.key}`] : []));
		});
		expect(outside).toEqual([]);
	});
});
