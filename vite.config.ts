import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apiDocs } from './src/lib/api/docs';
import { limitMaxima } from './src/lib/api/limit-maxima';

// Beside index.html in the build, for the server (~/Development/seo-html-ontwerp.md): the
// pages of the app with their title and description ($lib/seo/routes.ts), which it reads for
// a page's head and to tell a page from a 404; the addresses that moved ($lib/seo/moved.ts),
// which it answers with a 301; and the fixed text of the start page
// ($lib/components/home/start.ts), the one source of its HTML of `/`.
const BESIDE_INDEX = {
	'spa-routes.json': 'src/lib/seo/spa-routes.json',
	'moved.json': 'src/lib/seo/moved.json',
	'start.json': 'src/lib/components/home/start.json'
};
const besideIndex: Plugin = {
	name: 'beside-index',
	apply: 'build',
	generateBundle() {
		if (this.environment.config.build.ssr) return;
		for (const [fileName, path] of Object.entries(BESIDE_INDEX))
			this.emitFile({ type: 'asset', fileName, source: readFileSync(path, 'utf8') });
	}
};

// The routes of the API for /api, from the OpenAPI schema: the page carries these, not the
// whole schema.
const API_DOCS = 'virtual:api-docs';
const OPENAPI = fileURLToPath(new URL('./src/lib/api/openapi.json', import.meta.url));
const apiDocsModule: Plugin = {
	name: 'api-docs',
	resolveId(id) {
		if (id === API_DOCS) return `\0${API_DOCS}`;
	},
	load(id) {
		if (id !== `\0${API_DOCS}`) return;
		this.addWatchFile(OPENAPI);
		return `export default ${JSON.stringify(apiDocs(JSON.parse(readFileSync(OPENAPI, 'utf8'))))};`;
	}
};

// The largest `limit` of each route that has one, from the OpenAPI schema ($lib/api/limits):
// a list asked whole follows the API's cap.
const API_LIMITS = 'virtual:api-limits';
const apiLimitsModule: Plugin = {
	name: 'api-limits',
	resolveId(id) {
		if (id === API_LIMITS) return `\0${API_LIMITS}`;
	},
	load(id) {
		if (id !== `\0${API_LIMITS}`) return;
		this.addWatchFile(OPENAPI);
		return `export default ${JSON.stringify(limitMaxima(JSON.parse(readFileSync(OPENAPI, 'utf8'))))};`;
	}
};

/** The tests of a `.svelte.ts` module whose runes must react. */
const RUNES = 'src/**/*.svelte.test.ts';
/** The tests of a component in a page: clicks, focus and keys (src/lib/test/dom-setup.ts). */
const DOM = 'src/**/*.dom.test.ts';

export default defineConfig({
	plugins: [sveltekit(), besideIndex, apiDocsModule, apiLimitsModule],
	// Safari can aggressively cache ESM modules in dev; force fresh loads.
	server: {
		headers: {
			'Cache-Control': 'no-store'
		}
	},
	test: {
		setupFiles: ['src/lib/test/setup.ts'],
		projects: [
			{
				extends: true,
				test: { name: 'unit', include: ['src/**/*.test.ts'], exclude: [RUNES, DOM] }
			},
			// Runes that react: Svelte compiled as for the browser (src/lib/test/client-environment.ts).
			{
				extends: true,
				resolve: { conditions: ['browser'] },
				test: {
					name: 'runes',
					include: [RUNES],
					environment: './src/lib/test/client-environment.ts'
				}
			},
			// Components in a page (jsdom), compiled as for the browser.
			{
				extends: true,
				resolve: { conditions: ['browser'] },
				test: {
					name: 'dom',
					include: [DOM],
					environment: 'jsdom',
					setupFiles: ['src/lib/test/dom-setup.ts']
				}
			}
		]
	}
});
