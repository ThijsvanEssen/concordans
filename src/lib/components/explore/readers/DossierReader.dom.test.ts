// The head of a dossier begins a sentence: the short title is a clause of the bill's name
// ("verlenging, wijziging en …"), so it opens with a capital (F7). The number is the kind line.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fakeApi } from '$lib/test/fakeApi';
import type { GraphNode } from '$lib/graph/types';
import DossierReader from './DossierReader.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const node = {
	id: 'dossiers/36511',
	key: '36511',
	collection: 'dossiers',
	label: '36511',
	raw: { props: { label: '36511' } }
} as unknown as GraphNode;

describe('the head of a dossier', () => {
	it('opens its title with a capital', async () => {
		fakeApi({
			'/api/dossiers/{number}': {
				number: '36511',
				short_title: 'verlenging, wijziging en handhaving van de maximering',
				title: 'Verlenging, wijziging en handhaving van de maximering en nog veel meer'
			},
			'/api/cabinets': []
		});
		render(DossierReader, { node });
		const h1 = await screen.findByRole('heading', { level: 1 });
		expect(h1.textContent).toBe('Verlenging, wijziging en handhaving van de maximering');
	});
});
