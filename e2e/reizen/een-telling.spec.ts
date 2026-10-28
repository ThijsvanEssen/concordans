// One count (UX-review N1, N2, N13, F5): the legend of the werkplek names the soorten of
// Verbonden with its words and its numbers, each drawn "of" its whole where fewer are drawn;
// a cluster's card says of how many too; the head of Verbonden counts once, when all is in.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';
import { naarVerbonden } from '../support/navigation';

const BRONNEN: [string, string][] = [
	['wet', '/wetten/BWBR0005416'],
	['artikel', '/wetten/BWBR0005289/artikel/6:162'],
	['uitspraak', '/uitspraken/ECLI:NL:HR:2009:BH2815'],
	['dossier', '/dossiers/36410'],
	['commissie', '/commissies/d38afba0_042f_4f3b_b0c8_b2df24eba6a7'],
	['ministerie', '/ministeries/bzk']
];

const strip = (page: Page) => page.getByRole('complementary', { name: 'Bronnen en filters' });

/** The legend, behind Filter on a narrow screen. */
async function legenda(page: Page): Promise<Locator> {
	await openSheet(page);
	const toggle = strip(page).getByRole('button', { name: 'Filter', exact: true });
	await expect(
		strip(page).getByRole('region', { name: 'Weergave' }).or(toggle).first()
	).toBeVisible({
		timeout: 30_000
	});
	if (await toggle.isVisible()) await toggle.click();
	return strip(page).getByRole('region', { name: 'Filters' });
}

/** The rows of Soort as label and count, once every count is in. */
async function soort(page: Page): Promise<[string, string][]> {
	const legend = await legenda(page);
	const block = legend
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Tonen' }) });
	await expect(block.getByRole('button').first()).toBeVisible();
	await expect(block.locator('[aria-label="wordt geteld"]')).toHaveCount(0, { timeout: 30_000 });
	// The soorten of the bron itself: those one step further stand under a heading of their own.
	return block.locator('button.optie, h4').evaluateAll((els) => {
		const verder = els.findIndex((e) => e.tagName === 'H4');
		return els.slice(0, verder < 0 ? undefined : verder).map((b) => [
			b.querySelector('.label')?.textContent?.trim() ?? '',
			// "67 van" in the option, the whole beside it a link to the list (A314).
			[b.querySelector('.aantal'), b.parentElement?.querySelector(':scope > .rij__alle')]
				.map((e) => e?.textContent?.trim())
				.filter(Boolean)
				.join(' ')
		]);
	});
}

/** The soorten of Verbonden beside the reader, as label and count, once the head counts. */
async function verbonden(page: Page): Promise<[string, string][]> {
	const panel = page.getByRole('complementary', { name: 'Verbonden' });
	await naarVerbonden(page);
	await expect(panel.locator('.head__count')).toHaveText(/verbinding/, { timeout: 30_000 });
	return panel
		.locator('.kind__head')
		.evaluateAll((hs) =>
			hs.map((h) => [
				h.children[0]?.textContent?.trim() ?? '',
				h.children[1]?.textContent?.trim() ?? ''
			])
		);
}

for (const [naam, pad] of BRONNEN) {
	test(`${naam}: Soort names the soorten of Verbonden with its numbers (N1)`, async ({ page }) => {
		await page.goto(pad);
		const panel = await verbonden(page);
		expect(panel.length, 'Verbonden has soorten').toBeGreaterThan(0);

		await page.goto(`${pad}?mode=netwerk`);
		const rijen = new Map(await soort(page));
		for (const [label, count] of panel) {
			const rij = rijen.get(label);
			expect(rij, `"${label}" in the legend`).toBeDefined();
			// Drawn of the whole, or the whole when all of it is drawn.
			expect(rij!.replace(/^[\d.]+ van /, ''), `"${label}": ${rij} against ${count}`).toBe(count);
		}
	});
}

test('a soort cut off says of how many, in the legend and on its cluster (N2)', async ({
	page,
	touch
}) => {
	await page.goto('/fracties/vvd?mode=netwerk');
	const rijen = new Map(await soort(page));
	expect(rijen.get('Stemmingen')).toMatch(/^[\d.]+ van [\d.]+$/);
	// A fractie's leden of every period, and the key to its marking (N13).
	expect(rijen.has('Leden ooit')).toBe(true);
	// The legend stands open: Filter on a phone opened it.
	const legend = strip(page).getByRole('region', { name: 'Filters' });
	await expect(legend.getByText('Huidig lid')).toBeVisible();
	await expect(legend.getByText('Oud-lid')).toBeVisible();
	test.skip(touch, 'a tap on the cluster: its card is the same at both widths');
	await page
		.getByRole('link', { name: /^\d+ stemmingen/ })
		.first()
		.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('dialog', { name: /^[\d.]+ van [\d.]+ stemmingen$/ })).toBeVisible();
});

// Thijs, 28 Oct: "net als in keten de Alle 10000 uitspraken niet als nodes tonen, maar als lijst".
test('the whole of a soort cut off is its list, in the row of its count (A314)', async ({
	page
}) => {
	await page.goto('/wetten/BWBR0005289/artikel/6:162?mode=netwerk');
	const rijen = new Map(await soort(page));
	expect(rijen.get('Uitspraken')).toMatch(/^[\d.]+ van [\d.]+$/);
	const legend = strip(page).getByRole('region', { name: 'Filters' });
	const alle = legend.getByRole('link', { name: /^Alle [\d.]+ uitspraken$/ });
	await expect(alle).toHaveText(/^[\d.]+$/);
	// No step under the row: the canvas keeps its cap.
	await expect(legend.getByRole('button', { name: /^Alle [\d.]+/ })).toHaveCount(0);
	await alle.click();
	await expect(page).toHaveURL(/tabel=1/);
	await expect(page).toHaveURL(/bronnen=uitspraken/);
	await expect(page).not.toHaveURL(/mode=/);
	await expect(page.getByRole('heading', { name: 'Verbindingen van Art. 6:162 BW' })).toBeVisible();
	await expect(page.getByRole('table').getByRole('row').nth(1)).toBeVisible();
});

test('the head of Verbonden counts once, when every group is in (F5)', async ({ page }) => {
	const counts: string[] = [];
	await page.exposeFunction('telling', (t: string) => counts.push(t));
	await page.addInitScript(() => {
		new MutationObserver(() => {
			const t = document.querySelector('.head__count')?.textContent ?? '';
			if (t) (window as unknown as { telling: (t: string) => void }).telling(t);
		}).observe(document, { subtree: true, childList: true, characterData: true });
	});
	await page.goto('/dossiers/36410');
	await verbonden(page);
	expect(new Set(counts).size, `the head said ${[...new Set(counts)].join(', ')}`).toBe(1);
});
