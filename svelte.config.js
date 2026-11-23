import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { cssHashOf } from './svelte-css-hash.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	// A component's scoping class from its path (svelte-css-hash.js): the first paint of a
	// reader's address sets the same classes ($lib/first-paint).
	compilerOptions: {
		cssHash: ({ filename, hash, css }) =>
			filename && filename !== '(unknown)' ? cssHashOf(filename) : `svelte-${hash(css)}`
	},

	kit: {
		// Concordans is served as static files (Caddy). Every path that is not a file gets
		// index.html, so a readable address (/uitspraken/ECLI:…, /wetten/…/artikel/…) opens
		// the app, and `reroute` in src/hooks.ts serves the Verkenner. The host must fall
		// back to index.html too: Caddy `try_files {path} /index.html`. `precompress` writes a .br
		// and a .gz next to each text file, which Caddy serves as they are (`precompressed br gzip`).
		adapter: adapter({ fallback: 'index.html', precompress: true })
	}
};

export default config;
