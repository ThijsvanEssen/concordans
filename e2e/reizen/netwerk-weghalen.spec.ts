// Toevoegen and then Weghalen of the same bron leaves the canvas as the page drew it (live toets
// 27 Oct, B5: the 200 uitspraken of the removed bron stayed drawn, overlapping).
import { expect, test } from '../support/test';

test('Weghalen after Toevoegen draws the canvas as it was', async ({ page, touch }) => {
	test.skip(touch, 'a phone chooses on the sheet');
	await page.goto('/wetten/BWBR0005289/artikel/6:162?mode=netwerk');
	const list = page.locator('.canvas-node-list a');
	await expect(list.nth(1)).toBeAttached();
	await expect.poll(() => list.count()).toBeGreaterThan(5);
	const before = await list.allTextContents();

	await list
		.filter({ hasText: /^Art\. 5:37 BW/ })
		.first()
		.focus();
	await page.keyboard.press('Enter');
	const card = page.locator('.strook--kaart.is-open');
	await card.getByRole('button', { name: 'Toevoegen' }).click();
	await expect(page).toHaveURL(/netwerk=/);
	await expect.poll(() => list.count()).toBeGreaterThan(before.length + 20);

	await card.getByRole('button', { name: 'Weghalen' }).click();
	await expect(page).not.toHaveURL(/netwerk=/);
	await expect.poll(() => list.count()).toBe(before.length);
	expect((await list.allTextContents()).sort()).toEqual([...before].sort());
});

// Live toets 27 Oct (b), B2: on a phone the melding after Toevoegen stands above the button
// Weergave and the card, covering neither.
test('the melding after Toevoegen covers neither Weergave nor the card', async ({
	page,
	touch
}) => {
	test.skip(!touch, 'a phone shows the melding on the canvas');
	await page.goto('/wetten/BWBR0005289/artikel/6:162?mode=netwerk&kies=articles/bwbr0005288_37');
	const card = page.locator('.strook--kaart.is-open');
	await card.getByRole('button', { name: 'Toevoegen' }).click();
	const melding = page.locator('.netwerk-melding');
	await expect(melding).toContainText('toegevoegd aan het netwerk');
	const box = async (l: ReturnType<typeof page.locator>) => (await l.boundingBox())!;
	const m = await box(melding);
	for (const other of [page.getByRole('button', { name: 'Weergave' }), card]) {
		const o = await box(other);
		expect(m.y + m.height, 'above the other').toBeLessThanOrEqual(o.y);
	}
});
