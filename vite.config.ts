import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// Safari can aggressively cache ESM modules in dev; force fresh loads.
	server: {
		headers: {
			'Cache-Control': 'no-store'
		},
		proxy: {
			'/api': {
				target: 'http://localhost:8000',
				changeOrigin: true,
				// The SvelteKit /api docs page lives at the bare /api path. Vite's
				// proxy otherwise gobbles every /api* URL and forwards it to the
				// FastAPI backend, which 404s on the empty path. Returning the URL
				// from bypass tells Vite to skip the proxy and serve the page.
				bypass(req) {
					const url = req.url ?? '';
					// Strip query string for the comparison.
					const path = url.split('?')[0];
					if (path === '/api' || path === '/api/') return url;
				}
			}
		}
	}
});
