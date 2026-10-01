import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Concordans is served as static files (Caddy). Every path that is not a file gets
		// index.html, so a readable address (/uitspraken/ECLI:…, /wetten/…/artikel/…) opens
		// the app, and `reroute` in src/hooks.ts serves the Verkenner. The host must fall
		// back to index.html too: Caddy `try_files {path} /index.html`.
		adapter: adapter({ fallback: 'index.html' })
	}
};

export default config;
