// The five soorten (A296): Tonen of the werkplek names the soorten as Verbonden does, in the
// order of the rubrieken of the Topbalk (Wetten, Rechtspraak, Kamerstukken, Parlement, Regering),
// and the filter says them the same way; no "Overige stukken", no "Leden en fracties".
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';

const SOORTEN = [
	'Wetten',
	'Artikelen',
	'Europees en internationaal',
	'Publicaties',
	'Uitspraken',
	'Dossiers',
	'Stukken',
	'Stemmingen',
	'Activiteiten',
	'Toezeggingen',
	'Kamerzaken',
	'Kamerleden',
	'Fracties',
	'Commissies',
	'Kabinetten',
	'Ministeries',
	'Bewindspersonen'
];
const VERBODEN = ['Overige stukken', 'Leden en fracties', 'Organen', 'Wetten en regelingen'];

const strip = (page: Page) => page.getByRole('complementary', { name: 'Bronnen en filters' });

/** The labels of the rows of Tonen, once the counts are in. */
async function tonen(page: Page): Promise<string[]> {
	await openSheet(page);
	const toggle = strip(page).getByRole('button', { name: 'Filter', exact: true });
	await expect(
		strip(page).getByRole('region', { name: 'Weergave' }).or(toggle).first()
	).toBeVisible({ timeout: 30_000 });
	if (await toggle.isVisible()) await toggle.click();
	const block = strip(page)
		.getByRole('region', { name: 'Filters' })
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Tonen' }) });
	await expect(block.getByRole('button').first()).toBeVisible();
	await expect(block.locator('[aria-label="wordt geteld"]')).toHaveCount(0, { timeout: 30_000 });
	return block.locator('button.optie, h4').evaluateAll((els) => {
		const verder = els.findIndex((e) => e.tagName === 'H4');
		return els
			.slice(0, verder < 0 ? undefined : verder)
			.map((b) => b.querySelector('.label')?.textContent?.trim() ?? '');
	});
}

for (const [naam, pad] of [
	['dossier', '/dossiers/36410'],
	['artikel', '/wetten/BWBR0005289/artikel/6:162'],
	['ministerie', '/ministeries/bzk']
] as const)
	test(`${naam}: Tonen names the soorten, in the order of the rubrieken`, async ({ page }) => {
		await page.goto(`${pad}?mode=netwerk`);
		const rijen = await tonen(page);
		expect(rijen.length).toBeGreaterThan(0);
		for (const rij of rijen) expect(VERBODEN, rij).not.toContain(rij);
		const soorten = rijen.filter((r) => SOORTEN.includes(r));
		const plaats = soorten.map((r) => SOORTEN.indexOf(r));
		// The soorten of the bron's own rubriek come first; the others follow in the order of the Topbalk.
		const eigen = plaats.findIndex((p, i) => i > 0 && p < plaats[i - 1]);
		const rest = eigen < 0 ? plaats : plaats.slice(eigen);
		expect(rest, `${soorten.join(', ')}`).toEqual([...rest].sort((a, b) => a - b));
	});
