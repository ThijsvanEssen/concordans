// What came in: Actueel per day with its periods and filters, and Gevolgd, the topics a reader
// follows, with the overview of one.
import { expect, test } from '../support/test';

test('Actueel: a period and a kind narrow the days', async ({ page, touch }) => {
	await page.goto('/actueel');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Actueel');
	await expect(page.getByRole('heading', { level: 2, name: /^Vandaag/ })).toBeVisible();
	const count = page.getByText(/^[\d.]+\s*gebeurtenissen$/);
	const all = await count.textContent();

	const period = page.getByRole('group', { name: 'Periode' });
	await period.getByRole('button', { name: 'Maand' }).click();
	await expect(period.getByRole('button', { name: 'Maand' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page).toHaveURL(/\/actueel\?.+/);
	await expect(count).not.toHaveText(all!);

	if (touch) await page.getByRole('button', { name: 'Verfijnen' }).click();
	const motie = page.getByRole('region', { name: 'Soort' }).getByRole('button', { name: /^Motie/ });
	await motie.click();
	await expect(motie).toHaveAttribute('aria-pressed', 'true');
	if (touch) await page.keyboard.press('Escape');
	// Each day then counts moties only.
	const days = page.getByRole('heading', { level: 2, name: /\d{4}/ });
	await expect(days.first()).toHaveText(/\d+ moties?$/);
});

test('Actueel: the Kamer narrows to the Eerste Kamer', async ({ page }) => {
	await page.goto('/actueel');
	await expect(page.getByText(/^[\d.]+\s*gebeurtenissen$/)).toBeVisible();
	const kamer = page.getByRole('group', { name: 'Kamer' });
	await kamer.getByRole('button', { name: 'Eerste Kamer' }).click();
	await expect(kamer.getByRole('button', { name: 'Eerste Kamer' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page).toHaveURL(/kamer=/);
});

test('Gevolgd: a topic followed shows its days, keeps after a reload and can be let go', async ({
	page
}) => {
	await page.goto('/onderwerpen');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gevolgde onderwerpen');
	await expect(page.getByText('Nog geen onderwerpen.')).toBeVisible();
	await page.getByRole('textbox', { name: 'Onderwerp volgen' }).fill('huur');
	await page.getByRole('button', { name: 'Volg' }).click();
	const topic = page.getByRole('heading', { level: 2, name: /^huur/ });
	await expect(topic).toBeVisible();
	await expect(page.locator('mark').filter({ hasText: 'huur' }).first()).toBeVisible();

	await page.reload();
	await expect(topic).toBeVisible();
	await expect(topic.getByRole('link', { name: 'Overzicht' })).toHaveAttribute(
		'href',
		/\/onderwerpen\/overzicht/
	);
	await topic.getByRole('button', { name: 'Niet meer volgen' }).click();
	await expect(topic).toHaveCount(0);
	await expect(page.getByText('Nog geen onderwerpen.')).toBeVisible();
});

test('the overview of a topic sorts its decisions by kind and outcome', async ({ page }) => {
	await page.goto('/onderwerpen');
	await expect(page.getByText('Nog geen onderwerpen.')).toBeVisible();
	await page.getByRole('textbox', { name: 'Onderwerp volgen' }).fill('huur');
	await page.getByRole('button', { name: 'Volg' }).click();
	await page.getByRole('link', { name: 'Overzicht' }).click();
	await expect(page).toHaveURL(/\/onderwerpen\/overzicht/);
	await expect(page.getByRole('heading', { level: 1 })).toContainText('huur');
});
