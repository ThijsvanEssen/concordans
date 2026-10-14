// A failure is handled where its cause is known, or passed on ($lib/api/errors.ts,
// $lib/util/load.svelte.ts, LoadState). Code-eenvoud F01, F05, F06.
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders } from '$lib/test/bronnen';

describe('errors that are not swallowed', () => {
	it('has one catch-all, at the outer boundary, and one boundary per panel of the Verkenner', () => {
		// hooks.client.ts reports what nobody handled; a panel that fails to draw says so in its
		// place (PanelBoundary), the other panels stay. Code-eenvoud F06.
		expect(overtreders((t) => /addEventListener\(\s*'unhandledrejection'/.test(t))).toEqual([
			'hooks.client.ts'
		]);
		expect(overtreders((t) => /<svelte:boundary\b/.test(t))).toEqual([
			'lib/components/ui/PanelBoundary.svelte'
		]);
		const panels = [
			...bron('routes/explore/+page.svelte').matchAll(/<PanelBoundary what="([^"]+)"/g)
		].map((m) => m[1]);
		expect(new Set(panels)).toEqual(new Set(['De tekst', 'Verbonden', 'Het netwerk']));
	});

	it('reads every answer of the API through unwrap, so a failure is an ApiError', () => {
		// `data ?? null` or `response.ok` made a 500 into "geen" (F05); a 404 that means "geen"
		// goes through ifExists ($lib/api/errors.ts).
		const raw = (text: string) =>
			(text.match(/\.GET\(/g) ?? []).length -
			(text.match(/\bunwrap\(\s*[\w.()]+\.GET\(/g) ?? []).length;
		expect(BRONNEN.filter(({ text }) => raw(text) > 0).map((s) => s.path)).toEqual([]);
	});
});
