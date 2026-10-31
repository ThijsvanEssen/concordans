// The keten of the Grondwet: Noemt is on from the start, a wet that only names the law in its
// text (Kieswet, Wet op de Raad van State) beside it in the layer Wet, with a dashed line; switched off, a
// regulation under a regulation that only names the law goes with it, and a missing basis_kind
// is no grondslag (the Proclamatie).
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { noemt } from '../support/noemt';
import { isPhone } from '../support/navigation';

const GRONDWET = '/explore?netwerk=instruments/bwbr0001840&weergave=keten';

/** The text the keten holds: the drawing on a wide screen, the list on a phone. */
const ketenText = async (page: Page) =>
	(await page.locator('main').innerText()).replace(/\s+/g, ' ');

test('without Noemt the Grondwet keten holds no regulation that hangs only under a mention', async ({
	page
}) => {
	await page.goto(GRONDWET);
	await expect(page.getByText('Koninklijk besluit', { exact: true }).first()).toBeAttached();
	await noemt(page);
	await expect(page.getByText('Kieswet')).toHaveCount(0);
	const text = await ketenText(page);
	expect(text).not.toContain('Defensieregeling');
	expect(text).not.toContain('Proclamatie houdende');
	expect(text).not.toContain('Kieswet');
});

test('Noemt, on from the start, draws the wetten that only name the Grondwet in their text, with their dashed line', async ({
	page
}) => {
	await page.goto(GRONDWET);
	await expect(page.getByText('Koninklijk besluit', { exact: true }).first()).toBeAttached();
	// on from the start
	await expect(page.getByText('Kieswet').first()).toBeAttached();
	await expect(page.getByText('Wet op de Raad van State').first()).toBeAttached();
	// Its lines are dashed (a mention), on the drawing.
	if (await page.locator('svg.drawing').isVisible())
		expect(await page.locator('svg.drawing path.line[stroke-dasharray]').count()).toBeGreaterThan(
			0
		);
});

test('Weergave keys the keten with the same rows and counts on a phone as on a wide screen', async ({
	page
}) => {
	await page.goto(GRONDWET);
	await expect(page.getByText('Koninklijk besluit', { exact: true }).first()).toBeAttached();
	if (isPhone(page)) await page.getByRole('button', { name: 'Weergave', exact: true }).click();
	const weergave = isPhone(page)
		? page.getByRole('dialog', { name: 'Weergave' })
		: page.getByRole('region', { name: 'Weergave' });
	for (const row of [/Gekozen\s+bron$/, /Grondslag$/, /Noemt, of grondslag onbekend$/])
		await expect(weergave.locator('.sleutel__item', { hasText: row })).toBeVisible();
	// Every line of the keten, those under an "Alle N" too: not what the width leaves drawn.
	const count = (name: string) =>
		weergave.getByRole('button', { name: new RegExp(`^${name}`) }).locator('.aantal');
	await expect(count('Structureel')).toHaveText('166');
	await expect(count('Aanhaling')).toHaveText('224');
});
