// Whether a law or an article holds is said by one component in both readers (besluit 30).
import { describe, expect, it } from 'vitest';
import { bron } from '$lib/test/bronnen';

describe('the stand of a law and of an article', () => {
	it('is drawn by Validity in the reader of a law and in that of an article', () => {
		for (const pad of [
			'lib/components/explore/WholeLawReader.svelte',
			'lib/components/explore/readers/ArticleReader.svelte'
		]) {
			expect(bron(pad), pad).toMatch(/<Validity\b/);
		}
	});
	it('is said of no other place: Vervallen per stands in the one component', () => {
		expect(bron('lib/components/ui/Validity.svelte')).toMatch(/statusOf/);
		expect(bron('lib/text/validity.ts')).toMatch(/Vervallen per/);
	});
});
