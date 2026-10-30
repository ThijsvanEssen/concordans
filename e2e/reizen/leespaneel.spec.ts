// The Zijpaneel (B40): an article a reference names, read beside the text it stands in. A click
// opens it and puts it in the address (`?lees=`), Back closes it and the focus goes back to the
// reference; a shared link opens it and × takes only the parameter away. The page stays usable
// beside it; ⌘-click and Open artikel are the page. A law's articles in the head stand in it
// under each other (the stapel), a row of Verbonden opens it in one click.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const REGELING = '/wetten/BWBR0052884';
const GEDEELD = `${REGELING}?lees=articles/bwbr0052875_23.lid-1`;

const STAPEL =
	/\?lees=articles\/bwbr0052875_19,articles\/bwbr0052875_23\.lid-1,articles\/bwbr0052875_28$/;

const kop = (page: Page) => page.locator('.whole-count', { hasText: /^Op grond van/ }).first();
const paneel = (page: Page) => page.locator('#leespaneel');

test("a reference in the head opens its law's articles under each other, at its lid; Back closes it", async ({
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
	await expect(page).toHaveURL(STAPEL);
	await expect(page).toHaveURL(new RegExp(`^[^?]*${REGELING}\\?`));
	const p = paneel(page);
	await expect(p).toHaveAttribute('role', touch ? 'dialog' : 'complementary');
	await expect(p).not.toHaveAttribute('aria-modal');
	await expect(p.getByRole('heading', { level: 2 })).toHaveText('Art. 19, 23 lid 1 en 28 Cbb');
	// It opens at the one clicked: its head holds the focus, its chip is filled.
	const stuk = p.getByRole('heading', { level: 3, name: 'Artikel 23 Cbb' });
	await expect(stuk).toBeFocused();
	const sprong = p.getByRole('navigation', { name: 'Ga naar artikel' });
	await expect(sprong.getByRole('link')).toHaveText(['19', '23 lid 1', '28']);
	await expect(sprong.locator('[aria-current="true"]')).toHaveText('23 lid 1');
	// Its cited lid only, marked, in words too; the whole article one click away.
	const geciteerd = p.locator('[aria-current="location"]');
	await expect(geciteerd).toHaveCount(1);
	await expect(geciteerd).toContainText('1.');
	await expect(geciteerd).toBeInViewport();
	await expect(p.getByRole('button', { name: 'Heel artikel' })).toHaveCount(1);
	// Every reference of the head it holds stays marked; the page beside it is no dialog's.
	for (const naam of ['19', '23 lid 1', '28'])
		await expect(kop(page).getByRole('link', { name: naam, exact: true })).toHaveClass(/is-open/);
	await expect(lid).toHaveAttribute('aria-expanded', 'true');
	await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
	// A chip takes its article to the top.
	await sprong.getByRole('link', { name: '28' }).click();
	await expect(p.getByRole('heading', { level: 3, name: 'Artikel 28 Cbb' })).toBeFocused();
	await expect(sprong.locator('[aria-current="true"]')).toHaveText('28');

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
	// The way on stands outside what scrolls: in view at the cited lid, on a phone too (C1).
	const buren = p.getByRole('navigation', { name: 'Vorig en volgend artikel' });
	await expect(buren).toBeInViewport();
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
	const p = paneel(page);
	const titel = p.getByRole('heading', { level: 2 });
	await expect(p.getByRole('heading', { level: 3, name: 'Artikel 23 Cbb' })).toBeFocused();
	await page.keyboard.press('Alt+KeyW');
	await expect(lid).toBeFocused();
	await page.keyboard.press('Alt+KeyW');
	await expect(titel).toBeFocused();
	// In the stapel Alt ] is the next article of it.
	await page.keyboard.press('Alt+BracketRight');
	await expect(p.getByRole('heading', { level: 3, name: 'Artikel 28 Cbb' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(p).toHaveCount(0);
	await expect(lid).toBeFocused();
});

test('of one article Alt ] is its next; Alt W goes back to a link with a ring, not to the page', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a phone has no keyboard');
	await page.goto(GEDEELD);
	const titel = paneel(page).getByRole('heading', { level: 2 });
	await expect(titel).toHaveText('Artikel 23 Cbb');
	await page.keyboard.press('Alt+BracketRight');
	await expect(titel).toHaveText('Artikel 24 Cbb');
	await expect(titel).toBeFocused();
	// Opened from a link, with no place in the reader yet: a link of the reader (C3), not MAIN.
	await page.keyboard.press('Alt+KeyW');
	await expect(page.locator('#main-content')).not.toBeFocused();
	await expect(page.locator('#main-content :focus')).toHaveCount(1);
});

test('Alt L changes the view of the page beside the panel; the panel stays (C3)', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a phone has no keyboard');
	await page.goto(GEDEELD);
	await expect(paneel(page).getByRole('heading', { level: 2 })).toHaveText('Artikel 23 Cbb');
	await page.locator('h1').first().click();
	await page.keyboard.press('Alt+KeyL');
	await expect(page).toHaveURL(/mode=netwerk/);
	await expect(page).toHaveURL(/lees=articles\/bwbr0052875_23\.lid-1/);
	await expect(paneel(page).getByRole('heading', { level: 2 })).toHaveText('Artikel 23 Cbb');
});

test('a row of an article in Verbonden opens it in the panel in one click; ‹ Verbonden goes back', async ({
	page,
	touch
}) => {
	test.skip(touch, 'Verbonden is a tab of its own on a phone');
	await page.goto(REGELING);
	const verbonden = page.getByRole('complementary', { name: 'Verbonden' });
	const rij = verbonden.getByRole('link', { name: 'Artikel 4', exact: true });
	// The link stays the page.
	await expect(rij).toHaveAttribute('href', '/wetten/BWBR0052884/artikel/4');
	await rij.click();
	await expect(page).toHaveURL(/\?lees=articles\/bwbr0052884_4$/);
	const p = paneel(page);
	await expect(p.getByRole('heading', { level: 2 })).toHaveText(/^Artikel 4\b/);
	await expect(rij).toHaveAttribute('aria-expanded', 'true');
	await p.getByRole('button', { name: '‹ Verbonden' }).click();
	await expect(p).toHaveCount(0);
	await expect(page).toHaveURL(new RegExp(`${REGELING}$`));
});

test('from 1800 px it stands beside the page, in its flow: nothing under it', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a wide screen');
	await page.setViewportSize({ width: 2560, height: 1440 });
	await page.goto(GEDEELD);
	const p = paneel(page);
	await expect(p.getByRole('heading', { level: 2 })).toHaveText('Artikel 23 Cbb');
	const vak = (await p.boundingBox())!;
	expect(vak.width).toBe(560);
	const inhoud = await page
		.locator('#main-content')
		.evaluate(
			(m) => m.getBoundingClientRect().right - parseFloat(getComputedStyle(m).paddingRight)
		);
	expect(inhoud).toBeLessThanOrEqual(vak.x + 1);
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
	await page.screenshot({ path: `${map}/leespaneel-stapel-${breed}.png` });
	// The keten is a list on a phone: its labels are drawn wider only.
	if (!touch) {
		await page.goto('/wetten/BWBR0052872?mode=netwerk&weergave=keten');
		await page.locator('.chain a.cite', { hasText: 'art. 19, 23 lid 1, 28 Cbb' }).first().click();
		await expect(paneel(page).getByRole('heading', { level: 3 }).first()).toBeVisible();
		await page.screenshot({ path: `${map}/leespaneel-keten-${breed}.png` });
	}
	await page.goto('/wetten/BWBR0052872/artikel/68?lees=articles/bwbr0052875_23.lid-1');
	await expect(paneel(page).locator('[aria-current="location"]')).toBeVisible();
	await page.screenshot({ path: `${map}/leespaneel-lezer-${breed}.png` });
	if (touch) return;
	await page.goto(REGELING);
	await page
		.getByRole('complementary', { name: 'Verbonden' })
		.getByRole('link', { name: 'Artikel 4', exact: true })
		.click();
	await expect(paneel(page).getByRole('button', { name: '‹ Verbonden' })).toBeVisible();
	await page.screenshot({ path: `${map}/leespaneel-verbonden-1440.png` });
	await page.setViewportSize({ width: 2560, height: 1440 });
	await page.goto('/wetten/BWBR0052872/artikel/68?lees=articles/bwbr0052875_23.lid-1');
	await expect(paneel(page).locator('[aria-current="location"]')).toBeVisible();
	await page.screenshot({ path: `${map}/leespaneel-lezer-2560.png` });
});
