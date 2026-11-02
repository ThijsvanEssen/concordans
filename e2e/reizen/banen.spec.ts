// Omgeving as lanes (?doek=banen): the tiles of a law's dossiers and their Zijpaneel, the heads and
// markers of changed wetten, the legend that switches a lijnsoort, Lezer and back, and the button
// Netwerk that draws what a link with netwerk= draws (B84).
import type { Locator, Page } from '@playwright/test';
import { failApi } from '../support/api';
import { netwerkKnop } from '../support/navigation';
import { openSheet } from '../support/sheet';
import { expect, test } from '../support/test';

const WVW = '/wetten/BWBR0006622?doek=banen';
const WVW_NETWERK = `${WVW}&mode=netwerk`;
const WVW_LINK = '/explore?mode=netwerk&netwerk=instruments/bwbr0006622&doek=banen';
const TILE_36164 = '[data-tile="dossiers/36164"]';

const tiles = (page: Page) => page.locator('[data-tile]');
const numbers = (page: Page) => page.locator('[data-tile] .number').allTextContents();
const zijpaneel = (page: Page) => page.getByRole('complementary', { name: 'Zijpaneel' });
const lawHeads = (page: Page) => page.locator('.law-head');

async function box(locator: Locator) {
	const b = await locator.boundingBox();
	expect(b).not.toBeNull();
	return b!;
}

test('a law draws its dossiers as tiles; one opens in the Zijpaneel and closes again', async ({
	page
}) => {
	await page.goto(WVW_NETWERK);
	await expect(page.getByTestId('banen')).toBeVisible();
	await expect(tiles(page)).toHaveCount(20);
	await page.locator(TILE_36164).click();
	await expect(page.locator(TILE_36164)).toHaveAttribute('aria-pressed', 'true');
	await expect(zijpaneel(page).getByRole('heading', { name: 'Dossier 36164' })).toBeVisible();
	await expect(zijpaneel(page).getByRole('link', { name: 'Dossier openen' })).toBeVisible();
	await zijpaneel(page).getByRole('button', { name: 'Sluiten' }).click();
	await expect(zijpaneel(page)).toHaveCount(0);
	await expect(page.locator(TILE_36164)).toHaveAttribute('aria-pressed', 'false');
});

test('Escape closes the Zijpaneel', async ({ page, isMobile }) => {
	test.skip(isMobile, 'a phone has no Escape');
	await page.goto(WVW_NETWERK);
	await page.locator(TILE_36164).click();
	await expect(zijpaneel(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(zijpaneel(page)).toHaveCount(0);
});

for (const width of [1100, 1280, 1440])
	test(`at ${width} the Zijpaneel leaves the tile and the wet of its line in view`, async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'on a phone the Zijpaneel is a sheet');
		await page.setViewportSize({ width, height: 900 });
		await page.goto(WVW_NETWERK);
		await page.locator(TILE_36164).click();
		const card = await box(zijpaneel(page));
		const field = await box(page.getByTestId('banen'));
		const wet = page.locator('[data-unit="instruments/bwbr0006622"]').first();
		await expect(async () => {
			const law = await box(wet);
			const tile = await box(page.locator(TILE_36164));
			expect(law.x + law.width).toBeLessThanOrEqual(card.x);
			expect(tile.x).toBeGreaterThanOrEqual(field.x);
		}).toPass();
		await page.keyboard.press('Escape');
		await expect(zijpaneel(page)).toHaveCount(0);
	});

test('on a phone the Zijpaneel is a sheet at the foot, under the lanes', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'a phone only');
	await page.goto(WVW_NETWERK);
	const before = await box(page.getByTestId('banen').locator('svg.drawing'));
	await page.locator(TILE_36164).click();
	const sheet = await box(zijpaneel(page));
	expect(sheet.x).toBe(0);
	expect(sheet.width).toBe(375);
	expect((await box(page.getByTestId('banen').locator('svg.drawing'))).width).toBe(before.width);
	// What is chosen scrolls out from under the sheet.
	await expect(async () => {
		const tile = await box(page.locator(TILE_36164));
		expect(tile.y + tile.height).toBeLessThanOrEqual(sheet.y);
		expect(tile.y).toBeGreaterThanOrEqual((await box(page.getByTestId('banen'))).y);
	}).toPass();
});

test('changed wetten stand under their heads, with a marker the legend explains', async ({
	page,
	isMobile
}) => {
	await page.goto('/dossiers/36702?doek=banen&mode=netwerk&diepte=2');
	await expect(page.getByTestId('banen')).toBeVisible();
	await expect(page.locator('.changed-mark').first()).toBeAttached();
	const legend = page.getByRole('list', { name: 'Lijnsoorten' });
	await expect(legend.getByText('Voorgesteld', { exact: true })).toBeVisible();
	if (isMobile) {
		await expect(lawHeads(page)).toHaveCount(0);
		// Every bron has its name, on a row of its own (Thijs, variant A).
		await expect(page.locator('[data-unit] .row-name', { hasText: 'Jeugdwet' })).toBeVisible();
	} else await expect(lawHeads(page).first()).toHaveText('Voorgesteld');
});

