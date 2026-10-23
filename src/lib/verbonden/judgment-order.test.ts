import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { GraphNode } from '$lib/graph/types';
import { EMPTY_FILTER } from './filter';
import { GROUPS } from './groups';
import { DEFAULT_LOADER_OPTIONS } from './loaders';
import type { Row } from './rows';
import Verbonden from './Verbonden.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://x/explore') } }));

const judgment: Row = {
	title: 'HR 1\u00a0januari\u00a02020',
	ref: { collection: 'judgments', key: 'ecli_nl_hr_2020_1' },
	relation: 'REFERS_TO',
	direction: 'inbound',
	filterGroup: 'uitspraken'
} as Row;

const html = (collection: 'articles' | 'instruments') => {
	const def = GROUPS[collection]!.find((g) => g.id === 'judgments')!;
	return render(Verbonden, {
		props: {
			verbonden: {
				id: `${collection}/x`,
				groups: [{ ...def, rows: [judgment], total: 1, capped: false }],
				loading: false,
				failed: false,
				options: DEFAULT_LOADER_OPTIONS
			},
			selection: { id: `${collection}/x`, collection, key: 'x' } as GraphNode,
			filter: EMPTY_FILTER,
			onFilter: () => {},
			onOpenFilter: () => {},
			tableHref: '#'
		}
	}).body;
};

describe('the order of the judgments in Verbonden', () => {
	it('can be chosen on an article and on a law, without a way to load again', () => {
		expect(html('articles')).toContain('Meest aangehaald');
		expect(html('instruments')).toContain('Meeste artikelen');
	});
});
