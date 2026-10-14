// A getter says "geen" only where the API does not have it (404): any other failure rejects,
// and `once` asks again the next time instead of keeping "geen" for the session.
import { describe, expect, it } from 'vitest';
import { fail, fakeApi, slow } from '$lib/test/fakeApi';
import { ApiError } from './client';
import { getDelegated, getLawBasis, getLawDelegated } from './articles';

const getters = [
	{
		name: 'getDelegated',
		path: '/api/articles/{bwb_id}/{article_number}/delegated',
		get: () => getDelegated('BWBR0005537', '3:2')
	},
	{
		name: 'getLawDelegated',
		path: '/api/instruments/{bwb_id}/delegated',
		get: () => getLawDelegated('BWBR0005537')
	},
	{
		name: 'getLawBasis',
		path: '/api/instruments/{bwb_id}/basis',
		get: () => getLawBasis('BWBR0005537')
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

	it('rejects on a time-out', async () => {
		fakeApi({ [path]: slow() });
		await expect(get()).rejects.toMatchObject({ name: 'TimeoutError' });
	});
});
