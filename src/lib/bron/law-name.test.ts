import { describe, expect, it, vi } from 'vitest';

const resolveQuery = vi.fn();
vi.mock('$lib/api/search', () => ({ resolveQuery }));
const { citedByName, pathByName } = await import('./law-name');

describe('a law named by its abbreviation in the address', () => {
	it('is cited as a reader writes it, only where the law is no id', () => {
		expect(citedByName({ soort: 'artikel', wet: 'WFT', nummer: '1:1' })).toBe('art. 1:1 WFT');
		expect(citedByName({ soort: 'wet', wet: 'AWB' } as never)).toBe('AWB');
		expect(citedByName({ soort: 'artikel', wet: 'BWBR0020368', nummer: '1:1' })).toBeNull();
		expect(citedByName({ soort: 'artikel', wet: 'STB-2026-56', nummer: '2.8.6' })).toBeNull();
		expect(citedByName({ soort: 'uitspraak', ecli: 'ECLI:NL:HR:2019:2006' } as never)).toBeNull();
	});

	it('goes to the address the API resolves it to, of the same kind', async () => {
		resolveQuery.mockResolvedValue({
			kind: 'article',
			match: { path: '/wetten/BWBR0020368/artikel/1:1' }
		});
		expect(await pathByName({ soort: 'artikel', wet: 'WFT', nummer: '1:1' })).toBe(
			'/wetten/BWBR0020368/artikel/1:1'
		);
		resolveQuery.mockResolvedValue({ kind: 'instrument', match: { path: '/wetten/BWBR0020368' } });
		expect(await pathByName({ soort: 'artikel', wet: 'WFT', nummer: '999' })).toBeNull();
		resolveQuery.mockResolvedValue({ kind: 'none', match: null });
		expect(await pathByName({ soort: 'artikel', wet: 'XYZ', nummer: '1' })).toBeNull();
	});
});
