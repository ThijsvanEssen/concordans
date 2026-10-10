import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const antwoorden: unknown[] = [];
const GET = vi.fn(async () => ({ data: antwoorden.shift(), error: undefined }));
vi.mock('./client', () => ({
	api: { GET: (...a: unknown[]) => GET(...(a as [])) },
	unwrap: async (p: Promise<{ data: unknown }>) => (await p).data
}));

const { geteld, nogTeTellen, telling } = await import('./decisions');

const pagina = (total: number | null, partial: boolean) => ({
	items: [{ key: 'a' }],
	total,
	partial,
	facets: total === null ? { kind: [] } : { kind: [{ value: 'Motie', count: total }] }
});

describe('decisions still being counted', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		GET.mockClear();
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
		await vi.advanceTimersByTimeAsync(1500);
		expect((await r).total).toBe(12);
		expect(GET).toHaveBeenCalledTimes(2);
	});

	it('asks only once where the counts came with the page', async () => {
		antwoorden.push(pagina(7, false));
		expect((await geteld({ limit: 1 })).total).toBe(7);
		expect(GET).toHaveBeenCalledTimes(1);
		expect(await telling(pagina(7, false) as never, {})).toBeNull();
	});
});
