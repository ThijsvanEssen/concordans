// The people and groups of the Kamers and the government: a lid, a fractie, a cabinet with
// its seats, and the seats of the Kamers in Bronnen › Fracties.
import type { Locator } from '@playwright/test';
import { expect, test } from '../support/test';

/** The seats in a figure of seats: each fractie names its own (`…, 26 zetels`). */
const seatsIn = (figure: Locator) =>
	figure
		.getByRole('link')
		.evaluateAll((links) => links.map((a) => a.getAttribute('aria-label') ?? a.textContent ?? ''))
		.then((names) =>
			names.map((n) => Number(/(\d+)\s+zetels?/.exec(n)?.[1] ?? 0)).reduce((a, b) => a + b, 0)
		);

test('a lid names the office, the fractie and the record', async ({ page }) => {
	await page.goto('/leden/rob-jetten');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rob Jetten');
	await expect(page.getByText(/Minister-president sinds/)).toBeVisible();
	await expect(
		page.getByRole('navigation', { name: 'Behoort bij' }).getByRole('link', { name: /^D66/ })
	).toHaveAttribute('href', /\/fracties\//);
	const career = page.getByRole('button', { name: 'Loopbaan' });
	await career.click();
	await expect(career).toHaveAttribute('aria-expanded', 'true');
});

test('a fractie gives its seats, its chair and its leden', async ({ page }) => {
	await page.goto('/fracties/d66');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('D66');
	await expect(page.getByText(/^26\s+zetels, fractie sinds/)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Jan Paternotte', exact: true })).toBeVisible();
	const leden = page.getByRole('button', { name: /^Leden( \d+)?$/ });
	await leden.click();
	await expect(leden).toHaveAttribute('aria-expanded', 'true');
});

test('a cabinet names its coalition and folds out its seats in the Tweede Kamer', async ({
	page
}) => {
	await page.goto('/kabinetten/rutte_iv');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('kabinet-Rutte IV');
	await expect(page.getByText('10 januari 2022 tot 2 juli 2024')).toBeVisible();
	for (const party of ['VVD', 'D66', 'CDA', 'ChristenUnie'])
		await expect(page.getByRole('link', { name: party, exact: true }).first()).toBeVisible();
	await page.getByRole('button', { name: 'Zetels in de Tweede Kamer' }).click();
	await expect(
		page.getByRole('group', { name: /^Zetels van de coalitie in de Tweede Kamer/ })
	).toBeVisible();
	await expect(page.getByText(/coalitiezetels, van 150/)).toBeVisible();
});

test('Bronnen › Fracties: the seats of each Kamer add up to the whole Kamer', async ({ page }) => {
	await page.goto('/explore?mode=index&kind=factions');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bronnen: Fracties');
	const tk = page.getByRole('figure', { name: 'Zetelverdeling Tweede Kamer' });
	await expect(tk).toBeVisible();
	expect(await seatsIn(tk)).toBe(150);

	await page
		.getByRole('group', { name: 'Kamer' })
		.getByRole('button', { name: 'Eerste Kamer' })
		.click();
	// The Eerste Kamer as it sits: a floor plan, the fracties facing each other.
	const ek = page.getByRole('figure', { name: 'Zetelverdeling Eerste Kamer' });
	await expect(ek).toBeVisible();
	expect(await seatsIn(ek)).toBe(75);
});
