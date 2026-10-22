// The tiles of a commissie: its leden as the data has them (a gap is not "0 Leden", B11), its
// open dossiers as the API counts them, the outcomes only of the dossiers all loaded.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fakeApi } from '$lib/test/fakeApi';
import type { GraphNode } from '$lib/graph/types';
import CommitteeReader from './CommitteeReader.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const node = {
	id: 'committees/c1',
	key: 'c1',
	collection: 'committees',
	label: 'Vaste commissie voor Justitie',
	raw: { props: { slug: 'justitie', chamber: 'TK', name: 'Vaste commissie voor Justitie' } }
} as unknown as GraphNode;

const dossier = (n: number, outcome: string | null) => ({
	key: `d${n}`,
	number: String(n),
	closed: !!outcome,
	outcome
});

const read = async (detail: Record<string, unknown>) => {
	fakeApi({
		'/api/committees/{slug}': { key: 'c1', chamber: 'TK', active_dossier_count: 41, ...detail },
		'/api/cabinets': []
	});
	const { container } = render(CommitteeReader, { node });
	await screen.findByText('Open dossiers');
	return Object.fromEntries(
		[...container.querySelectorAll('.stats li')].map((li) => [
			li.querySelector('.stat-label')?.textContent,
			li.querySelector('.stat-num')?.textContent?.trim()
		])
	);
};

describe('the tiles of a commissie', () => {
	it('says a commissie without a seat in the data is not known, not "0 Leden"', async () => {
		const tiles = await read({ members: null, dossiers: [], dossier_total: 0 });
		expect(tiles.Leden).toBe('niet in de gegevens');
	});

	it('counts the leden it has, and none when no seat is current', async () => {
		const tiles = await read({
			members: [{ key: 'm1', name: 'A. Jansen', role: null }],
			dossiers: [],
			dossier_total: 0
		});
		expect(tiles.Leden).toBe('1');
	});

	it('counts none when no seat is current', async () => {
		expect((await read({ members: [], dossiers: [], dossier_total: 0 })).Leden).toBe('0');
	});

	it('takes the open dossiers from the API, not from the page of dossiers loaded', async () => {
		const tiles = await read({
			members: [],
			dossiers: [dossier(1, null), dossier(2, null)],
			dossier_total: 59
		});
		expect(tiles['Open dossiers']).toBe('41');
	});

	it('leaves the outcomes out where only a page of the dossiers is loaded', async () => {
		const part = await read({
			members: [],
			dossiers: [dossier(1, 'aangenomen')],
			dossier_total: 59
		});
		expect(Object.keys(part)).not.toContain('Aangenomen');
	});

	it('counts the outcomes where every dossier is loaded', async () => {
		const all = await read({
			members: [],
			dossiers: [dossier(1, 'aangenomen')],
			dossier_total: 1
		});
		expect(all.Aangenomen).toBe('1');
	});
});
