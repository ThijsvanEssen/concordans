import { describe, expect, it, vi } from 'vitest';
import { fail, fakeApi } from '$lib/test/fakeApi';
import { ApiError } from './client';
import { loadDossierHub } from '$lib/verbonden/dossier-hub';
import {
	getDecisionDocument,
	getDossierDocuments,
	getExplainedBy,
	getExplanations,
	once,
	RECORDS_KEPT
} from './records';

describe('once', () => {
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
		for (let i = 0; i < RECORDS_KEPT; i++) await once(`other/${i}`, async () => i);
		await once('first', load);
		expect(load).toHaveBeenCalledTimes(2);
	});
});

describe('getters that say "geen" only for a 404', () => {
	const getters = [
		{
			name: 'getDecisionDocument',
			path: '/api/decisions/{key}/document',
			get: () => getDecisionDocument('d1')
		},
		{
			name: 'getExplanations',
			path: '/api/articles/{bwb_id}/{article_number}/explanations',
			get: () => getExplanations('BWBR0005537', '3:2')
		},
		{
			name: 'getExplainedBy',
			path: '/api/articles/{bwb_id}/{article_number}/explained-by',
			get: () => getExplainedBy('BWBR0005537', '3:2')
		},
		{
			name: 'getDossierDocuments',
			path: '/api/dossiers/{number}/documents',
			get: () => getDossierDocuments('36327')
		}
	] as const;

	describe.each(getters)('$name', ({ path, get }) => {
		it('gives null where the API does not have it', async () => {
			fakeApi({ [path]: fail(404) });
			expect(await get()).toBeNull();
		});

		it('rejects on a failure, and asks again the next time', async () => {
			const answers: unknown[] = [fail(500), { total: 0, items: [] }];
			const fake = fakeApi({ [path]: () => answers.shift() });
			await expect(get()).rejects.toBeInstanceOf(ApiError);
			expect(await get()).toEqual({ total: 0, items: [] });
			expect(fake.asked(path)).toHaveLength(2);
		});
	});
});

describe('the documents of a dossier', () => {
	it('are asked once for the reader and the panel Verbonden', async () => {
		const fake = fakeApi({
			'/api/dossiers/{number}': { key: '36001', number: '36001', instruments: [], committees: [] },
			'/api/dossiers/{number}/documents': { items: [], total: 0 }
		});
		await Promise.all([getDossierDocuments('36001'), loadDossierHub('36001')]);
		expect(fake.asked('/api/dossiers/{number}/documents')).toHaveLength(1);
	});
});
