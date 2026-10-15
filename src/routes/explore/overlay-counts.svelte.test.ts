import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseOverlay } from '$lib/selection/overlay';
import { OverlayCounts } from './overlay-counts.svelte';

const getInFlux = vi.fn(async () => new Map([['a', 1]]));
const getHeat = vi.fn(async (_months: number, ids: string[]) => new Map(ids.map((id) => [id, 2])));

vi.mock('$lib/api/overlays', () => ({
	getInFlux: () => getInFlux(),
	getHeat: (months: number, ids: string[]) => getHeat(months, ids)
}));

afterEach(() => vi.clearAllMocks());

/** Overlay counts that follow an address, as the network page reads it: a new overlay per step. */
function follow(search: string, ids: string[]) {
	const page = $state({ search, ids });
	const overlay = $derived(parseOverlay(new URLSearchParams(page.search).get('overlay')));
	let counts!: OverlayCounts;
	const stop = $effect.root(() => {
		counts = new OverlayCounts(
			() => overlay,
			() => page.ids
		);
	});
	flushSync();
	return { page, counts, stop };
}

const settle = async () => {
	await new Promise((r) => setTimeout(r, 0));
	flushSync();
};

describe('OverlayCounts', () => {
	it('keeps the heat counts when a step changes the address but not the overlay', async () => {
		const { page, counts, stop } = follow('overlay=heat:12&focus=a', ['a', 'b']);
		await settle();
		expect(counts.heat.size).toBe(2);
		page.search = 'overlay=heat:12&focus=b';
		flushSync();
		await settle();
		expect(counts.heat.size).toBe(2);
		expect(getHeat).toHaveBeenCalledTimes(1);
		stop();
	});

	it('asks for the open dossiers once per overlay choice, not per step', async () => {
		const { page, counts, stop } = follow('overlay=open&focus=a', ['a']);
		await settle();
		page.search = 'overlay=open&focus=b';
		flushSync();
		await settle();
		expect(getInFlux).toHaveBeenCalledTimes(1);
		expect(counts.inFlux.get('a')).toBe(1);
		stop();
	});
});
