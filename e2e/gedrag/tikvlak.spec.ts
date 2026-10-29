// A finger's target on a phone (besluit 30, T5 E2): every button and menu button is 44 px high
// to the touch, whatever it looks like; what is drawn may be smaller, the target is not. It is
// measured as a finger meets it: the pixels above and below the button's middle that still
// land on the button.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { ARTICLE } from '../support/bundels';
import { SOORTEN } from '../support/soorten';

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

	// The place markers of a treaty and of an amendment (Alinea 2, art. 18 lid 1) stand on
	// consecutive lines of running text and meet at 36 to 43 px (E8 par. 5): open, not hidden.
	const MARKERS_OPEN = new Set(['verdrag', 'amendement']);

	// Every kind of bron there is (support/soorten.ts), the amendment with its toelichting that
	// opens as a menu, and the pages that are no bron.
	for (const [naam, pad] of [
		...SOORTEN.map(([soort, adres]) => [soort, adres] as const),
		['amendement', '/kamerstukken/36275/12'],
		['Actueel', '/actueel'],
		['the start', '/']
	] as const) {
		test(`every button of ${naam} is 44 px to a finger`, async ({ page }) => {
			test.fixme(MARKERS_OPEN.has(naam), 'place markers in running text meet under 44 px');
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
		await expect(page.locator('.vragen__lijst a').first()).toBeVisible();
		const g = await links(page, '.vragen__lijst a');
		expect(Object.keys(g).length).toBeGreaterThan(2);
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

	// Not the names in the sentence of the indieners: running text (WCAG 2.5.8, inline).
	test('the people in Actueel are 44 px to a finger', async ({ page }) => {
		await page.goto('/actueel');
		const mensen = 'main a[href^="/leden/"]:not(.submitters a)';
		const persoon = page.locator(mensen);
		await expect(persoon.first()).toBeVisible();
		const g = await links(page, mensen);
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
