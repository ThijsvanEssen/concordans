// The werkplek on a tablet (1024 wide, a mouse): the three strips fit side by side, the page
// does not scroll sideways and the card of the bron marked stands beside the canvas.
import { expect, test } from '../support/test';

test.use({ viewport: { width: 1024, height: 768 } });

test('the werkplek at 1024: strip, canvas and card side by side without overflow', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a tablet with a mouse: the mobile project has its own width');
	await page.goto('/explore?netwerk=instruments/bwbr0005537&kies=instruments/bwbr0005537');
	const werkplek = page.getByTestId('werkplek');
	await expect(werkplek).toBeVisible();
	const strip = page.getByRole('complementary', { name: 'Bronnen en filters' });
	await expect(strip).toBeVisible();
	const lees = page.getByRole('link', { name: 'Lees', exact: true });
	await expect(lees).toBeVisible();
	const canvas = page.locator('canvas').first();
	await expect(canvas).toBeAttached();

	const [s, c, k] = await Promise.all([strip, canvas, lees].map((l) => l.boundingBox()));
	// Left to right: the strip, then the canvas, then the card; none over another.
	expect(s!.x + s!.width).toBeLessThanOrEqual(c!.x + 1);
	expect(k!.x).toBeGreaterThanOrEqual(c!.x + c!.width - 1);
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
	).toBeLessThanOrEqual(0);
});
