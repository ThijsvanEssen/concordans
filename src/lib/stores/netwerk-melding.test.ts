import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { meldNetwerk, showNetworkFailure, netwerkMelding } from './netwerk-melding';

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
