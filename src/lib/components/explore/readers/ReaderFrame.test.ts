import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { ApiError } from '$lib/api/client';
import type { LoadState } from '$lib/util/load.svelte';
import ReaderFrame from './ReaderFrame.svelte';

const head = createRawSnippet(() => ({ render: () => '<h1>Vaste commissie voor Justitie</h1>' }));
const loading = createRawSnippet(() => ({ render: () => '<p>Periode</p>' }));
const children = createRawSnippet((leden: () => number) => ({
	render: () => `<p>${leden()} leden</p>`
}));

const html = (state: LoadState<number>, extra: Record<string, unknown> = {}) =>
	render(ReaderFrame<number>, {
		props: { state, what: 'Commissie', retry: () => {}, children, ...extra }
	}).body;

describe('ReaderFrame', () => {
	it('holds the place with a skeleton while the reader loads, under the head', () => {
		const body = html({ status: 'loading' }, { head });
		expect(body).toContain('Vaste commissie voor Justitie');
		expect(body).toContain('skeleton');
		expect(body).not.toContain('leden');
	});

	it('draws the reader’s own rows in place of the skeleton where it has them', () => {
		const body = html({ status: 'loading' }, { loading });
		expect(body).toContain('<p>Periode</p>');
		expect(body).not.toContain('skeleton');
	});

	it('names a failure of the reader, with Opnieuw, and keeps the head', () => {
		const body = html({ status: 'error', error: new ApiError(500, '/api/x') }, { head });
		expect(body).toContain('Vaste commissie voor Justitie');
		expect(body).toContain('role="alert"');
		expect(body).toContain('Commissie kon niet worden geladen.');
		expect(body).toContain('Opnieuw');
		expect(body).not.toContain('leden');
	});

	it('says a slow answer apart from a broken one', () => {
		const body = html({ status: 'error', error: new ApiError(504, '/api/x') });
		expect(body).toContain('Commissie kon niet op tijd worden geladen.');
	});

	it('draws the body from the data once it is in', () => {
		const body = html({ status: 'ready', data: 12 }, { head });
		expect(body).toContain('<p>12 leden</p>');
		expect(body).not.toContain('role="alert"');
	});

	it('draws the body at once without a load', () => {
		const plain = createRawSnippet(() => ({ render: () => '<p>Tekst</p>' }));
		expect(render(ReaderFrame, { props: { children: plain } }).body).toContain('<p>Tekst</p>');
	});
});
