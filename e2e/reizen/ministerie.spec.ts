// A ministry as a page of its own: its name and period, the name it followed, its offices
// (held today, then Eerder; B148) and, in Verbonden, what is its own.
import { naarVerbonden } from '../support/navigation';
import { expect, test } from '../support/test';

test('a ministry names its period, its predecessor and its offices, each to its page', async ({
	page
}) => {
	await page.goto('/ministeries/jenv');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Ministerie van Justitie en Veiligheid'
	);
	await expect(page.getByText('sinds 1 januari 2018')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Veiligheid en Justitie' })).toHaveAttribute(
		'href',
		/\/ministeries\/venj/
	);
	await expect(page.getByRole('heading', { name: /^Ambten/ })).toBeVisible();
	await expect(
		page.getByRole('link', { name: 'Minister van Justitie en Veiligheid' })
	).toHaveAttribute('href', '/ambten/jenv/minister');
	await expect(page.getByRole('heading', { level: 4, name: 'Eerder' })).toBeVisible();
});

test('an office leads back to its ministry, large to small', async ({ page }) => {
	await page.goto('/ambten/jenv/minister');
	const crumb = page.getByRole('navigation', { name: 'Hoort bij' });
	await expect(crumb.getByRole('link', { name: 'Ambten' })).toHaveAttribute('href', '/ambten');
	await expect(
		crumb.getByRole('link', { name: 'Ministerie van Justitie en Veiligheid' })
	).toHaveAttribute('href', /\/ministeries\/jenv/);
});

test('what is its own stands in Verbonden: laws, open dossiers and open toezeggingen', async ({
	page
}) => {
	await page.goto('/ministeries/jenv');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.waitForLoadState('networkidle');
	const verbonden = page.getByRole('complementary', { name: 'Verbonden' });
	await naarVerbonden(page);
	await verbonden.scrollIntoViewIfNeeded();
	for (const soort of ['Wetten', 'Openstaande dossiers', 'Open toezeggingen'])
		await expect(verbonden.getByRole('heading', { name: soort })).toBeVisible();
});

test('a wet, a dossier and a toezegging name their ministry as a link to its page', async ({
	page
}) => {
	for (const pad of ['/wetten/BWBR0044977', '/dossiers/36496', '/toezeggingen/TZ202603-117']) {
		await page.goto(pad);
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
		await expect(page.locator('a[href^="/ministeries/"]').first(), pad).toBeVisible();
	}
});
