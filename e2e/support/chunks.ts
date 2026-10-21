// The chunk a component is built into, from the build's manifest: its file is named by its
// hash alone, so a test that makes a chunk fail finds it here.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

const MANIFEST = '.svelte-kit/output/client/.vite/manifest.json';

/** The URL path of the chunk of `source` ("src/lib/…/VersionCompare.svelte"). */
export function chunkOf(source: string): string {
	const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, { file: string }>;
	const entry = manifest[source];
	if (!entry) throw new Error(`geen chunk voor ${source} in ${MANIFEST}`);
	return `/${entry.file}`;
}

/** The chunk of `source` does not come, until the route is taken away. */
export const failChunk = (page: Page, source: string) => {
	const path = chunkOf(source);
	return page.route(
		(url) => url.pathname === path,
		(route) => route.abort()
	);
};
