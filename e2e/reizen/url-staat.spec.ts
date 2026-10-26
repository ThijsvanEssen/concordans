// The address is the state (UX-review 26 Oct, N6, N7, N9): a link draws the same in every
// browser, whatever this one kept; a bron that did not come is never named by its key; what is
// switched off in the legend stays in the address; Verband says what it is doing and what it
// found.
import type { Page } from '@playwright/test';
import { CORS } from '../support/api';
import { expect, test } from '../support/test';
import { openSheet, closeSheet } from '../support/sheet';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162';
const KEPT = 'netwerk=instruments%2Fbwbr0005289&tussen=0';

const panel = (page: Page) => page.getByRole('region', { name: 'Netwerk' });
/** The text of the panel Netwerk, unfolded where a phone folds it. */
async function panelText(page: Page) {
	await openSheet(page);
	const fold = panel(page).getByRole('button', { name: /^Netwerk \d+ bron/ });
	if (await fold.isVisible()) await fold.click();
	return panel(page).innerText();
}
const strip = (page: Page) => page.getByRole('complementary', { name: 'Bronnen en filters' });
async function legend(page: Page) {
	await openSheet(page);
	const toggle = strip(page).getByRole('button', { name: 'Filter', exact: true });
	await expect(
		strip(page).getByRole('region', { name: 'Weergave en legenda' }).or(toggle).first()
	).toBeVisible();
	if (await toggle.isVisible()) await toggle.click();
	return strip(page).getByRole('region', { name: 'Filters' });
}

test('a clean link draws the same with and without a netwerk kept in this browser (N7)', async ({
	page
}) => {
	const link = `${ARTICLE}?mode=netwerk`;
	await page.goto(link);
	const nodes = page.locator('.canvas-node-list');
	await expect(nodes).toContainText('Art. 6:162 BW');
	const clean = { url: page.url(), nodes: await nodes.innerText(), panel: await panelText(page) };

	await page.evaluate((kept) => localStorage.setItem('concordans:netwerk', kept), KEPT);
	await page.goto(link);
	await expect(page.locator('.canvas-node-list')).toContainText('Art. 6:162 BW');
	expect(page.url()).toBe(clean.url);
	expect(await page.locator('.canvas-node-list').innerText()).toBe(clean.nodes);
	expect(await panelText(page)).toBe(clean.panel);
	// What was kept is still kept: it is the reader's, not this link's.
	expect(await page.evaluate(() => localStorage.getItem('concordans:netwerk'))).toBe(KEPT);
});

test('no chosen bron shows its key, after a 502 and Opnieuw either (N6)', async ({
	page,
	guard
}) => {
	guard.allow(/502|Failed to load resource/);
	let broken = true;
	await page.route(/\/api\/nodes\/instruments\/bwbr0005289/, (route) =>
		broken
			? route.fulfill({
					status: 502,
					headers: CORS,
					contentType: 'application/json',
					body: '{"detail":"bad gateway"}'
				})
			: route.fallback()
	);
	await page.goto('/explore?netwerk=instruments/bwbr0005289&tussen=0');
	await expect(page.getByText(/kon niet worden geladen/)).toBeVisible();
	const failed = await panelText(page);
	expect(failed).toContain('Bron laden');
	expect(failed).not.toMatch(/bwbr\d+/i);
	await closeSheet(page);

	broken = false;
	await page.getByRole('button', { name: 'Opnieuw' }).click();
	await expect(page.getByText(/kon niet worden geladen/)).toHaveCount(0);
	await expect(panel(page).getByText('Bron laden')).toHaveCount(0);
	expect(await panelText(page)).not.toMatch(/bwbr\d+/i);
	await expect(page.locator('.canvas-node-list')).not.toBeEmpty();
});

test('a relation switched off stays in the address and after a reload, with one bron (N7)', async ({
	page
}) => {
	await page.goto(`${ARTICLE}?mode=netwerk`);
	const noemt = (await legend(page)).getByRole('button', { name: /^Haalt aan/ });
	await expect(noemt).toHaveAttribute('aria-pressed', 'true');
	await noemt.click();
	await expect(page).toHaveURL(/[?&]uit=REFERS_TO/);
	await page.reload();
	await expect(page).toHaveURL(/[?&]uit=REFERS_TO/);
	await expect((await legend(page)).getByRole('button', { name: /^Haalt aan/ })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
});

test('Verband says it is looking, then that nothing joins the bronnen (N9)', async ({ page }) => {
	let answer!: () => void;
	const asked = new Promise<void>((done) => (answer = done));
	await page.route(/\/api\/nodes\/shared/, async (route) => {
		await asked;
		const ids = (new URL(route.request().url()).searchParams.get('ids') ?? '').split(',');
		await route.fulfill({
			headers: CORS,
			contentType: 'application/json',
			body: JSON.stringify({
				ids,
				total: 0,
				buckets: [],
				facets: { collections: [], tiers: [], areas: [] }
			})
		});
	});
	await page.goto(
		'/explore?netwerk=instruments/bwbr0005289,instruments/bwbr0005537&weergave=verband'
	);
	await expect(page.getByText('Verband zoeken', { exact: true })).toBeVisible();
	// Nothing to filter by yet: the legend holds no Tonen.
	await expect((await legend(page)).getByRole('heading', { name: 'Tonen' })).toHaveCount(0);
	answer();
	await expect(page.getByText('Geen verband gevonden binnen 2 stappen')).toBeVisible();
	await expect(page.getByText('Verband zoeken', { exact: true })).toHaveCount(0);
	await expect((await legend(page)).getByRole('heading', { name: 'Tonen' })).toHaveCount(0);
});
