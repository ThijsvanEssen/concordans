// A bijlage reads as an article does (#870): Bijlage 1 of the Cyberbeveiligingswet, a table of
// sectors with its footnotes, its links to EU acts; one without text yet by its description.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import { fakeApi, type FakeAnswer } from '$lib/test/fakeApi';
import type { GraphNode } from '$lib/graph/types';
import CBW from '$lib/fixtures/annexes/cbw-bijlage-1.json';
import AnnexReader from './AnnexReader.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const node = (key: string) =>
	({
		id: `annexes/${key}`,
		key,
		collection: 'annexes',
		label: 'Bijlage',
		raw: null
	}) as never as GraphNode;

const routes = (detail: FakeAnswer) => ({
	'/api/annexes/{key}': detail,
	'/api/instruments/{bwb_id}': fakeInstrument,
	'/api/instruments': { items: [], total: 0 }
});
const fakeInstrument = { bwb_id: 'BWBR0052872', citation_title: 'Cyberbeveiligingswet' };

describe('the text of a bijlage', () => {
	it('lays its table out as a table, with its head row', async () => {
		fakeApi(routes(CBW));
		render(AnnexReader, { node: node('bwbr0052872_annex_1') });
		const table = await screen.findByRole('table');
		const head = within(table).getAllByRole('columnheader');
		expect(head.map((h) => h.textContent?.trim())).toEqual([
			'Sector',
			'Subsector',
			'Soort entiteit'
		]);
		expect(within(table).getByText('Energie')).toBeTruthy();
	});

	it('links the EU acts it names that the data holds', async () => {
		const held = {
			...CBW,
			references: CBW.references.map((r) =>
				r.celex === '32019L0944' && r.target ? { ...r, target: { ...r.target, exists: true } } : r
			)
		};
		fakeApi(routes(held));
		render(AnnexReader, { node: node('bwbr0052872_annex_1') });
		await screen.findByRole('table');
		expect(screen.getAllByRole('link', { name: 'Richtlijn (EU) 2019/944' }).length).toBeGreaterThan(
			0
		);
	});

	it('reads one without a text yet by its description', async () => {
		const old = {
			...CBW,
			references: [],
			annex: { ...CBW.annex, text: null, tables: [], description: 'Sector\nEnergie' }
		};
		fakeApi(routes(old));
		render(AnnexReader, { node: node('bwbr0052872_annex_1') });
		expect(await screen.findByText('Energie')).toBeTruthy();
		expect(screen.queryByRole('table')).toBeNull();
	});
});
