import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';

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
	// Safari can aggressively cache ESM modules in dev; force fresh loads.
	server: {
		headers: {
			'Cache-Control': 'no-store'
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		setupFiles: ['src/lib/test/setup.ts']
	}
});
