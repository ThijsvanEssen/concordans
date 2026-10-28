// The werkplek Netwerk (besluit 39): a bron of the drawing in Verbonden opens in place and
// joins the netwerk from there; the button Netwerk counts it and opens the werkplek, the canvas
// without a reader; Lees on a marked bron is a step of its own, and Back brings the werkplek
// back as it was, with the same chips and the same bron marked.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { openSheet, closeSheet } from '../support/sheet';
import { netwerkKnop } from '../support/navigation';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:163';

const panel = (page: Page) => page.getByRole('region', { name: 'Netwerk' });
/** The chips of the netwerk, the panel unfolded where a phone folds it. */
async function chips(page: Page) {
	await openSheet(page);
	const fold = panel(page).getByRole('button', { name: /^Netwerk \d+ bron/ });
	const chosen = panel(page).getByRole('button', { pressed: true });
	await expect(fold.or(chosen.first())).toBeVisible();
	if (await fold.isVisible()) await fold.click();
	await expect(chosen.first()).toBeVisible();
	return chosen;
}

test('lezer, netwerk, Lees and Back: the same chips and the same bron marked', async ({ page }) => {
	await page.goto(`${ARTICLE}?toon=netwerk`);
	const sketch = page.getByTestId('network-sketch');
	const single = sketch.locator('.single').first();
	await expect(single).toBeVisible();
	const name = (await single.getAttribute('aria-label'))!;
	// One click opens the bron in place, under the drawing: no step.
	await single.click();
	await expect(page).toHaveURL(/6:163\?toon=netwerk$/);
	const rij = page.getByRole('region', { name });
	await expect(rij).toContainText(name.split(',')[0]);
	await rij.getByRole('button', { name: 'Aan het netwerk toevoegen' }).click();
	await expect(netwerkKnop(page)).toHaveAccessibleName('Netwerk, 1 bron');

	await netwerkKnop(page).click();
	await expect(page).toHaveURL(/mode=netwerk&netwerk=/);
	await expect(page.getByTestId('werkplek')).toBeVisible();
	await expect(page.locator('.reader-frame')).toHaveCount(0);
	await expect(page.locator('.mobile-tab')).toHaveCount(0);
	const id = new URL(page.url()).searchParams.get('netwerk')!;

	// The bron marked, as a click on the canvas marks it: its card with Lees, in the strip at
	// the right (a sheet under the canvas on a phone), covering no bron.
	await page.goto(`${page.url()}&kies=${encodeURIComponent(id)}`);
	const gekozen = await (await chips(page)).allInnerTexts();
	await closeSheet(page);
	const lees = page.getByRole('link', { name: 'Lees', exact: true });
	await expect(lees).toBeVisible();
	await lees.click();
	await expect(page).not.toHaveURL(/mode=netwerk/);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(netwerkKnop(page)).toHaveAccessibleName('Netwerk, 1 bron');

	await page.goBack();
	await expect.poll(() => new URL(page.url()).searchParams.get('kies')).toBe(id);
	await expect(page.getByRole('link', { name: 'Lees', exact: true })).toBeVisible();
	await expect(await chips(page)).toHaveText(gekozen);
});

test('the keten of a law: its regulations in layers, a click opens the card with Lees', async ({
	page,
	touch
}) => {
	await page.goto('/wetten/BWBR0010346?mode=netwerk&weergave=keten');
	await openSheet(page);
	await expect(page.getByRole('button', { name: 'Keten', pressed: true })).toBeVisible();
	await closeSheet(page);
	// On a wide screen a drawing in layers, on a phone a list per layer.
	const regeling = touch
		? page.getByRole('region', { name: 'AMvB' }).getByRole('button').first()
		: page.getByRole('group', { name: 'Keten' }).getByRole('button', { pressed: false }).last();
	await expect(regeling).toBeVisible();
	await regeling.click();
	await expect(page).toHaveURL(/kies=/);
	await expect(page.getByRole('link', { name: 'Lees', exact: true })).toBeVisible();
});

test('Netwerk is a switch: on opens the werkplek, off brings the same text back', async ({
	page
}) => {
	await page.goto(`${ARTICLE}#lid-2`);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	const knop = netwerkKnop(page);
	await expect(knop).toHaveAttribute('aria-pressed', 'false');
	await knop.click();
	await expect(page).toHaveURL(/mode=netwerk/);
	await expect(page.getByTestId('werkplek')).toBeVisible();
	await expect(knop).toHaveAttribute('aria-pressed', 'true');
	// No way back of its own in the strip: the switch is it.
	await expect(page.getByRole('link', { name: /^← / })).toHaveCount(0);
	await knop.click();
	await expect(page).toHaveURL(new RegExp(`${ARTICLE.replace(/[.:]/g, '\\$&')}#lid-2$`));
	await expect(page.getByTestId('werkplek')).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(knop).toHaveAttribute('aria-pressed', 'false');
});
