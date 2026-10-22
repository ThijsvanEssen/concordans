// One name per filter on every page: Bronnen, Actueel, Onderwerpen and Verbonden write a
// shared filter under the name of PARAM, and none under a name of its own.
import { describe, expect, it } from 'vitest';
import { FEED_FILTER_PARAMS as ACTUEEL } from '$lib/components/actueel/filters';
import { INDEX_FILTER_PARAMS as BRONNEN } from '$lib/components/explore/index/lists/params';
import { EMPTY_FILTER, filterParams } from '$lib/verbonden/filter';
import { patchParams } from '$lib/util/address';
import { PARAM } from './filters';

/** The names the pages had for a shared filter before there was one. */
const OLD = ['from', 'to', 'party', 'faction', 'cabinet', 'ministry', 'member', 'coalition'];
const OLD_TOO = ['outcome', 'zoek', 'stage'];

describe('the filters in the address', () => {
	it('name no shared filter by an old name', () => {
		const verbonden = Object.keys(filterParams(EMPTY_FILTER));
		for (const names of [BRONNEN, ACTUEEL, verbonden])
			for (const name of [...OLD, ...OLD_TOO]) expect(names).not.toContain(name);
	});

	it('name each filter Actueel shares with Bronnen alike', () => {
		const shared = Object.values(PARAM) as string[];
		const own = ['wet', 'artikel', 'komend', 'stemde', 'stem'];
		for (const name of ACTUEEL) expect([...shared, ...own]).toContain(name);
	});

	it('are all cleared by a tab of Bronnen, but the Kamer', () => {
		const all = new URLSearchParams(Object.values(PARAM).map((name) => [name, 'x']));
		const left = patchParams(all, {}, [...BRONNEN, 'open']);
		expect([...left.keys()]).toEqual([PARAM.chamber]);
	});
});
