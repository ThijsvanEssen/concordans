// The first Bewaar of a session says that what is kept stays in this browser, and how to keep
// it elsewhere (F17): a notice that stays until closed, once per session, focus on Bewaar.
import { expect, test } from '../support/test';
import { ARTICLE } from '../support/bundels';

test.use({ eersteBewaar: true });

test('the first Bewaar gives a notice that stays; Escape closes it; the second Bewaar does not', async ({
	page
}) => {
	await page.goto(ARTICLE);
	const bewaar = page.getByRole('button', { name: 'Bewaar', exact: true });
	await bewaar.click();

	const melding = page.getByRole('status').filter({ hasText: 'Dit staat alleen in deze browser' });
	await expect(melding).toContainText('Bewaard in Mijn markeringen');
	await expect(melding.getByRole('button', { name: 'Exporteer' })).toBeVisible();
	await expect(melding.getByRole('link', { name: 'Mijn markeringen' })).toHaveAttribute(
		'href',
		'/bundels/losse-markeringen'
	);
	// No seconds run out on it, and the focus stays on the button that acted.
	await page.waitForTimeout(3000);
	await expect(melding).toBeVisible();
	await expect(page.getByRole('button', { name: /^Bewaard/ })).toBeFocused();

	await page.keyboard.press('Escape');
	await expect(melding).toHaveCount(0);

	// Once per session: the next Bewaar gives the line of a few seconds.
	await page.getByRole('button', { name: 'art. 6:162 lid 2 BW: citeren, bewaren' }).click();
	await page.getByRole('menuitem', { name: 'Bewaar in Mijn markeringen' }).click();
	await expect(page.getByRole('status')).toContainText('Bewaard in Mijn markeringen');
	await expect(page.getByText('Dit staat alleen in deze browser')).toHaveCount(0);
});

test('Exporteer saves the bundels as a file and ends the notice', async ({ page }) => {
	await page.goto(ARTICLE);
	await page.getByRole('button', { name: 'Bewaar', exact: true }).click();
	const melding = page.getByRole('status').filter({ hasText: 'Dit staat alleen in deze browser' });
	const download = page.waitForEvent('download');
	await melding.getByRole('button', { name: 'Exporteer' }).click();
	expect((await download).suggestedFilename()).toMatch(/\.json$/);
	await expect(melding).toHaveCount(0);
});

test('an empty Bundels says what a bundel is; an empty Gevolgd fills the field from an example', async ({
	page
}) => {
	await page.goto('/bundels');
	await expect(page.getByText('Een bundel is een eigen verzameling')).toBeVisible();
	await expect(page.getByText('In deze browser, zonder account.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Zoek een bron' })).toBeVisible();

	await page.goto('/onderwerpen');
	await expect(page.getByText('gaan als zoekterm naar de server')).toBeVisible();
	await page.getByRole('button', { name: 'Stikstof' }).click();
	await expect(page.getByRole('textbox', { name: 'Onderwerp volgen' })).toHaveValue('Stikstof');
	// It fills the field; following is the reader's own Volg.
	await expect(page.getByRole('heading', { level: 2, name: 'Stikstof' })).toHaveCount(0);
});
