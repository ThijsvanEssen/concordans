// Layer 1: every kind of page once. The pages come from the app's own lists, so a new page
// is checked without a line here: the pages of the app (src/lib/seo/spa-routes.json) and one
// readable address per kind of bron (src/lib/bron/readable-paths.json, the contract with the
// API). Each loads without a console error, has its h1 and title, paints within FIRST_PAINT,
// fits 375 without scrolling sideways, and keeps the house rules a script can check.
import routes from '../src/lib/seo/spa-routes.json' with { type: 'json' };
import readable from '../src/lib/bron/readable-paths.json' with { type: 'json' };
import { expect, test } from './support/test';
import { middots, overflowX, smallTargets, strayRed, withoutSize } from './support/rules';
import { KNOWN_CONSOLE_ERRORS, KNOWN_SMALL_TARGETS } from './known';
import { appendFileSync } from 'node:fs';

/** The first paint (first-contentful-paint) after the navigation, with the API answered at once. */
const FIRST_PAINT = 3_000;

/** A page with a parameter, as a reader reaches it. */
const PARAMS: Record<string, string> = { '/bundels/[id]': '/bundels/lm000001' };

/**
 * One address per kind of bron: the first of each shape. The third segment names the kind
 * (`wetten/…/artikel/…`, `wetten/…/bijlage/…`) unless it is a number (`/stb/2026/94`, a stuk
 * of the Tweede Kamer) or letters (a stuk of the Eerste Kamer, `/kamerstukken/36600-VIII/AB`).
 */
function oneOfEachKind(paths: string[]) {
	const kinds = new Map<string, string>();
	for (const path of paths) {
		const [first, , third] = path.split('/').slice(1);
		const shape =
			third === undefined
				? ''
				: /^\d+$/.test(third)
					? '#'
					: /^[A-Z]{1,3}$/.test(third)
						? 'A'
						: third;
		if (!kinds.has(`${first}/${shape}`)) kinds.set(`${first}/${shape}`, path);
	}
	return [...kinds.values()];
}

const pages = [
	...routes.map((r) => PARAMS[r.path] ?? r.path),
	'/explore?mode=index',
	...oneOfEachKind(readable.paths.map((p) => p.path))
];

for (const path of pages) {
	test(`${path} loads and keeps the house rules`, async ({ page, touch, guard }) => {
		for (const known of KNOWN_CONSOLE_ERRORS[path] ?? []) guard.allow(known);
		await page.goto(path);
		await expect(page.locator('h1').first()).toBeVisible();
		const paint = await page.evaluate(
			() =>
				new Promise<number>((done) => {
					new PerformanceObserver((list) => {
						const fcp = list.getEntriesByName('first-contentful-paint')[0];
						if (fcp) done(fcp.startTime);
					}).observe({ type: 'paint', buffered: true });
					setTimeout(() => done(Infinity), 2_000);
				})
		);
		if (!process.env.E2E_RECORD) expect(paint, 'first paint (ms)').toBeLessThan(FIRST_PAINT);
		await page.waitForLoadState('networkidle');
		await expect(
			page.getByRole('heading', { name: /Pagina niet gevonden|Er ging iets mis/ })
		).toHaveCount(0);
		await expect(page).toHaveTitle(/\S/);

		expect(await middots(page), 'a "·" as separator').toEqual([]);
		expect(await strayRed(page), 'red that says neither no nor an error').toEqual([]);
		if (touch) {
			expect(await overflowX(page), 'scrolls sideways at 375').toBeLessThanOrEqual(0);
			const small = await smallTargets(page);
			const known = KNOWN_SMALL_TARGETS[path] ?? [];
			if (process.env.E2E_WRITE_KNOWN)
				appendFileSync(
					'test-results/known-small-targets.ndjson',
					JSON.stringify([path, small.map(withoutSize)]) + '\n'
				);
			expect(
				small.filter((s) => !known.includes(withoutSize(s))),
				'tap targets under 44 px'
			).toEqual([]);
			expect(
				known.filter((k) => !small.some((s) => withoutSize(s) === k)),
				'fixed: take these out of e2e/known.ts'
			).toEqual([]);
		}
	});
}
