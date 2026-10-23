// A ministry as a page of its own: its name and period, the name it followed, its
// bewindspersonen per cabinet (the newest first) and, in Verbonden, what is its own.
import { naarVerbonden } from '../support/navigation';
import { expect, test } from '../support/test';

test('a ministry names its period, its predecessor and its bewindspersonen per cabinet', async ({
	page
}) => {
	await page.goto('/ministeries/jenv');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Ministerie van Justitie en Veiligheid'
	);
	await expect(page.getByText('sinds 26 oktober 2017')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Veiligheid en Justitie' })).toHaveAttribute(
		'href',
		/\/ministeries\/venj/
	);
	const kabinetten = page.getByRole('heading', { level: 4 });
	await expect(kabinetten).toHaveText(['kabinet-Schoof', 'kabinet-Rutte IV']);
	await expect(page.getByRole('link', { name: 'F.M. Weerwind' })).toBeVisible();
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
	for (const soort of ['Wetten', 'Lopende dossiers', 'Open toezeggingen'])
		await expect(verbonden.getByRole('heading', { name: soort })).toBeVisible();
});

test('a dossier and a toezegging name their ministry as a link to its page', async ({ page }) => {
	// A wet joins them once the BWB's ministries are in the data (`normalize bwb`, 0.80.8).
	for (const pad of ['/dossiers/36496', '/toezeggingen/TZ202603-117']) {
		await page.goto(pad);
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
		await expect(page.locator('a[href^="/ministeries/"]').first(), pad).toBeVisible();
	}
});
