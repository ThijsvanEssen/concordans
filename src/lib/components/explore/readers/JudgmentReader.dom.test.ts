// The judgment reader on a fixed judgment (Rb. Rotterdam, a herstelbeschikking with its
// connected case): the head, the first overweging, the Samenhangende zaken with their sentence
// and whose inhoudsindicatie it is, and the menu of an overweging.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import type { GraphNode } from '$lib/graph/types';
import fixture from '$lib/test/judgment.json';
import JudgmentReader from './JudgmentReader.svelte';

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
	fakeApi({
		'/api/judgments/{ecli}': fixture.detail,
		'/api/nodes/{collection}/{key}': fixture.related
	});
});
afterEach(() => vi.restoreAllMocks());

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

describe('JudgmentReader', () => {
	it('shows the head, the first overweging and the connected case with its sentences', async () => {
		const { container } = render(JudgmentReader, { node });
		await settle();
		expect(container.querySelector('h1, h2')?.textContent).toContain('Rb. Rotterdam');
		expect(screen.getByRole('button', { name: /^Overweging 2\.1:/ })).toBeTruthy();
		expect(container.textContent).toContain('De kantonrechter zal de beschikking verbeteren');
		// The section stands closed by default: its heading opens it.
		const sectie = screen.getByText('Samenhangende zaken').closest('section')!;
		await fireEvent.click(sectie.querySelector('button')!);
		await settle();
		const zinnen = [...container.querySelectorAll('.samenhang-zin')].map((z) => z.textContent);
		expect(zinnen).toEqual([
			'Zie ook ECLI:NL:RBROT:2026:11738 Inhoudsindicatie van deze uitspraak',
			'Zie ook ECLI:NL:RBROT:2026:12500 Inhoudsindicatie van die uitspraak'
		]);
	});

	it('opens the menu of an overweging from its number', async () => {
		render(JudgmentReader, { node });
		await settle();
		const nummer = screen.getByRole('button', { name: /^Overweging 2\.1:/ });
		await fireEvent.click(nummer);
		await settle();
		expect(nummer.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByRole('menu')).toBeTruthy();
	});
});
