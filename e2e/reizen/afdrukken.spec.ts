// On paper a reader is its head, its status line, its text and the address it was read at.
import { expect, test } from '../support/test';

for (const path of [
	'/wetten/BWBR0005289/artikel/6:162',
	'/uitspraken/ECLI:NL:HR:2019:2006',
	'/kamerstukken/36799/31'
]) {
	test(`${path} prints without bar, network, buttons and panels`, async ({ page }) => {
		await page.goto(path);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await page.emulateMedia({ media: 'print' });
		await expect(page.locator('.topbar')).toBeHidden();
		await expect(page.locator('.col--graph')).toBeHidden();
		await expect(page.locator('.col--panel')).toBeHidden();
		for (const button of await page.locator('.reader-frame button:not(.plaats-marker)').all())
			await expect(button).toBeHidden();
		await expect(page.locator('.reader-status__acties')).toBeHidden();
		// The address it was read at, with the day.
		const source = page.locator('.papier-bron');
		await expect(source).toBeVisible();
		await expect(source).toContainText(path.replace(/^\//, ''));
		await expect(source).toContainText(/geraadpleegd \d{1,2}\s\w+\s\d{4}/);
		// The text runs on past the screen: nothing scrolls on its own.
		const overflow = await page
			.locator('.reader-frame')
			.evaluate((e) => getComputedStyle(e).overflowY);
		expect(overflow).toBe('visible');
	});
}
