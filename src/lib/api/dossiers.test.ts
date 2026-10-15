import { describe, expect, it } from 'vitest';
import { fail, fakeApi } from '$lib/test/fakeApi';
import { getChangedArticles } from './dossiers';

describe('getChangedArticles', () => {
	const path = '/api/dossiers/{number}/changed-articles';

	it('gives null where the API has no changes for the dossier (404)', async () => {
		fakeApi({ [path]: fail(404) });
		expect(await getChangedArticles('36327')).toBeNull();
	});

	it('throws the API error with its status on a failure', async () => {
		fakeApi({ [path]: fail(500) });
		await expect(getChangedArticles('36327')).rejects.toMatchObject({ status: 500 });
	});
});
