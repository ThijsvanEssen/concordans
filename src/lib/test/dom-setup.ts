// The page of the `.dom.test.ts` files (vite.config.ts): jsdom, with what it lacks and the
// components need, and an empty page again after every test (@testing-library/svelte).
import '@testing-library/svelte/vitest';

// `$env/dynamic/public` reads the page's payload in the browser: none here.
const g = globalThis as { __sveltekit_dev?: { env?: Record<string, string> } };
g.__sveltekit_dev = { env: {}, ...g.__sveltekit_dev };

// jsdom lays nothing out, so nothing grows: a card in the top layer is placed once.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
};
