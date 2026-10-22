// A bron opens in Tekst, also at its bare address; Verbonden draws its network on request,
// grouped beyond 40 bronnen, with a legend of one line that counts what is drawn (besluit 32).
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162';

const verbonden = (page: Page) => page.getByRole('complementary', { name: 'Verbonden' });
const sketch = (page: Page) => page.getByTestId('network-sketch');

test('a bare address opens the bron in Tekst, Verbonden beside or under it', async ({ page }) => {
	await page.goto(ARTICLE);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
	await expect(verbonden(page).getByRole('button', { name: 'Netwerk tonen' })).toBeVisible();
	await expect(page.locator('canvas')).toHaveCount(0);
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289\/artikel\/6:162$/);
});

test('Netwerk tonen draws the network in Verbonden, Netwerk verbergen takes it away', async ({
	page,
	touch
}) => {
	await page.goto(ARTICLE);
	const show = verbonden(page).getByRole('button', { name: 'Netwerk tonen' });
	if (touch) {
		const box = await show.boundingBox();
		expect(box!.height, 'a finger’s target').toBeGreaterThanOrEqual(44);
	}
	await show.click();
	await expect(page).toHaveURL(/toon=netwerk/);
	await expect(sketch(page)).toBeVisible();
	await verbonden(page).getByRole('button', { name: 'Netwerk verbergen' }).click();
	await expect(page).not.toHaveURL(/toon=netwerk/);
	await expect(sketch(page)).toHaveCount(0);
	await page.goBack();
	await expect(sketch(page)).toBeVisible();
});

test('beyond 40 bronnen a group is one circle with its count, and the legend counts what is drawn', async ({
	page
}) => {
	await page.goto(`${ARTICLE}?toon=netwerk`);
	const figure = sketch(page);
	// The judgments that cite 6:162 come per instantie, once their counts are in.
	await expect(figure.getByRole('button', { name: /^[\d.]+ Hoge Raad$/ })).toBeAttached();
	const singles = await figure.locator('a.single').count();
	const circles = figure.locator('g.cluster');
	const groups = await circles.count();
	expect(singles).toBeLessThanOrEqual(40);
	expect(groups).toBeGreaterThan(0);
	const counts = (
		await circles.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''))
	).map((label) => Number(label.split(' ')[0].replaceAll('.', '')));
	const total = counts.reduce((sum, n) => sum + n, 0);
	await expect(figure.locator('figcaption')).toHaveText(
		new RegExp(
			`^\\s*${singles} afzonderlijk\\s*${groups}\\s*groepen, ${total.toLocaleString('nl-NL').replaceAll('.', '\\.')} in totaal\\s*$`
		)
	);
	// No name on the drawing is longer than 24 characters.
	const names = await figure.locator('text.name').allTextContents();
	expect(names.filter((n) => n.length > 24)).toEqual([]);
	// A circle opens its group in Verbonden.
	await figure.getByRole('button', { name: /Kamerstukken$/ }).click();
	await expect(verbonden(page).locator('[data-group="documents"]')).toBeInViewport();
});
