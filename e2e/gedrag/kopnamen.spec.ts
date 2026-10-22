// A bron has one name in its heading and over its table of contents: the citation record's,
// never its id (T5 E6): `32016R0679` over the AVG, `STB_2018_101` over a publication.
import { expect, test } from '../support/test';

for (const pad of ['/wetten/32016R0679', '/stb/2026/94', '/wetten/BWBR0005289']) {
	test(`${pad}: the name over the contents is the heading`, async ({ page, touch }) => {
		test.skip(touch, 'a phone has its contents behind Inhoud');
		await page.goto(pad);
		const kop = (await page.getByRole('heading', { level: 1 }).first().textContent())!.trim();
		const naam = page.locator('.nav-kolom .titel');
		await expect(naam).toHaveText(kop);
		await expect(naam).not.toHaveText(/^[A-Z0-9_]+$/);
	});
}
