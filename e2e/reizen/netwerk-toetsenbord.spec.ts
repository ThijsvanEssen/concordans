// The Netwerk by keyboard and by finger (UX-toets W6, B233): the bron the keyboard is on carries a
// ring on the canvas and comes into view, also inside a bundle; the arrows with two bronnen show
// where they point; the card of a bron has its button Sluiten; Enter on a legend button is that
// button's own; a square names itself; and the legend is in reach on a phone.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../support/test';

const EEN = '/explore?mode=netwerk&netwerk=instruments/bwbr0006622';
const TWEE =
	'/wetten/BWBR0006622?mode=netwerk&netwerk=instruments/bwbr0006622,instruments/bwbr0005537';
const lijst = (page: Page) => page.locator('.canvas-node-list a');
const veld = (page: Page) => page.getByTestId('banen');
const ring = (page: Page) => page.locator('.is-pointed');
const kaart = (page: Page) => page.locator('.strook--kaart');
const canvas = (page: Page) => page.getByRole('application', { name: /^Netwerk\./ });

/** The element lies in the field that scrolls, whole or for the most part. */
async function inBeeld(page: Page, el: Locator) {
	const field = (await veld(page).boundingBox())!;
	const b = (await el.boundingBox())!;
	expect(b.y + b.height / 2).toBeGreaterThan(field.y);
	expect(b.y + b.height / 2).toBeLessThan(field.y + field.height);
	expect(b.x + b.width / 2).toBeGreaterThan(field.x);
	expect(b.x + b.width / 2).toBeLessThan(field.x + field.width);
}

test('the bron the list is on carries a ring on the canvas, in view, in a bundle too', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a phone has no keyboard');
	await page.goto(EEN);
	await expect(veld(page)).toBeVisible();
	await expect(lijst(page).nth(2)).toBeAttached();
	await lijst(page).first().focus();
	for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowDown');
	await expect(ring(page)).toHaveCount(1);
	await expect(ring(page).locator('.point, .hit').first()).toBeAttached();
	await inBeeld(page, ring(page));
	// The unit holding it is not dimmed with the rest.
	await expect(ring(page).locator('xpath=ancestor-or-self::*[@data-unit][1]')).not.toHaveClass(
		/is-dim/
	);
});

test('with two bronnen the arrows on the canvas show where they point', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a phone has no keyboard');
	await page.goto(TWEE);
	await expect(veld(page)).toBeVisible();
	await expect(lijst(page).nth(1)).toBeAttached();
	await canvas(page).focus();
	await page.keyboard.press('ArrowRight');
	await expect(canvas(page)).toHaveAttribute('data-aangewezen', /.+/);
	await expect(ring(page)).toHaveCount(1);
	const eerste = await canvas(page).getAttribute('data-aangewezen');
	await page.keyboard.press('ArrowRight');
	await expect(canvas(page)).not.toHaveAttribute('data-aangewezen', eerste!);
	await expect(ring(page)).toHaveCount(1);
	await inBeeld(page, ring(page));
	await page.keyboard.press('ArrowLeft');
	await expect(canvas(page)).toHaveAttribute('data-aangewezen', eerste!);
});

test('the card of a bron has a button Sluiten, on a phone too', async ({ page }) => {
	await page.goto(EEN);
	await expect(veld(page)).toBeVisible();
	await page.locator('[data-unit="ministries/ienw"]').click();
	await expect(kaart(page)).toHaveClass(/is-open/);
	const sluit = kaart(page).getByRole('button', { name: 'Sluiten' });
	await expect(sluit).toBeVisible();
	await sluit.click();
	await expect(kaart(page)).not.toHaveClass(/is-open/);
	await expect(page.locator('[data-unit="ministries/ienw"]')).toHaveAttribute(
		'aria-pressed',
		'false'
	);
});

test('Enter on a legend button switches that lijnsoort, not the canvas selection', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a phone has no keyboard');
	await page.goto(EEN);
	await expect(veld(page)).toBeVisible();
	const knop = page.getByRole('list', { name: 'Lijnsoorten' }).getByRole('button').first();
	const was = await knop.getAttribute('aria-pressed');
	await knop.focus();
	await page.keyboard.press('Enter');
	await expect(knop).toHaveAttribute('aria-pressed', was === 'true' ? 'false' : 'true');
	expect(page.url()).not.toContain('kies=');
});

test('a square names itself under the pointer and on the keyboard', async ({ page, isMobile }) => {
	test.skip(isMobile, 'a phone draws rows, not squares');
	await page.goto(EEN);
	await expect(veld(page)).toBeVisible();
	const vak = veld(page).locator('.member').first();
	await expect(vak).toHaveAttribute('aria-label', /^Artikel /);
	await vak.hover();
	await expect(veld(page).locator('.tip')).toHaveText(/^Artikel /);
	await page.mouse.move(0, 0);
	await expect(veld(page).locator('.tip')).toHaveCount(0);
});

test('on a phone the legend is one bar in view that opens', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await page.goto(EEN);
	await expect(veld(page)).toBeVisible();
	const knop = page.getByRole('button', { name: 'Legenda' });
	await expect(knop).toBeInViewport();
	await expect(page.getByRole('list', { name: 'Lijnsoorten' })).toBeHidden();
	await knop.click();
	await expect(page.getByRole('list', { name: 'Lijnsoorten' })).toBeVisible();
	await expect(knop).toHaveAttribute('aria-expanded', 'true');
});
