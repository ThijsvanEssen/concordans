import { describe, expect, it, vi } from 'vitest';

const goto = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto }));

import { navigate, patchParams, queryHref, readableQuery, withParams } from './address';

const at = (href: string) => new URL(href, 'https://concordans.nl');

describe('readableQuery', () => {
	it('leaves the slash of a node id and the comma of a list unescaped', () => {
		const params = new URLSearchParams({ focus: 'articles/bwbr0001854_287', fase: 'a,b' });
		expect(readableQuery(params)).toBe('focus=articles/bwbr0001854_287&fase=a,b');
	});

	it('still escapes what would break the query', () => {
		expect(readableQuery(new URLSearchParams({ q: 'a&b=c #d' }))).toBe('q=a%26b%3Dc+%23d');
	});
});

describe('queryHref', () => {
	it('drops an empty query', () => {
		expect(queryHref('/actueel', new URLSearchParams())).toBe('/actueel');
	});

	it('adds the fragment', () => {
		expect(queryHref('/explore', new URLSearchParams({ naast: 'documents/x' }), 'lid-2')).toBe(
			'/explore?naast=documents/x#lid-2'
		);
	});
});

describe('withParams', () => {
	const url = at('/explore?focus=articles%2Fbwbr1_2&fase=a%2Cb&open=x#lid-1');

	it('sets a param and keeps the rest readable', () => {
		expect(withParams(url, { naast: 'documents/kst-1' })).toBe(
			'/explore?focus=articles/bwbr1_2&fase=a,b&open=x&naast=documents/kst-1'
		);
	});

	it('removes a param set to null, undefined or the empty string', () => {
		expect(withParams(url, { fase: null, open: '', focus: undefined })).toBe('/explore');
	});

	it('clears the named params before the patch', () => {
		expect(withParams(url, { soort: 'motie' }, { clear: ['open', 'fase'] })).toBe(
			'/explore?focus=articles/bwbr1_2&soort=motie'
		);
	});

	it('drops the fragment unless one is given', () => {
		expect(withParams(url, {}, { hash: 'rov-5.3' })).toBe(
			'/explore?focus=articles/bwbr1_2&fase=a,b&open=x#rov-5.3'
		);
	});

	it('leaves the url it was given alone', () => {
		withParams(url, { fase: null });
		expect(url.searchParams.get('fase')).toBe('a,b');
	});
});

describe('patchParams', () => {
	it('returns a patched copy', () => {
		const params = new URLSearchParams('focus=a&diepte=2');
		expect(patchParams(params, { diepte: null, lezen: '1' }).toString()).toBe('focus=a&lezen=1');
		expect(params.toString()).toBe('focus=a&diepte=2');
	});
});

describe('navigate', () => {
	it('replaces the history entry unless the change is a step', () => {
		navigate('/actueel?q=wet');
		expect(goto).toHaveBeenLastCalledWith('/actueel?q=wet', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
		navigate('/actueel?soort=motie', { step: true });
		expect(goto).toHaveBeenLastCalledWith('/actueel?soort=motie', {
			replaceState: false,
			keepFocus: true,
			noScroll: true
		});
	});
});
