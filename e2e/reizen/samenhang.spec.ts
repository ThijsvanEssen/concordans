// Samenhang: the network of a bron on the canvas (?mode=netwerk), its legend, the bronnen in it as a list, the Verbonden
// table and its export.
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';
import { naarVerbonden } from '../support/navigation';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162';

/** The legend stands in the strip at the left; narrower, under the button Filter. */
async function openFilters(page: import('@playwright/test').Page) {
	await openSheet(page);
	const filter = page.getByRole('button', { name: 'Filter', exact: true });
	await filter
		.or(page.getByRole('region', { name: 'Filters' }))
		.first()
		.waitFor();
	if (await filter.isVisible()) await filter.click();
}

/** The bronnen drawn, as the list beside the canvas counts them. */
const drawn = (page: import('@playwright/test').Page) =>
	page.getByRole('list', { name: /^Bronnen in het netwerk, \d+/ });

test('the network draws a bron with its neighbours and lists them', async ({ page }) => {
	await page.goto(`${ARTICLE}?mode=netwerk`);
	await expect(page.locator('canvas').first()).toBeAttached();
	await expect(drawn(page)).toBeAttached();
	await expect(drawn(page).getByRole('link', { name: 'Art. 6:162 BW, Artikel' })).toBeAttached();
	expect(await drawn(page).getByRole('listitem').count()).toBeGreaterThan(5);
});

test('the legend switches a kind of bron off and on', async ({ page }) => {
	await page.goto(`${ARTICLE}?mode=netwerk`);
	// The network fills in steps; the count is read once it has.
	await page.waitForLoadState('networkidle');
	await openFilters(page);
	const legend = page.getByRole('region', { name: 'Filters' });
	const judgments = legend.getByRole('button', { name: /^Uitspraken [\d.]+( van [\d.]+)?$/ });
	await expect(judgments).toHaveAttribute('aria-pressed', 'true');
	const before = await drawn(page).getAttribute('aria-label');
	await judgments.click();
	await expect(judgments).toHaveAttribute('aria-pressed', 'false');
	await expect(drawn(page)).not.toHaveAttribute('aria-label', before!);
	await judgments.click();
	await expect(drawn(page)).toHaveAttribute('aria-label', before!);
});

// The network of a stuk holds what its own verbindingen reach (API surroundings, R3-N B13): its
// dossier as one bron, its indiener, its own vote, never what the indiener voted on or signed
// elsewhere (productcheck 0.80, punt 3: votes of July 2025 on another matter around a motie of
// 2026), nor the votes of the rest of its dossier.
for (const { stuk, own, votes } of [
	{
		stuk: '/kamerstukken/36799/31',
		own: /29 september 2026: Motie van het lid De Beer over bij proactieve dienstverlening/,
		votes: 1
	},
	{ stuk: '/kamerstukken/37020-X/53', own: /Beslisnota bij Kamerbrief over incident/, votes: 0 }
]) {
	test(`the network of ${stuk} draws no stemming of its indiener elsewhere`, async ({ page }) => {
		await page.goto(`${stuk}?mode=netwerk`);
		await expect(drawn(page).getByRole('link', { name: own })).toBeAttached();
		await page.waitForLoadState('networkidle');
		const items = await drawn(page).getByRole('listitem').allInnerTexts();
		const stemmingen = items.filter((t) => t.endsWith(', Stemming'));
		expect(stemmingen.length).toBe(votes);
		// A stemming in the network is the stuk's own, of the autumn of 2026.
		expect(stemmingen.filter((t) => !/\s(september|oktober)\s2026: /.test(t))).toEqual([]);
	});
}

// Soort names the soorten of Verbonden and how many of each are drawn (N1): the stemmingen
// drawn are counted, "N" or "N van M", in Stemmingen and, past its count, Overige stemmingen.
test('the open legend counts the stemmingen drawn, the focus selected', async ({ page }) => {
	await page.goto('/kamerstukken/36799/31?mode=netwerk');
	await page.waitForLoadState('networkidle');
	const items = await drawn(page).getByRole('listitem').allInnerTexts();
	const stemmingen = items.filter((t) => t.endsWith(', Stemming')).length;
	expect(stemmingen).toBeGreaterThan(0);
	await openFilters(page);
	const legend = page.getByRole('region', { name: 'Filters' });
	const rows = legend.getByRole('button', {
		name: /^(Overige s|S)temmingen [\d.]+( van [\d.]+)?$/
	});
	await expect(rows.first()).toBeVisible();
	await expect(legend.locator('[aria-label="wordt geteld"]')).toHaveCount(0);
	const getekend = (await rows.allInnerTexts()).map((t) =>
		Number(/(?:^|\s)([\d.]+)(?: van |$)/.exec(t.replace('\n', ' '))![1].replace(/\./g, ''))
	);
	expect(getekend.reduce((a, b) => a + b, 0)).toBe(stemmingen);
});

test('Verbonden as a table, exported as CSV', async ({ page }) => {
	await page.goto(ARTICLE);
	await naarVerbonden(page);
	await page.getByRole('link', { name: 'Alles in een tabel' }).click();
	await expect(page).toHaveURL(/tabel=1/);
	await expect(page.getByRole('heading', { name: 'Verbindingen van Art. 6:162 BW' })).toBeVisible();
	const table = page.getByRole('table');
	for (const column of ['Bron', 'Verbinding', 'Plaats in de bron', 'Datum'])
		await expect(table.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
	await expect(table.getByRole('row').nth(1)).toContainText('haalt aan');

	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: /^Exporteer/ }).click();
	expect((await download).suggestedFilename()).toMatch(/\.csv$/);
});

test('an empty werkplek is empty: the field Bron toevoegen, no example', async ({ page }) => {
	await page.goto('/explore');
	await openSheet(page);
	const network = page.getByRole('region', { name: 'Netwerk' });
	// The field, or on a phone the button that opens it.
	await expect(
		network
			.getByPlaceholder('Bron toevoegen')
			.or(network.getByRole('button', { name: 'Bron toevoegen' }))
	).toBeVisible();
	await expect(network.getByRole('button', { pressed: true })).toHaveCount(0);
	// The werkplek has drawn its empty canvas: the heading is there, and no bron on the list.
	await expect(page.getByTestId('werkplek')).toBeVisible();
	await expect(page.locator('.canvas-node-list li')).toHaveCount(0);
	await expect(page).toHaveURL(/\/explore$/);
	await expect(page.getByText(/^Voorbeeld/)).toHaveCount(0);
});

test('a bron in the network becomes the focus, and Samenhang follows it', async ({ page }) => {
	await page.goto(`${ARTICLE}?mode=netwerk`);
	// Past forty, the stukken of 6:162 stand as one cluster (UX review N4): an article beside it.
	const artikel = drawn(page)
		.getByRole('link', { name: /, Artikel$/ })
		.nth(1);
	const name = (await artikel.getAttribute('aria-label')) ?? (await artikel.textContent())!;
	await artikel.focus();
	// Enter chooses it as a click does (R9); Enter again reads it.
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/[?&]kies=/);
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/artikel\//);
	await expect(page).not.toHaveURL(/6:162/);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	expect(name).toMatch(/, Artikel$/);
});
