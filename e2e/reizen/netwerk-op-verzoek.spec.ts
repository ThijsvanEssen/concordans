// A bron opens in Tekst, also at its bare address; Verbonden draws its network from the start
// (Thijs, 29 Oct), grouped beyond 40 bronnen, with a legend of one line that counts what is
// drawn; Filter and Open in netwerk stand at the right of its heading.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { naarVerbonden } from '../support/navigation';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162';

const verbonden = (page: Page) => page.getByRole('complementary', { name: 'Verbonden' });
const sketch = (page: Page) => page.getByTestId('network-sketch');

test('a bare address opens the bron in Tekst, Verbonden with its network beside or under it', async ({
	page,
	touch
}) => {
	await page.goto(ARTICLE);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
	await naarVerbonden(page);
	await expect(sketch(page)).toBeVisible();
	await expect(
		verbonden(page).getByRole('button', { name: /Netwerk (tonen|verbergen)/ })
	).toHaveCount(0);
	await expect(page.locator('canvas')).toHaveCount(0);
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289\/artikel\/6:162$/);
	const open = verbonden(page).getByRole('link', { name: 'Open in netwerk' });
	await expect(open).toHaveAttribute('href', /mode=netwerk/);
	if (touch) {
		const box = await open.boundingBox();
		expect(box!.height, 'a finger’s target').toBeGreaterThanOrEqual(44);
	}
	await open.click();
	await expect(page).toHaveURL(/mode=netwerk/);
});

test('beyond 40 bronnen a group is one circle with its count, and the legend counts what is drawn', async ({
	page
}) => {
	await page.goto(ARTICLE);
	await naarVerbonden(page);
	const figure = sketch(page);
	// The judgments that cite 6:162 come per instantie, once their counts are in.
	await expect(figure.getByRole('button', { name: /^[\d.]+ Hoge Raad$/ })).toBeAttached();
	// The legend and the drawing stand from one state: the bronnen on their own are read from it.
	await expect(figure.locator('figcaption')).toContainText('groepen');
	const own = /^([\d.]+) bron(?:nen)?, /.exec(await figure.locator('figcaption').innerText());
	const singles = own ? Number(own[1].replaceAll('.', '')) : 0;
	const circles = figure.locator('g.cluster');
	const groups = await circles.count();
	expect(singles).toBeLessThanOrEqual(40);
	expect(groups).toBeGreaterThan(0);
	const counts = (
		await circles.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''))
	).map((label) => Number(label.split(' ')[0].replaceAll('.', '')));
	const total = counts.reduce((sum, n) => sum + n, 0);
	const nl = (n: number) => n.toLocaleString('nl-NL').replaceAll('.', '\\.');
	// 7 bronnen, 3 groepen van 6.507 uitspraken
	const legend = `${singles ? `${singles} bron(?:nen)?, ` : ''}${groups} groepen? van ${nl(total)} \\w+`;
	await expect(figure.locator('figcaption')).toHaveText(new RegExp(`^\\s*${legend}\\s*$`));
	// What is drawn is what the heading counts: the bronnen on their own and the groups together.
	await expect(verbonden(page).locator('.head__count')).toHaveText(
		new RegExp(`^${nl(singles + total)} verbindingen$`)
	);
	// No name is cut: each line of a name at most 24 characters, no "…".
	const lines = await figure.locator('g.cluster text.name tspan').allTextContents();
	expect(lines.filter((n) => n.length > 24 || n.endsWith('…'))).toEqual([]);
	// A circle opens its soort in place in the one view of Verbonden (A208e): its heading folds it.
	await figure.getByRole('button', { name: /Stukken$/ }).click();
	await expect(verbonden(page).locator('[data-kind="documents"]')).toBeVisible();
	await expect(
		verbonden(page).locator('[data-kind="documents"]').locator('button[aria-expanded]')
	).toHaveAttribute('aria-expanded', 'true');
});
