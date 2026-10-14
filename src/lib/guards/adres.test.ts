// The address and the requests: one client, one way to patch the URL.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

describe('the address and the requests', () => {
	it('sets how long a request waits only in $lib/api/client.ts (api or slowApi)', () => {
		// A caller's own timeout can only shorten the client's: 30 s on top of `api` gave up after 10.
		expect(
			overtreders((t) => /AbortSignal\.timeout\(/.test(t), [plek('lib/api/client.ts')])
		).toEqual([]);
	});

	it('builds a readable query and patches the address only in $lib/util/address.ts', () => {
		// A copy of its own forgot the comma once: %2C in the address bar of Bladeren.
		expect(overtreders((t) => /%2F|%2C/.test(t), [plek('lib/util/address.ts')])).toEqual([]);
		expect(overtreders((t) => /new URL\(page\.url\)/.test(t))).toEqual([]);
	});

	it('makes a filter a step in the history on every page of filters, typing not (#50)', () => {
		// Actueel and Bladeren step on a filter and replace on typing; the overview of a topic
		// has filters only, so every patch it makes is a step.
		for (const path of [
			'routes/(main)/actueel/+page.svelte',
			'lib/components/explore/IndexView.svelte'
		])
			expect(bron(path), path).toMatch(/navigate\([^;]*\{ step: !replaceState \}\)/);
		expect(bron('routes/(main)/onderwerpen/overzicht/+page.svelte')).toMatch(
			/const zet = [^;]*navigate\([^;]*\{ step: true \}\)/
		);
	});
});
