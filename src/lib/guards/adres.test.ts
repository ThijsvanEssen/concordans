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
		// Bladeren, Actueel and Zoeken by filterAddress: a step on a filter, a replace on typing;
		// the overview of a topic has filters only, so every patch it makes is a step.
		expect(bron('lib/util/address.ts')).toMatch(/navigate\(href\(p\), \{ step: !replace \}\)/);
		expect(bron('routes/(main)/onderwerpen/overzicht/+page.svelte')).toMatch(
			/const zet = [^;]*navigate\([^;]*\{ step: true \}\)/
		);
	});

	it('keeps the filters of a list page in the address by filterAddress (audit dubbele helpers, 6)', () => {
		// Three copies differed: the open row kept after a sort, the search text not trimmed, 250
		// or 300 ms.
		for (const path of [
			'routes/(main)/actueel/+page.svelte',
			'routes/(main)/zoeken/+page.svelte',
			'lib/components/explore/IndexView.svelte'
		]) {
			expect(bron(path), path).toContain('filterAddress(');
			expect(bron(path), path).not.toMatch(/clearTimeout\(q?[tT]imer\)/);
		}
	});

	it('reads a bound of a period by alsDag: ?van=2024-13-45 is no bound (audit dubbele helpers, 5)', () => {
		const rauw = (t: string) =>
			t
				.split('\n')
				.some(
					(l) =>
						/\.get\((PARAM\.(since|until)|'van'|'tot'|P\.(from|to))\)/.test(l) &&
						!l.includes('alsDag(')
				) || /const dag = \(v: string \| null\)/.test(t);
		expect(overtreders(rauw)).toEqual([]);
	});

	it('reads a list in one param by listParam (audit dubbele helpers, B)', () => {
		// Six ways of `split(',')`: trimmed or not, each once or not, old names or not.
		const eigen = (t: string) => /get\([^)]*\)(\s*\?\?\s*'')?\)?\s*\.split\(','\)/.test(t);
		expect(overtreders(eigen)).toEqual([]);
	});

	it('gives an href its query by queryHref (audit dubbele helpers, B)', () => {
		// `new URLSearchParams` by hand escapes the comma and the slash (%2C) and keeps an empty value.
		const hand = (t: string) => /\?\$?\{new URLSearchParams\(/.test(t);
		expect(overtreders(hand)).toEqual([]);
	});
});
