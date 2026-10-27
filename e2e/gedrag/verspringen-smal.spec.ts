// A reader stands from the first paint (UX-toets T9, R3-L F1–F3): the text, the contents and
// Verbonden do not move while the bron, its band, its list and Verbonden come in, at 1440, at
// 1024 and on a phone. The API answers a moment after the light node, as live: what comes
// late must not push what stands.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const PAGES = [
	{ what: 'a dossier', path: '/dossiers/36764' },
	{ what: 'a long dossier', path: '/dossiers/36600' },
	{ what: 'a law', path: '/wetten/BWBR0052872' },
	{ what: 'a law of one article', path: '/wetten/BWBR0004353' },
	{ what: 'an article', path: '/wetten/BWBR0005289/artikel/6:162' },
	{ what: 'a publication', path: '/stb/2026/94' },
	{ what: 'a motie', path: '/kamerstukken/36799/31' },
	{ what: 'a stuk of the Eerste Kamer', path: '/kamerstukken/36496/D' },
	{ what: 'an activiteit', path: '/activiteiten/2026A01323' },
	{ what: 'a kabinet', path: '/kabinetten/rutte_iv' }
];

/** The layout shift of the whole load, from the first paint. */
const watchShifts = () => {
	const w = window as unknown as { __cls: number };
	w.__cls = 0;
	new PerformanceObserver((list) => {
		for (const e of list.getEntries() as (PerformanceEntry & {
			value: number;
			hadRecentInput: boolean;
		})[])
			if (!e.hadRecentInput) w.__cls += e.value;
	}).observe({ type: 'layout-shift', buffered: true });
};

async function load(page: Page, path: string, phone = false) {
	// Everything but the light node a moment later, as on a live line.
	await page.route(/\/api\/(?!nodes\/)/, async (route) => {
		await new Promise((done) => setTimeout(done, 250));
		await route.fallback();
	});
	await page.addInitScript(watchShifts);
	await page.goto(path);
	await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
	// On a phone Verbonden is a tab of its own (A197-a), drawn when it is chosen.
	if (phone)
		await expect(
			page
				.getByRole('group', { name: 'Tekst of Verbonden' })
				.getByRole('button', { name: 'Verbonden' })
		).toBeVisible();
	else await expect(page.getByRole('heading', { level: 2, name: 'Verbonden' })).toBeAttached();
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(1000);
	const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
	expect(cls, 'layout shift of the load').toBeLessThanOrEqual(0.05);
}

for (const width of [1440, 1024])
	for (const p of PAGES)
		test(`${p.what} comes in at ${width} without a shift`, async ({ page, touch }) => {
			test.skip(touch, 'a wide screen and a tablet');
			await page.setViewportSize({ width, height: 900 });
			await load(page, p.path);
		});

for (const p of PAGES)
	test(`${p.what} comes in on a phone without a shift`, async ({ page, touch }) => {
		test.skip(!touch, 'a phone');
		await load(page, p.path, true);
	});
