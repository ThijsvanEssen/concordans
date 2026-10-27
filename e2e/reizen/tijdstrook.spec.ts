// The tijdstrook under the canvas: a drag over its band chooses the period, which the address
// holds (?van, ?tot); a tap on the one year chosen gives every year back. Periode in the strip
// is the keyboard's way, so the band itself is for the pointer.
import { expect, test } from '../support/test';

test('a drag over the band chooses a period; a tap on that one year gives it back', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a phone keeps Periode in the strip: the band is for the pointer');
	await page.goto('/wetten/BWBR0005289/artikel/6:162?mode=netwerk');
	const band = page.locator('.tijdstrook .band');
	await expect(band).toBeVisible();
	await expect(band.locator('.stip').first()).toBeVisible();
	const box = (await band.boundingBox())!;
	const y = box.y + box.height / 2;

	await page.mouse.move(box.x + box.width * 0.5, y);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * 0.9, y, { steps: 5 });
	await page.mouse.up();
	await expect(band.locator('.keuze')).toBeVisible();
	await expect(page).toHaveURL(/[?&]van=/);
	await expect(page).toHaveURL(/[?&]tot=/);
	await expect(band.locator('.stip.is-dim').first()).toBeAttached();

	// One year, chosen and tapped again: every year is back.
	const x = box.x + box.width * 0.7;
	await page.mouse.click(x, y);
	await expect(page).toHaveURL(/[?&]van=(\d{4})/);
	await page.mouse.click(x, y);
	await expect(page).not.toHaveURL(/[?&]van=/);
	await expect(band.locator('.keuze')).toHaveCount(0);
});
