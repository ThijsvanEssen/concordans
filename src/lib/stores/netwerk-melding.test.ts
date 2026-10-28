import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { meldNetwerk, showNetworkFailure, netwerkMelding } from './netwerk-melding';
import { confirmation, undo } from '$lib/bevestig/bevestig.svelte';

afterEach(() => {
	vi.useRealTimers();
	netwerkMelding.set(null);
});

describe('a failure on the network', () => {
	it('stays until Opnieuw, which clears it and asks exactly that again', () => {
		vi.useFakeTimers();
		meldNetwerk('Getekend.', null);
		const retry = vi.fn();
		showNetworkFailure({ what: 'Het netwerk', error: new Error('503'), retry });
		vi.advanceTimersByTime(60_000);
		const melding = get(netwerkMelding);
		expect(melding?.failure?.what).toBe('Het netwerk');
		melding?.failure?.retry();
		expect(retry).toHaveBeenCalledOnce();
		expect(get(netwerkMelding)).toBeNull();
	});
});

describe('what the last action did', () => {
	const phone = (is: boolean) => vi.stubGlobal('window', { matchMedia: () => ({ matches: is }) });
	afterEach(() => {
		vi.unstubAllGlobals();
		if (confirmation.now) undo();
	});

	it('is said through Bevestiging with its way back where the screen is wider than a phone', () => {
		phone(false);
		const terug = vi.fn();
		meldNetwerk('Art. 2 EVRM toegevoegd aan het netwerk.', terug);
		expect(confirmation.now?.text).toBe('Art. 2 EVRM toegevoegd aan het netwerk');
		expect(get(netwerkMelding)).toBeNull();
		undo();
		expect(terug).toHaveBeenCalledOnce();
	});

	it('stays the melding of the network on a phone', () => {
		phone(true);
		meldNetwerk('Art. 2 EVRM toegevoegd aan het netwerk.', () => {});
		expect(get(netwerkMelding)?.tekst).toBe('Art. 2 EVRM toegevoegd aan het netwerk.');
		expect(confirmation.now).toBeNull();
	});
});
