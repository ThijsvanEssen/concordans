// The offices (/ambten, B148): per ministry the offices held today, each with its holder; "Ook
// eerdere" adds those nobody holds today, in the address.
import { expect, test } from '../support/test';

test('/ambten lists the offices held today per ministry, and the former ones on request', async ({
	page
}) => {
	await page.goto('/ambten');
	await expect(page.getByRole('heading', { level: 2, name: 'Financiën' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Minister van Financiën' })).toHaveAttribute(
		'href',
		'/ambten/fin/minister'
	);
	const former = page.getByRole('link', { name: 'Staatssecretaris Toeslagen en Douane' });
	await expect(former).toHaveCount(0);
	await page.getByRole('button', { name: 'Ook eerdere' }).click();
	await expect(page).toHaveURL(/\?ambten=alle$/);
	await expect(former).toBeVisible();
});
