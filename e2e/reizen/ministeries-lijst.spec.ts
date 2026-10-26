// The ministeries as a list under Regering: those that exist first, the abolished ones after
// them with their last year and their successor, each row leading to the ministry's page.
import { expect, test } from '../support/test';

test('/ministeries leads to the list, the current ministeries before the abolished ones', async ({
	page
}) => {
	await page.goto('/ministeries');
	await expect(page).toHaveURL(/kind=ministries/);
	const list = page
		.getByRole('list')
		.filter({ has: page.getByRole('link', { name: 'Algemene Zaken' }) });
	await expect(list.locator('a.row-title', { hasText: 'Justitie en Veiligheid' })).toBeVisible();
	await expect(page.getByText('Opgeheven ministeries')).toBeVisible();
	const rows = await list.getByRole('listitem').allTextContents();
	const current = rows.findIndex((t) => t.includes('Justitie en Veiligheid'));
	const abolished = rows.findIndex((t) => t.includes('Veiligheid en Justitie'));
	expect(current).toBeGreaterThanOrEqual(0);
	expect(abolished).toBeGreaterThan(current);
});

test('an abolished ministry names its last year and its successor', async ({ page }) => {
	await page.goto('/explore?mode=index&kind=ministries');
	const row = page.getByRole('listitem').filter({ hasText: 'Veiligheid en Justitie' }).first();
	await expect(row).toContainText('tot 2017');
	await expect(row.getByRole('link', { name: 'Justitie en Veiligheid' })).toHaveAttribute(
		'href',
		/\/ministeries\/jenv/
	);
});

test('a row leads to the page of the ministry', async ({ page }) => {
	await page.goto('/explore?mode=index&kind=ministries');
	await page.getByRole('link', { name: 'Justitie en Veiligheid', exact: true }).first().click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Ministerie van Justitie en Veiligheid'
	);
});
