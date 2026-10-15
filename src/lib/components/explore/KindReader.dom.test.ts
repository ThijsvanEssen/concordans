// KindReader gives each bron the reader of its collection, each reader a chunk of its own: the
// right one comes, and a chunk that does not come (a deploy removed it) is said in its place.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import type { GraphNode } from '$lib/graph/types';
import type { Collection } from '$lib/vocabulary';
import KindReader from './KindReader.svelte';

/** A reader in the place of the real one: it says its name. */
const stub = vi.hoisted(() => (name: string) => ({
	default: (anchor: Comment) => anchor.before(document.createTextNode(`lezer:${name}`))
}));
const reload = vi.hoisted(() => vi.fn());

vi.mock('$lib/util/reload', () => ({ reloadForNewVersion: reload }));
vi.mock('./readers/ArticleReader.svelte', () => stub('ArticleReader'));
vi.mock('./readers/JudgmentReader.svelte', () => stub('JudgmentReader'));
vi.mock('./readers/MemberReader.svelte', () => stub('MemberReader'));
vi.mock('./readers/FallbackReader.svelte', () => stub('FallbackReader'));
vi.mock('./readers/DecisionReader.svelte', () => {
	throw new Error('Failed to fetch dynamically imported module');
});

const node = (collection: Collection, key = 'k1'): GraphNode => ({
	id: `${collection}/${key}`,
	collection,
	key,
	drawClass: 'judgment',
	label: key
});

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

describe('KindReader', () => {
	it.each([
		['judgments', 'JudgmentReader'],
		['members', 'MemberReader'],
		['articles', 'ArticleReader'],
		['cases', 'FallbackReader']
	] as const)('reads a bron of %s with its %s', async (collection, reader) => {
		const { container } = render(KindReader, { selection: node(collection) });
		await settle();
		expect(container.textContent).toContain(`lezer:${reader}`);
	});

	it('says a reader whose chunk did not come, and loads the page again for a new release', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		render(KindReader, { selection: node('decisions') });
		await settle();
		expect(screen.getByRole('alert').textContent).toContain('niet worden geladen');
		expect(reload).toHaveBeenCalled();
	});
});
