import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';

// The query parameters of the API's list routes, from the schema `npm run sync:api` keeps:
// a filter the API does not take yet (a period, Thijs 9 Oct) stays hidden until it does.
// Only these names go into the bundle, not the 0.5 MB schema ($lib/api/heeft).
type Spec = { paths: Record<string, { get?: { parameters?: { name: string; in: string }[] } }> };
const spec = JSON.parse(readFileSync('src/lib/api/openapi.json', 'utf8')) as Spec;
const listParams = Object.fromEntries(
	Object.entries(spec.paths)
		.filter(([path, op]) => /^\/api\/[a-z_]+$/.test(path) && op.get)
		.map(([path, op]) => [
			path,
			(op.get!.parameters ?? []).filter((p) => p.in === 'query').map((p) => p.name)
		])
);

// The pages of the app with their title and description ($lib/seo/routes.ts), next to
// index.html in the build: the server reads it for a page's head, and to tell a page from
// a 404 (~/Development/seo-html-ontwerp.md).
const spaRoutes: Plugin = {
	name: 'spa-routes',
	apply: 'build',
	generateBundle() {
		if (this.environment.config.build.ssr) return;
		this.emitFile({
			type: 'asset',
			fileName: 'spa-routes.json',
			source: readFileSync('src/lib/seo/spa-routes.json', 'utf8')
		});
	}
};

export default defineConfig({
	plugins: [sveltekit(), spaRoutes],
	define: { __API_LIST_PARAMS__: JSON.stringify(listParams) },
	// Safari can aggressively cache ESM modules in dev; force fresh loads.
	server: {
		headers: {
			'Cache-Control': 'no-store'
		}
	},
	test: {
		include: ['src/**/*.test.ts']
	}
});
