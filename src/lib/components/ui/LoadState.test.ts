import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { ApiError } from '$lib/api/client';
import type { LoadState as State } from '$lib/util/load.svelte';
import LoadState from './LoadState.svelte';

const empty = createRawSnippet(() => ({ render: () => '<p class="stil">Geen leden.</p>' }));
const children = createRawSnippet((names: () => string[]) => ({
	render: () =>
		`<ul>${names()
			.map((n) => `<li>${n}</li>`)
			.join('')}</ul>`
}));

const html = (state: State<string[]>, extra: Record<string, unknown> = {}) =>
	render(LoadState<string[]>, {
		props: { state, what: 'De fractie', empty, children, ...extra }
	}).body;

describe('LoadState', () => {
	it('says Laden… in a quiet line, or holds the place with a skeleton', () => {
		expect(html({ status: 'loading' })).toMatch(
			/<p class="stil[^"]*"[^>]*>Laden…(?:<!---->)?<\/p>/
		);
		const block = html({ status: 'loading' }, { form: 'block' });
		expect(block).toContain('skeleton');
		expect(block).not.toContain('Laden…');
		expect(block).not.toContain('role="alert"');
	});

	it('names what failed, as an alert, with Opnieuw only where it can ask again', () => {
		const error = { status: 'error', error: new ApiError(500, '/api/x') } as const;
		const plain = html(error);
		expect(plain).toContain('role="alert"');
		expect(plain).toContain('De fractie kon niet worden geladen.');
		expect(plain).not.toContain('Opnieuw');
		expect(plain).not.toContain('Geen leden.');
		expect(html(error, { retry: () => {} })).toContain('Opnieuw');
	});

	it('says what failed in the singular, or in the plural where the subject is', () => {
		const error = { status: 'error', error: new ApiError(500, '/api/x') } as const;
		expect(html(error)).toContain('De fractie kon niet worden geladen.');
		const many = html(error, { what: 'De tekstversies', plural: true });
		expect(many).toContain('De tekstversies konden niet worden geladen.');
		const slow = html(
			{ status: 'error', error: new ApiError(504, '/api/x') },
			{ what: 'De tekstversies', plural: true }
		);
		expect(slow).toContain('De tekstversies konden niet op tijd worden geladen.');
	});

	it('gives a 500 the API logged its kenmerk, small after the sentence', () => {
		const id = '1a2b3c4d-0000-4000-8000-000000000000';
		const logged = html({ status: 'error', error: new ApiError(500, '/api/x', id) });
		expect(logged).toContain('kenmerk 1a2b3c4d');
		expect(logged).not.toContain(id);
		expect(html({ status: 'error', error: new ApiError(504, '/api/x', id) })).not.toContain(
			'kenmerk'
		);
	});

	it('stands as a span inside running text or a card that is one', () => {
		const error = { status: 'error', error: new ApiError(500, '/api/x') } as const;
		const span = html(error, { tag: 'span', retry: () => {} });
		expect(span).toMatch(/<span class="stil failure[^"]*" role="alert">/);
		expect(span).toContain('Opnieuw');
		expect(span).not.toContain('<p');
	});

	it('says a slow answer apart from a broken one', () => {
		const slow = html({ status: 'error', error: new ApiError(504, '/api/x') });
		expect(slow).toContain('De fractie kon niet op tijd worden geladen.');
	});

	it('says a 429 apart, with its wait, and Opnieuw only once the wait is over', () => {
		const waiting = html({ status: 'error', error: new ApiError(429, '/api/x', null, 12) });
		expect(waiting).toContain('Even te veel verzoeken, opnieuw over 12 s.');
		expect(waiting).toContain('role="status"');
		expect(waiting).not.toContain('kon niet');
		const over = html(
			{ status: 'error', error: new ApiError(429, '/api/x', null, 0) },
			{ retry: () => {} }
		);
		expect(over).toContain('Even te veel verzoeken.');
		expect(over).toContain('Opnieuw');
	});

	it('shows empty only from ready with nothing in it', () => {
		const leeg = html({ status: 'ready', data: [] });
		expect(leeg).toContain('Geen leden.');
		expect(leeg).not.toContain('role="alert"');
		const vol = html({ status: 'ready', data: ['Jansen'] });
		expect(vol).toContain('<li>Jansen</li>');
		expect(vol).not.toContain('Geen leden.');
	});
});
