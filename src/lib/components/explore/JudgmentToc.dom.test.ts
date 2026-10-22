// The contents of a uitspraak: its headings and, as the springlijst, its overwegingen by
// number, each a link to the passage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import type { GraphNode } from '$lib/graph/types';
import fixture from '$lib/test/judgment.json';
import JudgmentToc from './JudgmentToc.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const { judgment } = fixture.detail;
const node: GraphNode = {
	id: judgment.id,
	collection: 'judgments',
	key: judgment.key,
	drawClass: 'judgment',
	label: judgment.display_name,
	raw: judgment as unknown as GraphNode['raw']
};

beforeEach(() => {
	open(`/uitspraken/${judgment.ecli}`);
	fakeApi({ '/api/judgments/{ecli}': fixture.detail });
});
afterEach(() => vi.restoreAllMocks());

describe('JudgmentToc', () => {
	it('lists every overweging by its number, linked to its place in the text', async () => {
		const { container } = render(JudgmentToc, { selection: node });
		for (let i = 0; i < 10; i++) {
			await new Promise((r) => setTimeout(r, 0));
			await tick();
		}
		const nav = container.querySelector('.ro');
		expect(nav?.getAttribute('aria-label')).toBe('Rechtsoverwegingen');
		const links = [...container.querySelectorAll<HTMLAnchorElement>('.ro__nr')];
		expect(links.length).toBeGreaterThan(0);
		expect(links.map((a) => a.textContent)).toContain('2.1');
		for (const a of links) expect(a.getAttribute('href')).toMatch(/^#.+/);
	});
});
