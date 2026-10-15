import { describe, expect, it } from 'vitest';
import { fail, fakeApi, type FakeRequest } from '$lib/test/fakeApi';
import { ApiError } from '$lib/api/client';
import { lazeKernIds } from './behoort';
import { procesgangIds } from '$lib/bron/behoort-procesgang';

// A judgment and the instance before it: `hr` was appealed from `hof`, `hof` from `rb`.
const appealOf = (key: string, before: string | null) => ({
	node: { key, collection: 'judgments', props: {} },
	neighbors: {
		total: before ? 1 : 0,
		buckets: before
			? [
					{
						relation: 'APPEAL_OF',
						direction: 'outbound',
						collection: 'judgments',
						total: 1,
						items: [
							{
								key: before,
								collection: 'judgments',
								display_name: before,
								relation: 'APPEAL_OF',
								direction: 'outbound'
							}
						]
					}
				]
			: []
	}
});
const keyOf = (r: FakeRequest) => String(r.params.path?.key);

describe('procesgangIds', () => {
	it('names the instances before the eerdere aanleg', async () => {
		const chain: Record<string, string | null> = { hr1: 'hof1', hof1: 'rb1', rb1: null };
		fakeApi({ '/api/nodes/{collection}/{key}': (r) => appealOf(keyOf(r), chain[keyOf(r)]) });
		expect(await procesgangIds('hr1')).toEqual(['judgments/rb1']);
	});

	it('fails where a step of the chain fails, rather than giving a shorter procesgang', async () => {
		fakeApi({
			'/api/nodes/{collection}/{key}': (r) =>
				keyOf(r) === 'hr2' ? appealOf('hr2', 'hof2') : fail(500)
		});
		await expect(procesgangIds('hr2')).rejects.toBeInstanceOf(ApiError);
	});

	it('ends where the data has no node for a step', async () => {
		fakeApi({
			'/api/nodes/{collection}/{key}': (r) =>
				keyOf(r) === 'hr3' ? appealOf('hr3', 'hof3') : fail(404)
		});
		expect(await procesgangIds('hr3')).toEqual([]);
	});
});

describe('lazeKernIds', () => {
	it('fails where the dossier fails', async () => {
		fakeApi({ '/api/dossiers/{number}': fail(500) });
		await expect(lazeKernIds('dossiers', '36001', { label: '36001' })).rejects.toBeInstanceOf(
			ApiError
		);
	});

	it('names nothing for a dossier the data lacks', async () => {
		fakeApi({ '/api/dossiers/{number}': fail(404) });
		expect(await lazeKernIds('dossiers', '36002', { label: '36002' })).toEqual([]);
	});
});
