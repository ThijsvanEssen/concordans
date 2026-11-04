import { describe, expect, it, vi } from 'vitest';

const resolveQuery = vi.fn();
vi.mock('$lib/api/search', () => ({ resolveQuery }));
const { citedByName, pathByName } = await import('./law-name');

describe('a law named by its abbreviation in the address', () => {
	it('is cited as a reader writes it, only where the law is no id', () => {
		expect(citedByName({ kind: 'artikel', law: 'WFT', number: '1:1' })).toBe('art. 1:1 WFT');
		expect(citedByName({ kind: 'wet', law: 'AWB' } as never)).toBe('AWB');
		expect(citedByName({ kind: 'artikel', law: 'BWBR0020368', number: '1:1' })).toBeNull();
		// A treaty's id is an id too: its own address no name to resolve (a loop before).
		expect(citedByName({ kind: 'artikel', law: 'BWBV0007162', number: '15' })).toBeNull();
		expect(citedByName({ kind: 'artikel', law: 'STB-2026-56', number: '2.8.6' })).toBeNull();
		expect(citedByName({ kind: 'uitspraak', ecli: 'ECLI:NL:HR:2019:2006' } as never)).toBeNull();
	});

	it('goes to the address the API resolves it to, of the same kind', async () => {
		resolveQuery.mockResolvedValue({
			kind: 'article',
			match: { path: '/wetten/BWBR0020368/artikel/1:1' }
		});
		expect(await pathByName({ kind: 'artikel', law: 'WFT', number: '1:1' })).toBe(
			'/wetten/BWBR0020368/artikel/1:1'
		);
		resolveQuery.mockResolvedValue({ kind: 'instrument', match: { path: '/wetten/BWBR0020368' } });
		expect(await pathByName({ kind: 'artikel', law: 'WFT', number: '999' })).toBeNull();
		resolveQuery.mockResolvedValue({ kind: 'none', match: null });
		expect(await pathByName({ kind: 'artikel', law: 'XYZ', number: '1' })).toBeNull();
	});
});
