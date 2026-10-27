// A period chosen on the tijdstrook dims the bronnen outside it, with their lines (Tijdstrook,
// Netwerkcanvas): they stay on the canvas, so the canvas holds as many bronnen as before.
import { expect, test } from '../support/test';

test('a chosen period dims the bronnen outside it and takes none from the canvas', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a phone keeps Periode in the strip: the band is for the pointer');
	await page.goto('/uitspraken/ECLI:NL:HR:2019:2006?mode=netwerk');
	const canvas = page.locator('.canvas-wrap');
	const band = page.locator('.tijdstrook .band');
	await expect(band.locator('.stip').first()).toBeVisible();
	await expect(canvas).not.toHaveAttribute('data-nodes', '0');
	const voor = await canvas.getAttribute('data-nodes');
	await expect(canvas).toHaveAttribute('data-dimmed', '0');

	const box = (await band.boundingBox())!;
	const y = box.y + box.height / 2;
	await page.mouse.move(box.x + box.width * 0.5, y);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * 0.95, y, { steps: 5 });
	await page.mouse.up();
	await expect(page).toHaveURL(/[?&]van=/);

	await expect(canvas).toHaveAttribute('data-nodes', voor!);
	await expect(canvas).not.toHaveAttribute('data-dimmed', '0');
});
