// The block of a concept under the text of an article that is one of its articles (B141):
// the articles that make one doctrine, and the newest judgments and papers over all of them.
import { expect, test } from '../support/test';

test('Art. 120 Gw shows its concept under the text, over Vorig and Volgend', async ({
	page,
	touch
}) => {
	await page.goto('/wetten/BWBR0001840/artikel/120');
	const kop = page.getByRole('heading', { level: 2, name: /^Toetsing van wetten/ });
	await expect(kop).toBeVisible({ timeout: 30_000 });
	await expect(page.getByRole('link', { name: 'Uitleg: Rijksoverheid ↗' })).toBeVisible();

	// This article is marked and no link; the others lead to their article.
	const dit = page.locator('.artikel[aria-current="true"]');
	await expect(dit).toContainText('dit artikel');
	await expect(dit.getByRole('link')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Art. 94 Gw' })).toHaveAttribute(
		'href',
		'/wetten/BWBR0001840/artikel/94'
	);

	// On a phone the lists stand behind a fold-out of a finger's height.
	const uitklap = page.getByRole('button', { name: /Uitspraken en stukken bij deze artikelen/ });
	if (touch) {
		await expect(uitklap).toHaveAttribute('aria-expanded', 'true');
		expect((await uitklap.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		await uitklap.click();
		await expect(uitklap).toHaveAttribute('aria-expanded', 'false');
		await expect(page.getByRole('heading', { level: 3, name: /^Uitspraken bij/ })).toBeHidden();
	} else {
		await expect(uitklap).toBeHidden();
		await expect(page.getByRole('heading', { level: 3, name: /^Uitspraken bij/ })).toBeVisible();
		await expect(page.getByRole('heading', { level: 3, name: /^Stukken bij/ })).toBeVisible();
	}
});

test('an article in no concept shows no block', async ({ page }) => {
	await page.goto('/wetten/BWBR0001840/artikel/10');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('.artikelen')).toHaveCount(0);
});
