// The environment of the `.svelte.test.ts` files (vite.config.ts): Svelte compiled as for the
// browser, so the runes of a `.svelte.ts` module react under test. Deriveds follow their state
// and effects run under $effect.root and flushSync; there is no DOM.
import type { Environment } from 'vitest/environments';

export default {
	name: 'client',
	viteEnvironment: 'client',
	setup: () => {
		// `$env/dynamic/public` reads the page's payload in the browser: none here.
		const g = globalThis as { __sveltekit_dev?: { env?: Record<string, string> } };
		g.__sveltekit_dev = { env: {}, ...g.__sveltekit_dev };
		return { teardown: () => {} };
	}
} satisfies Environment;
