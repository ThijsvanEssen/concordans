// The canvas by keyboard (UX review N11, R9, WCAG 3.2.1): the focus changes nothing, Enter
// chooses. A Tab onto a bron of the list lights it up and opens no card; Enter chooses it as
// a click does (its card, `kies=` in the address). On the canvas itself ← and → point at a
// bron, the one line reads it, Enter chooses it and Escape lets it go.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const NETWERK = '/wetten/BWBR0005289/artikel/6:162?mode=netwerk';
const lijst = (page: Page) => page.locator('.canvas-node-list a');
const regel = (page: Page) => page.locator('.canvas-node-list + p[aria-live="polite"]');
const kaart = (page: Page) => page.locator('.strook--kaart');
const canvas = (page: Page) => page.getByRole('application', { name: /^Netwerk\./ });

test('a Tab onto a bron opens nothing; Enter chooses it', async ({ page }) => {
	await page.goto(NETWERK);
	const eerste = lijst(page).first();
	await expect(eerste).toBeAttached();
	// A Tab arrives at the list: in from the element before it.
	await eerste.focus();
	await page.keyboard.press('Shift+Tab');
	await expect(eerste).not.toBeFocused();
	await page.keyboard.press('Tab');
	await expect(eerste).toBeFocused();
	await expect(kaart(page)).not.toHaveClass(/is-open/);
	expect(page.url()).not.toContain('kies=');

	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/[?&]kies=/);
	await expect(kaart(page)).toHaveClass(/is-open/);
	await expect(eerste).toBeFocused();
});

test('on the canvas the arrows point at a bron, Enter chooses it, Escape lets go', async ({
	page
}) => {
	await page.goto(NETWERK);
	await expect(lijst(page).nth(1)).toBeAttached();
	const [eerste, tweede] = await lijst(page).allTextContents();
	await canvas(page).focus();

	await page.keyboard.press('ArrowRight');
	await expect(regel(page)).toHaveText(eerste);
	await expect(lijst(page).first()).toHaveAttribute('aria-current', 'true');
	await expect(canvas(page)).toHaveAttribute('data-aangewezen', /.+/);
	await page.keyboard.press('ArrowRight');
	await expect(regel(page)).toHaveText(tweede);
	await expect(lijst(page).nth(1)).toHaveAttribute('aria-current', 'true');
	await expect(lijst(page).first()).not.toHaveAttribute('aria-current');
	// Pointing chooses nothing.
	await expect(kaart(page)).not.toHaveClass(/is-open/);
	expect(page.url()).not.toContain('kies=');

	await page.keyboard.press('Escape');
	await expect(canvas(page)).not.toHaveAttribute('data-aangewezen');
	await expect(lijst(page).locator('[aria-current]')).toHaveCount(0);
	expect(page.url()).not.toContain('kies=');

	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/[?&]kies=/);
	await expect(kaart(page)).toHaveClass(/is-open/);
});

test('Enter on a group opens its card, as a click does', async ({ page, touch }) => {
	test.skip(touch, 'the keyboard list is the way without a pointer');
	await page.goto('/uitspraken/ECLI:NL:HR:2009:BH2815?mode=netwerk');
	const groep = lijst(page).filter({ hasText: /^\d+ uitspraken, groep$/ });
	await expect(groep).toHaveCount(1);
	await groep.focus();
	await expect(kaart(page)).not.toHaveClass(/is-open/);
	await page.keyboard.press('Enter');
	await expect(page.getByRole('dialog', { name: /uitspraken$/ })).toBeVisible();
});
