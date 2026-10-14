import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeApi } from '$lib/test/fakeApi';
import { geteld, nogTeTellen, telling, WACHTEN } from './decisions';

const antwoorden: unknown[] = [];
let fake: ReturnType<typeof fakeApi>;
const asked = () => fake.asked('/api/decisions').length;

const pagina = (total: number | null, partial: boolean) => ({
	items: [{ key: 'a' }],
	total,
	partial,
	facets: total === null ? { kind: [] } : { kind: [{ value: 'Motie', count: total }] }
});

describe('decisions still being counted', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		fake = fakeApi({ '/api/decisions': () => antwoorden.shift() });
		antwoorden.length = 0;
	});
	afterEach(() => vi.useRealTimers());

	it('knows an answer whose total and facets are still being counted', () => {
		expect(nogTeTellen(pagina(null, true))).toBe(true);
		expect(nogTeTellen(pagina(12, true))).toBe(false); // party_votes only
		expect(nogTeTellen(pagina(12, false))).toBe(false);
	});

	it('asks once more, a moment later, and gives the counted answer', async () => {
		antwoorden.push(pagina(null, true), pagina(12, false));
		const r = geteld({ q: ['stikstof'], limit: 1 });
		await vi.advanceTimersByTimeAsync(WACHTEN[0]);
		expect((await r).total).toBe(12);
		expect(asked()).toBe(2);
	});

	it('asks again, later each time, until the counts come', async () => {
		antwoorden.push(pagina(null, true), pagina(null, true), pagina(null, true), pagina(40, false));
		const r = geteld({ q: ['algoritme'] });
		await vi.advanceTimersByTimeAsync(WACHTEN[0] + WACHTEN[1] + WACHTEN[2]);
		expect((await r).total).toBe(40);
		expect(asked()).toBe(4);
	});

	it('stops asking when the filter changes', async () => {
		antwoorden.push(pagina(null, true), pagina(null, true));
		const ac = new AbortController();
		const r = geteld({ q: ['a'] }, ac.signal);
		await vi.advanceTimersByTimeAsync(WACHTEN[0]);
		ac.abort();
		await expect(r).rejects.toBeDefined();
		expect(asked()).toBe(2);
	});

	it('asks only once where the counts came with the page', async () => {
		antwoorden.push(pagina(7, false));
		expect((await geteld({ limit: 1 })).total).toBe(7);
		expect(asked()).toBe(1);
		expect(await telling(pagina(7, false) as never, {})).toBeNull();
	});
});
