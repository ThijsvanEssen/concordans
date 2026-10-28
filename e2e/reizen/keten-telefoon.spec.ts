// The keten on a phone is a list per layer: each row says how it hangs (besluit 39, DS Keten,
// Telefoon), its sign is the one of the drawing, Alle N is a button, nothing floats over the list.
import { expect, test } from '../support/test';

test.skip(({ isMobile }) => !isMobile, 'the list is for a phone');

test('a row says how it hangs, with the sign of the drawing', async ({ page }) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	const list = page.locator('.chain .list');
	await expect(list.getByRole('heading', { name: 'Commissie' })).toBeVisible();
	// A seat with its role and years.
	await expect(
		list.locator('.list__how', { hasText: /^(Voorzitter|Plaatsvervangend lid), \d{4}/ }).first()
	).toBeVisible();
	// A ministerie under the kabinet it sits under.
	await expect(list.locator('.list__how', { hasText: /^Onder kabinet-/ }).first()).toBeVisible();
	// The sign is a KindGlyph, not a square of colour.
	await expect(list.locator('.list__row svg.kind-glyph').first()).toBeVisible();
	await expect(list.locator('.mark:not(:has(svg))')).toHaveCount(0);
});

test('Alle N is a framed button of a finger’s height', async ({ page }) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	const alle = page.locator('.chain .list').getByRole('button', { name: /^Alle \d+/ });
	await expect(alle.first()).toBeVisible();
	const box = (await alle.first().boundingBox())!;
	expect(box.height).toBeGreaterThanOrEqual(44);
	const border = await alle.first().evaluate((e) => getComputedStyle(e).borderTopColor);
	expect(border).not.toBe('rgba(0, 0, 0, 0)');
});

test('the last row of the list clears the floating Weergave button', async ({ page }) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	const list = page.locator('.chain .list');
	await expect(list).toBeVisible();
	await page.locator('.chain').evaluate((e) => (e.scrollTop = e.scrollHeight));
	const last = (await list.locator('.list__row').last().boundingBox())!;
	const weergave = (await page.getByRole('button', { name: 'Weergave' }).boundingBox())!;
	expect(last.y + last.height).toBeLessThanOrEqual(weergave.y);
});
