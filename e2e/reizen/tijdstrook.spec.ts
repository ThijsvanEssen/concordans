// The tijdstrook under the canvas: a drag over its band chooses the period, which the address
// holds (?van, ?tot); a tap on the one year chosen gives every year back. The grips are
// sliders for the keyboard (tijdstrook-staafstrook.spec.ts).
import { expect, test } from '../support/test';

test('a drag over the band chooses a period; a tap on that one year gives it back', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a phone opens its band in a Blad (tijdstrook-staafstrook.spec.ts)');
	await page.goto('/wetten/BWBR0005289/artikel/6:162?mode=netwerk');
	const band = page.locator('.tijdstrook .band');
	await expect(band).toBeVisible();
	await expect(band.locator('.deel').first()).toBeVisible();
	const box = (await band.boundingBox())!;
	const y = box.y + box.height / 2;

	await page.mouse.move(box.x + box.width * 0.5, y);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * 0.9, y, { steps: 5 });
	await page.mouse.up();
	await expect(band.locator('.keuze')).toBeVisible();
	await expect(page).toHaveURL(/[?&]van=/);
	await expect(page).toHaveURL(/[?&]tot=/);
	await expect(band.locator('.kolom.is-dim').first()).toBeAttached();

	// One year, chosen and tapped again: every year is back.
	const x = box.x + box.width * 0.7;
	await page.mouse.click(x, y);
	await expect(page).toHaveURL(/[?&]van=(\d{4})/);
	await page.mouse.click(x, y);
	await expect(page).not.toHaveURL(/[?&]van=/);
	await expect(band.locator('.keuze')).toHaveCount(0);
});

test('on a phone the button Weergave stands above the tijdstrook, not over its band (A294 B2)', async ({
	page,
	touch
}) => {
	test.skip(!touch, 'the button is for a phone');
	await page.goto('/wetten/BWBR0005289/artikel/6:162?mode=netwerk');
	const strook = page.locator('.tijdstrook');
	await expect(strook).toBeVisible();
	const knop = page.getByRole('button', { name: 'Weergave', exact: true });
	await expect(knop).toBeVisible();
	const a = (await knop.boundingBox())!;
	const b = (await strook.boundingBox())!;
	expect(a.y + a.height).toBeLessThanOrEqual(b.y + 1);
});
