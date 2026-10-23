// A finger's target on a phone (besluit 30, T5 E2): every button and menu button is 44 px high
// to the touch, whatever it looks like; what is drawn may be smaller, the target is not. It is
// measured as a finger meets it: the pixels above and below the button's middle that still
// land on the button.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { ARTICLE, JUDGMENT } from '../support/bundels';

/** The height in which a tap on the button's own middle line lands on it, vertically. */
async function raakhoogte(button: Locator): Promise<number> {
	return button.evaluate((el) => {
		const r = el.getBoundingClientRect();
		const x = r.left + r.width / 2;
		const mid = r.top + r.height / 2;
		const raakt = (y: number) => {
			const top = document.elementFromPoint(x, y);
			return !!top && el.contains(top);
		};
		let omhoog = 0;
		while (omhoog < 40 && raakt(mid - r.height / 2 - omhoog - 1 + 0.5)) omhoog++;
		let omlaag = 0;
		while (omlaag < 40 && raakt(mid + r.height / 2 + omlaag + 0.5)) omlaag++;
		return r.height + omhoog + omlaag;
	});
}

async function knoppen(page: Page): Promise<Record<string, number>> {
	const gemeten: Record<string, number> = {};
	for (const knop of await page
		.locator(
			'button:visible, a.btn:visible, [role=tab]:visible, summary:visible, select:visible, input[type=search]:visible'
		)
		.all()) {
		const naam = (
			(await knop.getAttribute('aria-label')) ??
			(await knop.textContent()) ??
			''
		).trim();
		// Out of sight is out of reach of elementFromPoint: in the middle of the screen, clear of
		// the bar above.
		await knop.evaluate((el) => el.scrollIntoView({ block: 'center' }));
		if (!(await knop.boundingBox())) continue;
		gemeten[naam || (await knop.getAttribute('class')) || '?'] = await raakhoogte(knop);
	}
	return gemeten;
}

/** The links `welke` selects, each by its text, with the height a finger finds on it. */
async function links(page: Page, welke: string): Promise<Record<string, number>> {
	const gemeten: Record<string, number> = {};
	for (const link of await page.locator(`${welke}:visible`).all()) {
		await link.evaluate((el) => el.scrollIntoView({ block: 'center' }));
		if (!(await link.boundingBox())) continue;
		const naam = ((await link.textContent()) ?? '').trim().slice(0, 40);
		gemeten[naam || (await link.getAttribute('href')) || '?'] = await raakhoogte(link);
	}
	return gemeten;
}

const klein = (gemeten: Record<string, number>) =>
	Object.entries(gemeten).filter(([, h]) => h < 43.5);

test.describe('on a phone', () => {
	test.beforeEach(({ touch }) => test.skip(!touch, 'a phone'));

	for (const [naam, pad] of [
		['an article', ARTICLE],
		['Actueel', '/actueel'],
		['a dossier', '/dossiers/36496'],
		['a judgment', JUDGMENT],
		['a Kamerstuk', '/kamerstukken/36799/31'],
		['a motie', '/kamerstukken/36764/19'],
		['a stemming', '/stemmingen/decision_154df5db_64e5_414a_9cd1_3967aab7de58'],
		['a toezegging', '/toezeggingen/TZ202603-117'],
		['a Kamerlid', '/leden/rob-jetten'],
		['a fractie', '/fracties/d66'],
		['a kabinet', '/kabinetten/rutte_iv'],
		['a publication', '/stb/2026/94'],
		['the start', '/']
	] as const) {
		test(`every button of ${naam} is 44 px to a finger`, async ({ page }) => {
			test.setTimeout(120_000);
			await page.goto(pad);
			await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
			await page.waitForLoadState('networkidle');
			const g = await knoppen(page);
			expect(klein(g)).toEqual([]);
		});
	}

	test('the links of the footer are 44 px to a finger', async ({ page }) => {
		await page.goto('/over');
		await expect(page.locator('footer.foot')).toBeAttached();
		const g = await links(page, 'footer.foot a');
		expect(Object.keys(g).length).toBeGreaterThan(10);
		expect(klein(g)).toEqual([]);
	});

	test('the ways in on the start page are 44 px to a finger', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('.entrances a').first()).toBeVisible();
		const g = await links(page, '.entrances a');
		expect(Object.keys(g).length).toBeGreaterThan(4);
		expect(klein(g)).toEqual([]);
	});

	test('the rows of Inhoud are 44 px to a finger', async ({ page }) => {
		await page.goto('/wetten/32016R0679');
		await page.getByRole('button', { name: 'Inhoud', exact: true }).first().click();
		await expect(page.locator('.nav-kolom a:visible').first()).toBeVisible();
		const g = await links(page, '.nav-kolom a');
		expect(Object.keys(g).length).toBeGreaterThan(3);
		expect(klein(g)).toEqual([]);
	});

	test('the people in Actueel are 44 px to a finger', async ({ page }) => {
		await page.goto('/actueel');
		const persoon = page.locator('main a[href^="/leden/"]');
		await expect(persoon.first()).toBeVisible();
		const g = await links(page, 'main a[href^="/leden/"]');
		expect(Object.keys(g).length).toBeGreaterThan(0);
		expect(klein(g)).toEqual([]);
	});

	test('the items of a menu are 44 px high', async ({ page }) => {
		await page.goto(ARTICLE);
		await page.getByRole('button', { name: 'Citeer', exact: true }).click();
		for (const item of await page.getByRole('menuitem').all())
			expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
	});
});
