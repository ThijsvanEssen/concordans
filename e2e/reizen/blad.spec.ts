// Het Blad (Design System, Principe 6): every sheet of the site is one component. Each opens with
// the focus in it, stands over the page behind it (which stands still), closes with Escape, with
// Sluiten and with a tap beside it, and gives the focus back to what opened it.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { isPhone, naarVerbonden } from '../support/navigation';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162';

/** Opens, then closes three ways; the page behind stands still while it is open. */
async function sluitOpDrieManieren(
	page: Page,
	opener: Locator,
	blad: Locator,
	tik: () => Promise<void>
) {
	for (const hoe of ['Escape', 'Sluiten', 'tik'] as const) {
		await opener.click();
		await expect(blad).toBeVisible();
		expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
		if (hoe === 'Escape') await page.keyboard.press('Escape');
		else if (hoe === 'Sluiten') await blad.getByRole('button', { name: 'Sluiten' }).click();
		else await tik();
		await expect(blad).toHaveCount(0);
		expect(await page.evaluate(() => document.body.style.position)).toBe('');
	}
	await opener.click();
	await page.keyboard.press('Escape');
	await expect(opener).toBeFocused();
}

test('the tab bar: Bronnen and Mijn are Bladen above the bar, the bar stays within reach', async ({
	page
}) => {
	test.skip(!isPhone(page), 'the tab bar is a phone');
	await page.goto(ARTICLE);
	const tabs = page.getByRole('navigation', { name: 'Hoofdmenu' });
	const bronnen = tabs.getByRole('button', { name: 'Bronnen' });
	const blad = page.getByRole('dialog', { name: 'Bronnen' });
	await sluitOpDrieManieren(page, bronnen, blad, () => page.mouse.click(187, 40));

	// The other tab takes over without closing first.
	await bronnen.click();
	await tabs.getByRole('button', { name: /^Mijn/ }).click();
	await expect(page.getByRole('dialog', { name: 'Mijn' })).toBeVisible();
	await expect(blad).toHaveCount(0);
});

test('Inhoud: a Blad where the text has no column of it', async ({ page }) => {
	test.skip(!isPhone(page), 'beside the text from 1440');
	await page.goto('/wetten/BWBR0005289');
	const knop = page.getByRole('button', { name: 'Inhoud', exact: true });
	await sluitOpDrieManieren(page, knop, page.getByRole('dialog', { name: 'Inhoud' }), () =>
		page.mouse.click(187, 40)
	);
});

test('Filter of Bladeren: a Blad of its own on a phone, with Toon at its foot', async ({
	page
}) => {
	test.skip(!isPhone(page), 'a row of buttons from 769 px');
	await page.goto('/explore?mode=index&kind=instruments');
	const knop = page.getByRole('button', { name: /^Filter/ });
	const blad = page.getByRole('dialog', { name: 'Filter' });
	await sluitOpDrieManieren(page, knop, blad, () => page.mouse.click(187, 40));
	await knop.click();
	await expect(blad.getByRole('button', { name: /^Toon / })).toBeVisible();
	expect((await blad.boundingBox())!.height).toBeLessThanOrEqual(
		page.viewportSize()!.height * 0.88
	);
});

test('Filter of Verbonden: a Blad with the search field in focus, and Toon at its foot', async ({
	page
}) => {
	await page.goto(ARTICLE);
	await naarVerbonden(page);
	const knop = page.getByRole('button', { name: 'Filter', exact: true });
	await knop.click();
	const blad = page.getByRole('dialog', { name: 'Filter' });
	await expect(blad).toBeVisible();
	await expect(blad.getByRole('searchbox', { name: 'Zoek in deze verbindingen' })).toBeFocused();
	await expect(blad.getByRole('button', { name: /^Toon / })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(blad).toHaveCount(0);
	await expect(knop).toBeFocused();
});
