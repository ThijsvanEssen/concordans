// The Leespaneel (B40): an article a reference names, read beside the text it stands in. A click
// opens it and puts it in the address (`?lees=`), Back closes it and the focus goes back to the
// reference; a shared link opens it and × takes only the parameter away. The page stays usable
// beside it; ⌘-click and Open artikel are the page.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const REGELING = '/wetten/BWBR0052884';
const GEDEELD = `${REGELING}?lees=articles/bwbr0052875_23.lid-1`;

const kop = (page: Page) => page.locator('.whole-count', { hasText: /^Op grond van/ }).first();
const paneel = (page: Page) => page.locator('#leespaneel');

test('a reference in the head opens the panel at its lid, and Back closes it', async ({
	page,
	touch
}) => {
	await page.goto(REGELING);
	const lid = kop(page).getByRole('link', { name: '23 lid 1', exact: true });
	// The link stays the page, for ⌘-click, a new tab and a crawler.
	await expect(lid).toHaveAttribute('href', /\/wetten\/BWBR0052875\/artikel\/23#lid-1$/);
	if (!touch) {
		await lid.hover();
		await expect(page.getByRole('tooltip')).toContainText('opent in het paneel');
	}
	await lid.click();
	await expect(page).toHaveURL(/\?lees=articles\/bwbr0052875_23\.lid-1$/);
	await expect(page).toHaveURL(new RegExp(`^[^?]*${REGELING}\\?`));
	const p = paneel(page);
	await expect(p).toHaveAttribute('role', touch ? 'dialog' : 'complementary');
	await expect(p).not.toHaveAttribute('aria-modal');
	await expect(p.getByRole('heading', { level: 2 })).toHaveText('Artikel 23 Cbb');
	await expect(p.getByRole('heading', { level: 2 })).toBeFocused();
	// The cited lid marked, in words too.
	const geciteerd = p.locator('[aria-current="location"]');
	await expect(geciteerd).toHaveCount(1);
	await expect(geciteerd).toContainText('1.');
	await expect(geciteerd).toBeInViewport();
	// The reference it came from stays marked; the page beside it is no dialog's.
	await expect(lid).toHaveAttribute('aria-expanded', 'true');
	await expect(lid).toHaveClass(/is-open/);
	await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);

	await page.goBack();
	await expect(p).toHaveCount(0);
	await expect(page).toHaveURL(new RegExp(`${REGELING}$`));
	if (!touch) await expect(lid).toBeFocused();
});

test('a shared link opens the panel; × takes only the parameter away', async ({ page }) => {
	await page.goto(GEDEELD);
	const p = paneel(page);
	await expect(p.getByRole('heading', { level: 2 })).toHaveText('Artikel 23 Cbb');
	await p.getByRole('button', { name: 'Sluiten' }).click();
	await expect(p).toHaveCount(0);
	await expect(page).toHaveURL(new RegExp(`${REGELING}$`));
	// No step back: the regulation is still the page.
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the article before and after replace it in place; Open artikel is the page', async ({
	page
}) => {
	await page.goto(GEDEELD);
	const p = paneel(page);
	await expect(p.getByRole('heading', { level: 2 })).toHaveText('Artikel 23 Cbb');
	const lengte = await page.evaluate(() => history.length);
	await p.getByRole('link', { name: /^Art\. 24 ›$/ }).click();
	await expect(p.getByRole('heading', { level: 2 })).toHaveText('Artikel 24 Cbb');
	await expect(page).toHaveURL(/\?lees=articles\/bwbr0052875_24$/);
	expect(await page.evaluate(() => history.length)).toBe(lengte);
	await p.getByRole('link', { name: 'Open artikel' }).click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0052875\/artikel\/24$/);
	await expect(p).toHaveCount(0);
});

test('Escape closes it, Alt W goes between the reader and the panel, Alt ] to the next', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a phone has no keyboard');
	await page.goto(REGELING);
	const lid = kop(page).getByRole('link', { name: '23 lid 1', exact: true });
	await lid.focus();
	await page.keyboard.press('Enter');
	const titel = paneel(page).getByRole('heading', { level: 2 });
	await expect(titel).toBeFocused();
	await page.keyboard.press('Alt+KeyW');
	await expect(lid).toBeFocused();
	await page.keyboard.press('Alt+KeyW');
	await expect(titel).toBeFocused();
	await page.keyboard.press('Alt+BracketRight');
	await expect(titel).toHaveText('Artikel 24 Cbb');
	await expect(titel).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(paneel(page)).toHaveCount(0);
	await expect(lid).toBeFocused();
});

test('on a phone it comes from below, its grip takes it higher', async ({ page, touch }) => {
	test.skip(!touch, 'the sheet of a phone');
	await page.goto(GEDEELD);
	const p = paneel(page);
	await expect(p.getByRole('heading', { level: 2 })).toHaveText('Artikel 23 Cbb');
	const laag = (await p.boundingBox())!.height;
	expect(laag).toBeLessThan(812 * 0.65);
	await p.getByRole('button', { name: 'Groter' }).click();
	await expect.poll(async () => (await p.boundingBox())!.height).toBeGreaterThan(laag + 100);
	await p.getByRole('button', { name: 'Kleiner' }).click();
	await expect.poll(async () => (await p.boundingBox())!.height).toBeLessThan(laag + 1);
	// A tap beside it, in the text above it, closes it.
	await page.getByRole('heading', { level: 1 }).tap();
	await expect(p).toHaveCount(0);
});

// The pictures for the review (LEESPANEEL_PNG=<directory>), at 1440 and 375.
test('pictures of the panel', async ({ page, touch }) => {
	const map = process.env.LEESPANEEL_PNG;
	test.skip(!map, 'only for the review');
	const breed = touch ? '375' : '1440';
	await page.goto(REGELING);
	await kop(page).getByRole('link', { name: '23 lid 1', exact: true }).click();
	await expect(paneel(page).locator('[aria-current="location"]')).toBeVisible();
	await page.screenshot({ path: `${map}/leespaneel-kopregel-${breed}.png` });
	await page.goto('/wetten/BWBR0052872/artikel/68?lees=articles/bwbr0052875_23.lid-1');
	await expect(paneel(page).locator('[aria-current="location"]')).toBeVisible();
	await page.screenshot({ path: `${map}/leespaneel-lezer-${breed}.png` });
});
