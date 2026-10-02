import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetRecords, once } from './records';

describe('once', () => {
	beforeEach(() => forgetRecords());

	it('asks for a record once, also after its answer came', async () => {
		const load = vi.fn(async () => 'dossier 36799');
		expect(await once('dossiers/36799', load)).toBe('dossier 36799');
		expect(await once('dossiers/36799', load)).toBe('dossier 36799');
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('shares a request that is still under way', async () => {
		const load = vi.fn(() => new Promise<string>((r) => setTimeout(() => r('lid'), 5)));
		const [a, b] = await Promise.all([once('members/x', load), once('members/x', load)]);
		expect([a, b]).toEqual(['lid', 'lid']);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('asks again after a failure', async () => {
		const load = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error('503'))
			.mockResolvedValueOnce('stuk');
		await expect(once('documents/y', load)).rejects.toThrow('503');
		expect(await once('documents/y', load)).toBe('stuk');
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('keeps the most recently asked records', async () => {
		const load = vi.fn(async () => 1);
		await once('first', load);
		for (let i = 0; i < 100; i++) await once(`other/${i}`, async () => i);
		await once('first', load);
		expect(load).toHaveBeenCalledTimes(2);
	});
});
