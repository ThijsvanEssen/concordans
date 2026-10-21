// The parliamentary record: a dossier with its stand and procedure, a stuk opened in place, a
// Kamerstuk with its indiener and its vote at rest, a vote with its outcome per fractie, a
// passed bill with its law, and a memorie van toelichting beside the article it explains.
import { expect, test } from '../support/test';

test('a dossier shows where it stands and opens a stuk of its procedure in place', async ({
	page
}) => {
	await page.goto('/dossiers/36496');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wet betaalbare huur');
	await expect(page.getByRole('region', { name: 'Stand van zaken' })).toContainText(
		'Aangenomen door de Eerste Kamer'
	);
	await page.getByRole('button', { name: 'Procedure' }).click();
	// One click on the line opens the stuk in place; its source is one step further.
	await page.getByRole('link', { name: 'Advies en nader rapport', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Inhoud van Advies en nader rapport' })
	).toHaveAttribute('aria-expanded', 'true');
	await expect(page).toHaveURL(/\/dossiers\/36496$/);

	await page.getByRole('button', { name: /^Amendementen( \d+)?$/ }).click();
	await expect(page.getByRole('button', { name: /^Amendementen( \d+)?$/ })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
});

test('a Kamerstuk names its indiener and its dossier, and folds out its vote', async ({ page }) => {
	await page.goto('/kamerstukken/36799/31?lezen=1');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Motie van het lid De Beer');
	await expect(page.getByText('Kamerstukken II 2025/26, 36799, nr. 31.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'M.E.E. de Beer' })).toBeVisible();
	await expect(
		page.getByRole('navigation', { name: 'Behoort bij' }).getByRole('link', { name: /36799/ })
	).toHaveAttribute('href', /\/dossiers\/36799/);
	const vote = page.getByRole('button', { name: 'Stemming', exact: true });
	await vote.click();
	await expect(vote).toHaveAttribute('aria-expanded', 'true');
	// The vote the head already says is not said again: the section has the earlier one.
	const sectie = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Stemming', exact: true }) });
	await expect(sectie).toContainText('Uitstellen op 22 september 2026');
	await expect(sectie).not.toContainText('Aangenomen');
});

test('a motie says at rest how the Kamer voted on it, and which fracties', async ({ page }) => {
	await page.goto('/kamerstukken/36799/31?lezen=1');
	await expect(page.getByText('Aangenomen op 29 september 2026, 120 voor, 30 tegen')).toBeVisible();
	await expect(page.getByText(/^D66, VVD, PVV/)).toBeVisible();
	await expect(page.getByText('PRO, Groep Markuszower, PvdD')).toBeVisible();
	// The stemming itself is one step further, by its day.
	await expect(page.getByRole('link', { name: '29 september 2026' })).toHaveAttribute(
		'href',
		/\/stemmingen\/decision_1b1d379a_01c9_495c_a25e_108e9b87ab2e/
	);
});

test('a passed bill names the law it made and the day it came into force', async ({ page }) => {
	await page.goto('/dossiers/36496');
	await expect(
		page.getByText('Vastgesteld als Wet betaalbare huur; in werking getreden op 1 juli 2024.')
	).toBeVisible();
	await expect(
		page.getByRole('link', { name: 'Wet betaalbare huur', exact: true }).first()
	).toHaveAttribute('href', /\/wetten\/BWBR0049889/);
});

test('a vote gives its outcome and the vote of each fractie', async ({ page }) => {
	await page.goto('/stemmingen/decision_154df5db_64e5_414a_9cd1_3967aab7de58');
	await expect(page.getByRole('heading', { level: 1 })).toContainText(
		'Motie van het lid Van Oosterhout'
	);
	await expect(page.getByText('Aangenomen, Motie')).toBeVisible();
	await expect(page.getByText('105 voor, 45 tegen')).toBeVisible();
	await page.getByRole('button', { name: 'Stemverdeling per fractie' }).click();
	const fracties = page
		.getByRole('listitem')
		.filter({ has: page.getByRole('link', { name: 'D66', exact: true }) });
	await expect(fracties.first()).toContainText(/Voor.*coalitie.*26/);
	await expect(
		page
			.getByRole('listitem')
			.filter({ has: page.getByRole('link', { name: 'PVV', exact: true }) })
			.first()
	).toContainText(/Tegen/);
});

test('a memorie van toelichting opens beside its article and closes again', async ({ page }) => {
	await page.goto('/wetten/BWBR0001840/artikel/23?lezen=1');
	await page.getByRole('link', { name: 'Memorie van toelichting', exact: true }).first().click();
	await expect(page).toHaveURL(/naast=documents\//);
	await expect(page.getByText('Kamerstukken II 2016/17, 34702, nr. 3.')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1, name: 'Artikel 23' })).toBeAttached();
	await page.getByRole('link', { name: 'Sluiten' }).click();
	await expect(page).not.toHaveURL(/naast=/);
	await expect(page.getByText('Kamerstukken II 2016/17, 34702, nr. 3.')).toHaveCount(0);
});