test('the legend switches a lijnsoort off and on, and the address keeps it', async ({
	page,
	isMobile
}) => {
	await page.goto('/dossiers/36702?doek=banen&mode=netwerk&diepte=2');
	const legend = page.getByRole('list', { name: 'Lijnsoorten' });
	const change = legend.getByRole('button', { name: 'Voorgestelde wijziging' });
	await expect(change).toHaveAttribute('aria-pressed', 'true');
	await change.click();
	await expect(page).toHaveURL(/[?&]uit=/);
	await expect(legend.getByRole('button', { name: 'Wijziging' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(legend.getByText('Zonder Wijziging geen kopjes en markers')).toBeVisible();
	await expect(page.locator('.changed-mark')).toHaveCount(0);
	await expect(lawHeads(page)).toHaveCount(0);
	await legend.getByRole('button', { name: 'Wijziging' }).click();
	await expect(change).toHaveAttribute('aria-pressed', 'true');
	await expect(page).not.toHaveURL(/[?&]uit=/);
	await expect(page.locator('.changed-mark').first()).toBeAttached();
	if (!isMobile) await expect(lawHeads(page).first()).toBeVisible();
});

test('a bron alone has the whole of a soort as its list, in the row of its count', async ({
	page
}) => {
	await page.goto(WVW_NETWERK);
	await expect(tiles(page)).toHaveCount(20);
	await openSheet(page);
	const alle = page.getByRole('link', { name: /^Alle [\d.]+ stukken$/ });
	await expect(alle).toBeVisible();
	await alle.click();
	await expect(page).toHaveURL(/[?&]tabel=1/);
	await expect(page).toHaveURL(/[?&]soort=/);
	await page.goBack();
	await expect(tiles(page)).toHaveCount(20);
});

test('a second step that fails says so, the first stays, Opnieuw asks it again', async ({
	page,
	guard
}) => {
	guard.allow(/status of 503/);
	await failApi(page, /^\/api\/nodes\/articles\/bwbr0005289_162\/neighborhood/, 503);
	await page.goto('/wetten/BWBR0005289/artikel/6:162?doek=banen&mode=netwerk');
	const alert = page
		.getByRole('alert')
		.filter({ hasText: 'Het netwerk kon niet op tijd worden geladen.' });
	await expect(alert).toBeVisible();
	await expect(page.getByTestId('banen')).toBeVisible();

	await page.unrouteAll({ behavior: 'ignoreErrors' });
	await alert.getByRole('button', { name: 'Opnieuw' }).click();
	await expect(alert).toHaveCount(0);
	await expect(page.getByTestId('banen')).toBeVisible();
});

test('Lezer and Netwerk go there and back, the lanes as they were', async ({ page, isMobile }) => {
	test.skip(isMobile, 'the tabs of a phone: navigatie.spec');
	await page.goto(WVW_NETWERK);
	await expect(tiles(page)).toHaveCount(20);
	const lezer = page.getByRole('banner').getByRole('button', { name: /^Lezer/ });
	await expect(lezer).toContainText('Lezer: WVW');
	await lezer.click();
	await expect(page).not.toHaveURL(/mode=netwerk/);
	await expect(page.getByTestId('banen')).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Wegenverkeerswet');
	await netwerkKnop(page).click();
	await expect(page).toHaveURL(/mode=netwerk/);
	await expect(page).toHaveURL(/doek=banen/);
	await expect(tiles(page)).toHaveCount(20);
});

test('the button Netwerk draws what a link with netwerk= draws (B84)', async ({ page }) => {
	await page.goto(WVW_LINK);
	await expect(tiles(page)).toHaveCount(20);
	const linked = await numbers(page);
	await page.goto(WVW);
	await netwerkKnop(page).click();
	await expect(tiles(page)).toHaveCount(20);
	expect(await numbers(page)).toEqual(linked);
});

// For the switch (PLAN-doek-banen, fase 6): Omgeving draws lanes without ?doek=banen.
test.fixme('Omgeving draws lanes without ?doek=banen', async ({ page }) => {
	await page.goto('/wetten/BWBR0006622?mode=netwerk');
	await expect(page.getByTestId('banen')).toBeVisible();
	await expect(tiles(page)).toHaveCount(20);
	await expect(page.locator('.graph-canvas canvas')).toHaveCount(0);
});
