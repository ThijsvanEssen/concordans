// The Netwerk's logic (the composer, the keten, Verband) is a chunk of its own (B178): a reader
// on a sparing line never asks for it, and a netwerk opened at its address asks for it once and
// draws as before.
import { chunkOf } from '../support/chunks';
import { expect, test } from '../support/test';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162';
const LOGIC = 'src/routes/explore/netwerk-logic.ts';

test('a reader on a sparing line never loads the Netwerk logic', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'connection', { value: { effectiveType: '3g' } });
	});
	const asked: string[] = [];
	page.on('request', (r) => asked.push(new URL(r.url()).pathname));
	await page.goto(ARTICLE);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
	await page.waitForLoadState('networkidle');
	expect(asked).not.toContain(chunkOf(LOGIC));
});

test('a netwerk opened at its address loads the logic once and draws', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	let loads = 0;
	const path = chunkOf(LOGIC);
	page.on('request', (r) => {
		if (new URL(r.url()).pathname === path) loads++;
	});
	await page.goto(`${ARTICLE}?mode=netwerk`);
	await expect(page.locator('.canvas-node-list a').first()).toBeAttached();
	await page.waitForLoadState('networkidle');
	expect(loads).toBe(1);
	expect(errors).toEqual([]);
});

test('a composed netwerk (the composer of the chunk) draws its bronnen', async ({ page }) => {
	let loads = 0;
	const path = chunkOf(LOGIC);
	page.on('request', (r) => {
		if (new URL(r.url()).pathname === path) loads++;
	});
	await page.goto('/explore?mode=netwerk&netwerk=instruments/bwbr0006622');
	await expect(page.locator('.canvas-node-list a').first()).toBeAttached();
	await page.waitForLoadState('networkidle');
	expect(loads).toBe(1);
});
