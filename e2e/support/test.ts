// The `test` of every spec: a browser context whose API answers from the fixtures
// (./api.ts), a clock that starts on the day the fixtures were recorded, and a guard that
// fails the test on a console error, an uncaught exception, a request without its fixture or
// a request to any other host. A test that provokes errors on purpose names them with
// `guard.allow(/…/)`.
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { API_ORIGIN, serveApi } from './api';

/** The day the fixtures were recorded: requests that carry a date ask for this one. */
export const TODAY = new Date('2026-10-20T10:00:00+02:00');

/** How long the pages ask nothing before a recording ends. */
const QUIET = 3_000;

/** Waits until the pages of `context` have asked nothing for QUIET ms (at most 30 s). */
async function quiet(context: BrowserContext, asked: { count: number }) {
	const end = Date.now() + 30_000;
	let seen = -1;
	while (seen !== asked.count && Date.now() < end && context.pages().length) {
		seen = asked.count;
		await new Promise((done) => setTimeout(done, QUIET));
	}
}

type Guard = {
	/** Console errors matching this are expected in this test. */
	allow(pattern: RegExp): void;
};

export const test = base.extend<{ guard: Guard; touch: boolean }>({
	context: async ({ context, baseURL }, use) => {
		// The day of the fixtures, time running from there. Only Date: Playwright's clock would
		// also replace performance, and with it the paint timings the smoke test reads.
		await context.addInitScript((today) => {
			const Real = Date;
			const offset = today - Real.now();
			class Day extends Real {
				constructor(...args: ConstructorParameters<DateConstructor> | []) {
					if (args.length) super(...(args as [number]));
					else super(Real.now() + offset);
				}
				static now() {
					return Real.now() + offset;
				}
			}
			globalThis.Date = Day as DateConstructor;
		}, TODAY.getTime());
		const origin = new URL(baseURL!).origin;
		const outside: string[] = [];
		const missing: string[] = [];
		// Anything else than the app and its API: the suite runs without a network.
		await context.route(
			(url) =>
				url.origin !== origin && !url.protocol.startsWith('data') && url.origin !== API_ORIGIN,
			(route) => {
				outside.push(route.request().url());
				return route.abort('blockedbyclient');
			}
		);
		await serveApi(context, missing);
		const asked = { count: 0 };
		context.on('request', () => asked.count++);
		await use(context);
		// While recording, what a page still asks after the last step is written down too, up
		// to what loads lazily (an idle callback, a timer): a replay answers at once and gets
		// further before the test ends.
		if (process.env.E2E_RECORD === '1') await quiet(context, asked);
		expect(missing, 'API requests without a fixture: run npm run e2e:record').toEqual([]);
		expect(outside, 'requests to other hosts').toEqual([]);
	},

	touch: async ({ isMobile }, use) => use(isMobile),

	guard: [
		async ({ context }, use) => {
			const allowed: RegExp[] = [];
			const errors: string[] = [];
			const watch = (page: Page) => {
				page.on('console', (m) => {
					if (m.type() === 'error') errors.push(m.text());
				});
				page.on('pageerror', (e) => errors.push(`uncaught: ${e.message}`));
			};
			context.pages().forEach(watch);
			context.on('page', watch);
			await use({ allow: (p) => allowed.push(p) });
			const unexpected = errors.filter((e) => !allowed.some((p) => p.test(e)));
			expect(unexpected, 'console errors').toEqual([]);
		},
		{ auto: true }
	]
});

export { expect };
