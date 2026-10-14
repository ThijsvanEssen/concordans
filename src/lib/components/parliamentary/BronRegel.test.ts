import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import BronRegel from './BronRegel.svelte';

const text = (props: Record<string, unknown>) =>
	render(BronRegel, {
		props: { label: 'Eerste Kamer', href: 'https://www.eerstekamer.nl', ...props }
	})
		.body.replace(/<!--[^>]*-->/g, '')
		.replace(/<[^>]+>/g, '')
		.replace(/\s+/g, ' ')
		.trim();

describe('BronRegel', () => {
	it('says the composition, the data since and the source', () => {
		expect(text({ composedOn: '2026-10-01', dataSince: '2003-01-01' })).toBe(
			'Samenstelling op 1 oktober 2026, gegevens sinds 1 januari 2003. Bron: Eerste Kamer.'
		);
	});

	it('leaves out the data since when it is not known, and the composition with it', () => {
		expect(text({ composedOn: '2026-10-01' })).toBe(
			'Samenstelling op 1 oktober 2026. Bron: Eerste Kamer.'
		);
		expect(text({ dataSince: '2003-01-01' })).toBe('Bron: Eerste Kamer.');
	});

	it('says when the source was consulted, after the link', () => {
		expect(text({ readOn: '2026-10-02' })).toBe(
			'Bron: Eerste Kamer, geraadpleegd op 2 oktober 2026.'
		);
	});

	it('links the source outward', () => {
		expect(render(BronRegel, { props: { label: 'EK', href: 'https://x.nl' } }).body).toMatch(
			/<a href="https:\/\/x\.nl" rel="external"[^>]*>EK<\/a>/
		);
	});
});
