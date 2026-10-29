// The canvas of a netwerk within its soft cap: three chosen bronnen, one of them huge, each keep
// their own bronnen and the lines between the chosen stay (the budget of `budget.ts`, in the store).
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { Schema } from '$lib/api/types';
import { createGraphStore } from '../graph-store';
import { SOFT_NODE_CAP } from './types';

const judgment = (key: string) => ({
	id: `judgments/${key}`,
	key,
	collection: 'judgments',
	type: 'judgment',
	display_name: `Uitspraak ${key}`,
	labels: [],
	props: {}
});

const referring = (key: string, referred: string[]) =>
	({
		node: judgment(key),
		neighbors: {
			total: referred.length,
			buckets: [
				{
					relation: 'REFERS_TO',
					collection: 'judgments',
					direction: 'outbound',
					type: 'judgment',
					total: referred.length,
					items: referred.map((k) => ({
						...judgment(k),
						relation: 'REFERS_TO',
						direction: 'outbound'
					}))
				}
			]
		}
	}) as unknown as Schema<'NodeGraphResponse'>;

const own = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

function threeBronnen() {
	const store = createGraphStore();
	store.compose({
		participants: [
			{ response: referring('cbb', ['cbw', ...own('b', 150)]) },
			{ response: referring('cbw', own('w', 150)) },
			{ response: referring('sr', own('s', 2000)) }
		],
		surroundings: true,
		fresh: true
	});
	return store;
}

describe('a netwerk of three bronnen within the cap', () => {
	it('counts a folded cluster as one place: the huge bron’s 2000 do not cost the others theirs', () => {
		const store = threeBronnen();
		const ids = get(store.nodes).map((n) => n.id);
		for (const chosen of ['cbb', 'cbw', 'sr']) expect(ids).toContain(`judgments/${chosen}`);
		const count = (p: string) =>
			ids.filter((id) => new RegExp(`^judgments/${p}\\d`).test(id)).length;
		// Past the cap in nodes, within it in places: nothing is taken off.
		expect(ids.length).toBeGreaterThan(SOFT_NODE_CAP);
		expect(count('b')).toBe(150);
		expect(count('w')).toBe(150);
		expect(count('s')).toBe(2000);
		expect(get(store.trimmedCount)).toBe(0);
	});

	it('keeps the line between two chosen bronnen', () => {
		const edges = get(threeBronnen().edges).map((e) => `${e.source}>${e.target}`);
		expect(edges).toContain('judgments/cbb>judgments/cbw');
	});
});
