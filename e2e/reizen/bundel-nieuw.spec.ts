// What is new in a bundel per article (B162): the feed of the law (`instrument`) names the
// articles a version changes by their key (`commencement.article_keys`); the row of a changed
// article carries the mark with the change, an article the version leaves alone carries none.
import { expect, test } from '../support/test';

const LAW = '/wetten/BWBR0011982/artikel';
const BUNDEL = '/bundels/losse-markeringen';

test('a bundel marks per article what changed since the visit before', async ({ page }) => {
	// 78a changed with the version of 1 July 2025, article 2 did not.
	for (const nummer of ['2', '78a']) {
		await page.goto(`${LAW}/${nummer}`);
		await page.getByRole('button', { name: 'Bewaren', exact: true }).click();
		await expect(page.getByRole('button', { name: /^Bewaard/ })).toBeVisible();
	}
	// The visit before lies back, before that version.
	await page.evaluate(() => {
		const state = JSON.parse(localStorage.getItem('concordans:mappen') ?? '{}');
		for (const m of state.mappen) m.since = '2025-06-01';
		localStorage.setItem('concordans:mappen', JSON.stringify(state));
	});
	await page.goto(BUNDEL);
	await page.getByRole('button', { name: 'Alles uitklappen' }).click();

	const row = (nummer: string) =>
		page
			.locator('ul.rijen > li')
			.filter({ has: page.getByRole('link', { name: `art. ${nummer} Bp2000` }) });
	await expect(row('78a').getByRole('img', { name: 'nieuw' })).toBeVisible();
	await expect(row('78a').getByText('nieuw sinds 1 juni 2025')).toBeVisible();
	await expect(
		row('78a').getByRole('link', {
			name: 'Besluit personenvervoer 2000: gewijzigde tekst in werking'
		})
	).toBeVisible();
	await expect(row('2')).toBeVisible();
	await expect(row('2').getByRole('img', { name: 'nieuw' })).toHaveCount(0);
	await expect(row('2').getByText(/nieuw sinds/)).toHaveCount(0);
});
