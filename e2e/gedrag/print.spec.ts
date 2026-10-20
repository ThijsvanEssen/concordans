// The print view of a bundel (its PDF): the bundel alone, its rows as opened, without the
// bar, the controls or the links back to the reader. Meer › PDF itself is in
// reizen/bundels.spec.ts. The readers have no print view of their own.
import { keepArticle, keepPlaces } from '../support/bundels';
import { expect, test } from '../support/test';

test('a printed bundel is its title, its groups and the text of its rows', async ({
	page,
	touch
}) => {
	test.skip(touch, 'print is the same at every width');
	await keepArticle(page);
	await keepPlaces(page);
	await page.goto('/bundels/losse-markeringen');
	await page.getByRole('button', { name: 'Alles uitklappen' }).click();
	await expect(page.getByText(/Als onrechtmatige daad worden aangemerkt/).first()).toBeVisible();

	await page.emulateMedia({ media: 'print' });
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Losse markeringen');
	await expect(page.getByRole('heading', { level: 3, name: 'Rechtspraak' })).toBeVisible();
	await expect(page.getByText(/Als onrechtmatige daad worden aangemerkt/).first()).toBeVisible();
	await expect(page.getByRole('banner')).toBeHidden();
	for (const control of ['Kopieer link', 'Alles inklappen', 'Andere bron toevoegen'])
		await expect(page.getByRole('button', { name: control })).toBeHidden();
	await expect(
		page.getByRole('link', { name: 'In de lezer' }).filter({ visible: true })
	).toHaveCount(0);

	const pdf = await page.pdf({ format: 'A4' });
	expect(pdf.byteLength).toBeGreaterThan(5_000);
});
