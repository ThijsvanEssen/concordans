import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import type { Plugin, Rollup } from 'vite';
import { readFileSync } from 'node:fs';
import { build as esbuild } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { cssHashOf } from './svelte-css-hash.js';
import { COMPONENTS, type Build, type Classes } from './src/lib/first-paint/classes';
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
// And the script of the first paint of a reader's address ($lib/first-paint), on its own:
// the server inlines it after the bron it puts in the page, so it runs before the browser
// paints, long before the app's chunks are in. It sets the app's own classes (each
// component's scoping class, svelte-css-hash.js) and loads the app's own stylesheets of those
// components, the layout's first: those it is given here.
const FIRST_PAINT = {
	'first-paint.js': 'src/lib/first-paint/entry.ts',
	'first-paint-article.js': 'src/lib/first-paint/entry-article.ts',
	'first-paint-judgment.js': 'src/lib/first-paint/entry-judgment.ts',
	'first-paint-law.js': 'src/lib/first-paint/entry-law.ts',
	'first-paint-paper.js': 'src/lib/first-paint/entry-paper.ts'
};
const LAYOUT = 'src/routes/+layout.svelte';
export async function firstPaintScript(build: Build, entry: string): Promise<string> {
	const out = await esbuild({
		entryPoints: [entry],
		bundle: true,
		write: false,
		minify: true,
		format: 'iife',
		target: 'es2022',
		alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) },
		define: { __FIRST_PAINT__: JSON.stringify(build) },
		logLevel: 'silent'
	});
	return out.outputFiles[0].text;
}
/** The stylesheets of the chunks that hold `files`, in that order, each once. */
function stylesheetsOf(bundle: Rollup.OutputBundle, files: string[]): string[] {
	const css: string[] = [];
	for (const file of files.map((f) => resolve(f)))
		for (const chunk of Object.values(bundle))
			if (chunk.type === 'chunk' && chunk.moduleIds.includes(file))
				for (const name of chunk.viteMetadata?.importedCss ?? [])
					if (!css.includes(`/${name}`)) css.push(`/${name}`);
	return css;
}
const besideIndex: Plugin = {
	name: 'beside-index',
	apply: 'build',
	async generateBundle(_options, bundle) {
		if (this.environment.config.build.ssr) return;
		for (const [fileName, path] of Object.entries(BESIDE_INDEX))
			this.emitFile({ type: 'asset', fileName, source: readFileSync(path, 'utf8') });
		const files = Object.values(COMPONENTS);
		const build: Build = {
			classes: Object.fromEntries(
				Object.entries(COMPONENTS).map(([name, file]) => [name, cssHashOf(file)])
			) as Classes,
			css: stylesheetsOf(bundle, [LAYOUT, ...files])
		};
		for (const [fileName, entry] of Object.entries(FIRST_PAINT))
			this.emitFile({ type: 'asset', fileName, source: await firstPaintScript(build, entry) });
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
