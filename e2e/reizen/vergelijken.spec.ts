// Old and new law side by side (O1): from an article of the current Wetboek van Strafvordering
// to its successor in the new one and back, along the transponeringstabel; and two versions
// of one article.
import { expect, test } from '../support/test';
import { patchApi } from '../support/api';
import { metOpvolging, opvolging } from '../support/opvolging';

test('126ffa Sv compares with 2.8.6 Sv (nieuw) along the transponeringstabel', async ({ page }) => {
	await page.goto('/wetten/BWBR0001903/artikel/126ffa');
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
	await page.goto('/wetten/STB-2026-56/artikel/2.8.6');
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
	await page.goto('/wetten/BWBR0001840/artikel/23');
	await page.getByRole('link', { name: 'Vergelijken', exact: true }).click();
	await expect(page).toHaveURL(/versies=/);
	await expect(page.getByRole('insertion').first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'In één tekst' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

// What became of an old article no new article takes the place of (lawgraph #860): said in
// the line where a successor would stand, a part of its own in the fold-out.
test('art. 10 Sv says it lapses in the new code, not where it went', async ({ page }) => {
	await patchApi(
		page,
		/^\/api\/nodes\/articles\/bwbr0001903_10\?/,
		metOpvolging(
			opvolging([
				{ from: '1', to: 'vervalllen', outcome: 'vervallen' },
				{ from: '2', to: 'vervallen', outcome: 'vervallen' }
			])
		)
	);
	await page.goto('/wetten/BWBR0001903/artikel/10');
	const line = page.locator('.succession');
	await expect(line).toContainText(/In het nieuwe recht:\s*vervallen bij Sv \(nieuw\)/);
	await expect(line).not.toContainText('overgebracht');
	// Each lid lapses: the line says it, there is nothing to fold out.
	await expect(line.getByRole('button', { name: /Leden/ })).toHaveCount(0);
	await expect(line.getByRole('link', { name: 'Sv (nieuw)' })).toHaveAttribute(
		'href',
		/\/wetten\/STB-2026-56/
	);
	await expect(line.getByRole('link', { name: /Transponeringstabel/ })).toHaveAttribute(
		'href',
		'https://zoek.officielebekendmakingen.nl/blg-1081574.html'
	);
});

test('art. 2 Sv folds out the lid that lapses beside its successor', async ({ page }) => {
	await patchApi(
		page,
		/^\/api\/nodes\/articles\/bwbr0001903_2\?/,
		metOpvolging(opvolging([{ from: '2', to: 'vervallen (mvt)', outcome: 'vervallen' }]))
	);
	await page.goto('/wetten/BWBR0001903/artikel/2');
	const line = page.locator('.succession');
	await expect(line).toContainText(/In het nieuwe recht:\s*art\. 1\.2\.9 Sv \(nieuw\)/);
	await expect(line).not.toContainText('vervallen bij');
	await line.getByRole('button', { name: /Leden/ }).click();
	const parts = page.locator('.succession__parts');
	await expect(parts.getByRole('term').filter({ hasText: /^lid 2$/ })).toBeVisible();
	await expect(parts.getByRole('definition').filter({ hasText: /^vervallen$/ })).toBeVisible();
});

// A part the source sends to another law it names, without an article (lawgraph #879): naar
// that law, a link where the API knows it by that name.
test('art. 10 Sv goes to the Gratiewet the table names', async ({ page }) => {
	await patchApi(
		page,
		/^\/api\/nodes\/articles\/bwbr0001903_10\?/,
		metOpvolging(
			opvolging([
				{ from: '1', to: 'later', outcome: 'naar:Gratiewet' },
				{ from: '2', to: 'later', outcome: 'naar:Gratiewet' }
			])
		)
	);
	await page.goto('/wetten/BWBR0001903/artikel/10');
	const line = page.locator('.succession');
	await expect(line).toContainText(/In het nieuwe recht:\s*naar Gratiewet/);
	await expect(line).not.toContainText('zonder opvolger');
	await expect(line.getByRole('link', { name: 'Gratiewet' })).toHaveAttribute(
		'href',
		/\/wetten\/BWBR0004257/
	);
});

test('art. 2 Sv folds out the lid that goes to the Wetboek van Strafrecht', async ({ page }) => {
	await patchApi(
		page,
		/^\/api\/nodes\/articles\/bwbr0001903_2\?/,
		metOpvolging(opvolging([{ from: '2', to: 'later', outcome: 'naar:Wetboek van Strafrecht' }]))
	);
	await page.goto('/wetten/BWBR0001903/artikel/2');
	const line = page.locator('.succession');
	await expect(line).toContainText(/In het nieuwe recht:\s*art\. 1\.2\.9 Sv \(nieuw\)/);
	await line.getByRole('button', { name: /Leden/ }).click();
	const parts = page.locator('.succession__parts');
	await expect(parts.getByRole('term').filter({ hasText: /^lid 2$/ })).toBeVisible();
	await expect(
		parts.getByRole('definition').filter({ hasText: /^naar Wetboek van Strafrecht$/ })
	).toBeVisible();
	await expect(parts.getByRole('link', { name: 'Wetboek van Strafrecht' })).toHaveAttribute(
		'href',
		/\/wetten\/BWBR0001854/
	);
});
