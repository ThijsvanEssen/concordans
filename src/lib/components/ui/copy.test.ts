import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPY_MS, createCopier } from './copy.svelte';
import { confirmation } from '$lib/bevestig/bevestig.svelte';

describe('createCopier', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('says Gekopieerd on the button that copied, for two seconds', async () => {
		const copier = createCopier(async () => {});
		await copier.copy('art. 6:162 BW', 'kort');
		expect(copier.label('kort', 'kort')).toBe('Gekopieerd');
		expect(copier.label('voluit', 'voluit')).toBe('voluit');
		expect(confirmation.now?.text).toBe('Gekopieerd');
		vi.advanceTimersByTime(COPY_MS);
		expect(copier.label('kort', 'kort')).toBe('kort');
		expect(confirmation.now).toBeNull();
	});

	it('names what was copied in the status line, when it is given', async () => {
		const copier = createCopier(async () => {});
		await copier.copy('Artikel 6:162 BW', 'kort', 'art. 6:162 BW');
		expect(confirmation.now?.text).toBe('Gekopieerd: art. 6:162 BW');
	});

	it('says Kopiëren mislukt where the clipboard refuses', async () => {
		const copier = createCopier(() => Promise.reject(new Error('denied')));
		expect(await copier.copy('x', 'link')).toBe(false);
		expect(copier.label('link', 'link')).toBe('Kopiëren mislukt');
	});
});
