// A stemming over a motie names its indieners as Actueel does: "Ingediend door", the lid a link,
// the fractie after it (F8). The indieners are the `submitters` of the stuk voted on.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fakeApi } from '$lib/test/fakeApi';
import type { GraphNode } from '$lib/graph/types';
import DecisionReader from './DecisionReader.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const node = {
	id: 'decisions/d1',
	key: 'd1',
	collection: 'decisions',
	label: 'Stemming',
	raw: { props: {} }
} as unknown as GraphNode;

const decision = {
	id: 'decisions/d1',
	key: 'd1',
	date: '2026-03-10',
	subject: 'Motie van het lid Faber over het vertrouwen opzeggen',
	chamber: 'TK',
	passed: false,
	kind: 'Stemmingen',
	motion_kind: 'vertrouwen',
	primary_case_kind: 'Motie',
	dictum: 'verzoekt de regering',
	dossier_numbers: [],
	dossiers: [],
	primary_document: { id: 'documents/p1', key: 'p1', kind: 'Motie', number: '31' }
};

const read = async (submitters: unknown[]) => {
	fakeApi({
		'/api/decisions/{key}': decision,
		'/api/decisions/{key}/document': { key: 'p1', text: 'tekst', submitters },
		'/api/cabinets': []
	});
	const { container } = render(DecisionReader, { node });
	await screen.findByText(/Over:/);
	return container;
};

describe('the indieners of a stemming over a motie', () => {
	it('names the lid as a link and the fractie after it', async () => {
		const c = await read([
			{ name: 'Marjolein Faber', member_key: 'faber', faction: 'PVV', role: 'indiener' }
		]);
		const regel = await screen.findByText(/Ingediend door/);
		expect(regel.textContent?.replace(/\s+/g, ' ')).toContain(
			'Ingediend door Marjolein Faber (PVV)'
		);
		expect(c.querySelector('a[href*="faber"]')?.textContent).toBe('Marjolein Faber');
	});

	it('has no line where the stuk names no indiener', async () => {
		await read([]);
		expect(screen.queryByText(/Ingediend door/)).toBeNull();
	});
});
