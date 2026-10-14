// Something done once Svelte has written the state just set to the page: a focus, a scroll,
// a measure. A throw in it is a bug, reported ($lib/api/errors.ts), not left floating.
import { tick } from 'svelte';
import { report } from '$lib/api/errors';

export function afterTick(fn: () => void): void {
	tick()
		.then(fn)
		.catch((e) => report('Na het tekenen', e));
}
