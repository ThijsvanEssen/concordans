// A bron has one name in its heading and over its table of contents: the citation record's,
// never its id (T5 E6): `32016R0679` over the AVG. The contents name the law only where the
// name leads to the whole law, from one of its articles (A173).
import { expect, test } from '../support/test';

for (const [wet, artikel] of [
	['/wetten/32016R0679', '/wetten/32016R0679/artikel/6'],
	['/wetten/BWBR0005289', '/wetten/BWBR0005289/artikel/6:162']
]) {
	test(`${wet}: from an article the name over the contents is the heading of the law`, async ({
		page,
		touch
	}) => {
		test.skip(touch, 'a phone has its contents behind Inhoud');
		await page.goto(wet);
		const kop = (await page.getByRole('heading', { level: 1 }).first().textContent())!.trim();
		await expect(page.locator('.nav-kolom .titel')).toHaveCount(0);
		await page.goto(artikel);
		const naam = page.locator('.nav-kolom .titel');
		await expect(naam).toHaveText(kop);
		await expect(naam).not.toHaveText(/^[A-Z0-9_]+$/);
	});
}
