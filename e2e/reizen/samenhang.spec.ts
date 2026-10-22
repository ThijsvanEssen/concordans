// Samenhang: the network of a bron on the canvas (?mode=netwerk), its legend, the bronnen in it as a list, the Verbonden
// table and its export.
import { expect, test } from '../support/test';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162';

/** The bronnen drawn, as the list beside the canvas counts them. */
const drawn = (page: import('@playwright/test').Page) =>
	page.getByRole('list', { name: /^Bronnen in het netwerk, \d+/ });

test('the network draws a bron with its neighbours and lists them', async ({ page, touch }) => {
	await page.goto(`${ARTICLE}?mode=netwerk`);
	if (touch)
		await page
			.getByRole('navigation', { name: 'Panelen' })
			.getByRole('button', { name: 'Netwerk' })
			.click();
	await expect(page.locator('canvas').first()).toBeAttached();
	await expect(drawn(page)).toBeAttached();
	await expect(drawn(page).getByRole('link', { name: 'Art. 6:162 BW, Artikel' })).toBeAttached();
	expect(await drawn(page).getByRole('listitem').count()).toBeGreaterThan(5);
});

test('the legend switches a kind of bron off and on', async ({ page, touch }) => {
	await page.goto(`${ARTICLE}?mode=netwerk`);
	if (touch)
		await page
			.getByRole('navigation', { name: 'Panelen' })
			.getByRole('button', { name: 'Netwerk' })
			.click();
	// The network fills in steps; the count is read once it has.
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: /^Legenda/ }).click();
	const legend = page.getByRole('region', { name: 'Legenda' });
	const judgments = legend.getByRole('button', { name: /^Uitspraken [\d.]+$/ });
	await expect(judgments).toHaveAttribute('aria-pressed', 'true');
	const before = await drawn(page).getAttribute('aria-label');
	await judgments.click();
	await expect(judgments).toHaveAttribute('aria-pressed', 'false');
	await expect(drawn(page)).not.toHaveAttribute('aria-label', before!);
	await judgments.click();
	await expect(drawn(page)).toHaveAttribute('aria-label', before!);
});

// The network of a stuk holds what its own verbindingen reach: its dossier with the dossier's
// stukken and stemmingen, its indiener, never what the indiener voted on or signed elsewhere
// (productcheck 0.80, punt 3: votes of July 2025 on another matter around a motie of 2026).
for (const { stuk, own } of [
	{
		stuk: '/kamerstukken/36799/31',
		own: /29 september 2026: Motie van het lid De Beer over bij proactieve dienstverlening/
	},
	{ stuk: '/kamerstukken/37020-X/53', own: /Beslisnota bij Kamerbrief over incident/ }
]) {
	test(`the network of ${stuk} draws no stemming of its indiener elsewhere`, async ({
		page,
		touch
	}) => {
		await page.goto(`${stuk}?mode=netwerk`);
		if (touch)
			await page
				.getByRole('navigation', { name: 'Panelen' })
				.getByRole('button', { name: 'Netwerk' })
				.click();
		await expect(drawn(page).getByRole('link', { name: own })).toBeAttached();
		await page.waitForLoadState('networkidle');
		const items = await drawn(page).getByRole('listitem').allInnerTexts();
		const stemmingen = items.filter((t) => t.endsWith(', Stemming'));
		expect(stemmingen.length).toBeGreaterThan(0);
		// Each stemming in the network is of the stuk's own dossier, all of the autumn of 2026.
		expect(stemmingen.filter((t) => !/ (september|oktober) 2026: /.test(t))).toEqual([]);
	});
}

// The Legenda counts what is drawn, with the focus selected too, open as closed (besluit 29):
// the focus's direct verbindingen are in Verbonden, not here ("Stemmingen 0" beside 49 drawn).
test('the open legend counts the stemmingen drawn, the focus selected', async ({ page, touch }) => {
	await page.goto('/kamerstukken/36799/31?mode=netwerk');
	if (touch)
		await page
			.getByRole('navigation', { name: 'Panelen' })
			.getByRole('button', { name: 'Netwerk' })
			.click();
	await page.waitForLoadState('networkidle');
	const items = await drawn(page).getByRole('listitem').allInnerTexts();
	const stemmingen = items.filter((t) => t.endsWith(', Stemming')).length;
	expect(stemmingen).toBeGreaterThan(0);
	await page.getByRole('button', { name: /^Legenda/ }).click();
	const legend = page.getByRole('region', { name: 'Legenda' });
	await expect(legend.getByRole('button', { name: /^Stemmingen [\d.]+$/ })).toHaveAccessibleName(
		`Stemmingen ${stemmingen}`
	);
});

test('Verbonden as a table, exported as CSV', async ({ page }) => {
	await page.goto(ARTICLE);
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

test('Samenhang opens with an example network that can be cleared', async ({ page, touch }) => {
	await page.goto('/explore');
	await page.waitForLoadState('networkidle');
	const network = page.getByRole('region', { name: 'Netwerk' });
	// At 375 the chosen bronnen fold under the bar of the network.
	if (touch) await network.getByRole('button', { name: /^Netwerk \d+ bronnen$/ }).click();
	await expect(network.getByRole('button', { pressed: true }).first()).toBeVisible();
	await network.getByRole('button', { name: 'Wissen' }).click();
	await expect(network.getByRole('button', { name: 'Wissen' })).toHaveCount(0);
});

test('a bron in the network becomes the focus, and Samenhang follows it', async ({
	page,
	touch
}) => {
	test.skip(touch, 'the list of the network is the keyboard way at 1440');
	await page.goto(`${ARTICLE}?mode=netwerk`);
	const stuk = drawn(page)
		.getByRole('link', { name: /, Stuk$/ })
		.first();
	const name = (await stuk.getAttribute('aria-label')) ?? (await stuk.textContent())!;
	await stuk.focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/kamerstukken\//);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	expect(name).toContain('Kamerstuk');
});
