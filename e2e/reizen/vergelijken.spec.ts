// Old and new law side by side (O1): from an article of the current Wetboek van Strafvordering
// to its successor in the new one and back, along the transponeringstabel; and two versions
// of one article.
import { expect, test } from '../support/test';

test('126ffa Sv compares with 2.8.6 Sv (nieuw) along the transponeringstabel', async ({ page }) => {
	await page.goto('/wetten/BWBR0001903/artikel/126ffa?lezen=1');
	await expect(page.getByText('In het nieuwe recht:')).toBeVisible();
	await expect(page.getByRole('link', { name: 'art. 2.8.6 Sv (nieuw)' })).toHaveAttribute(
		'href',
		/\/wetten\/STB-2026-56\/artikel\/2\.8\.6/
	);
	const scroll = await page.evaluate(() => scrollY);
	await page.getByRole('link', { name: 'Vergelijk', exact: true }).click();
	await expect(page).toHaveURL(/vergelijk=articles\/stb_2026_56_2_8_6/);
	const compare = page.getByRole('region', { name: 'Oud en nieuw vergelijken' });
	await expect(compare).toBeVisible();
	expect(await page.evaluate(() => scrollY)).toBe(scroll);
	await expect(compare.getByRole('definition').first()).toContainText('Art. 126ffa Sv');
	await expect(
		compare.getByRole('link', { name: 'volgens de transponeringstabel' }).first()
	).toBeVisible();
	await expect(compare).toContainText('was leden 1, 2 en 3');
	await expect(compare.getByRole('insertion').first()).toBeVisible();
	await expect(compare.getByRole('deletion').first()).toBeVisible();

	await compare
		.getByRole('group', { name: 'Weergave' })
		.getByRole('button', { name: 'Naast elkaar' })
		.click();
	await expect(
		compare.getByRole('group', { name: 'Weergave' }).getByRole('button', { name: 'Naast elkaar' })
	).toHaveAttribute('aria-pressed', 'true');
});

test('2.8.6 Sv (nieuw) compares back with what it replaces', async ({ page }) => {
	await page.goto('/wetten/STB-2026-56/artikel/2.8.6?lezen=1');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('2.8.6');
	await page.getByRole('link', { name: 'Vergelijk', exact: true }).first().click();
	const compare = page.getByRole('region', { name: 'Oud en nieuw vergelijken' });
	await expect(compare).toBeVisible();
	await expect(compare).toContainText('126ffa');
	await expect(
		compare.getByRole('link', { name: 'volgens de transponeringstabel' }).first()
	).toBeVisible();
});

test('two versions of an article compare in one text', async ({ page }) => {
	await page.goto('/wetten/BWBR0001840/artikel/23?lezen=1');
	await page.getByRole('link', { name: 'Vergelijken', exact: true }).click();
	await expect(page).toHaveURL(/versies=/);
	await expect(page.getByRole('insertion').first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'In één tekst' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});
