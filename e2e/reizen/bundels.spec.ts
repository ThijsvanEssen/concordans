// Bundels: Bewaar and its checks, a new bundel, the overview and the page of a bundel, two
// tabs writing at once, a shared link (#m=) and the PDF.
import { expect, test } from '../support/test';
import { ARTICLE, catchClipboard, keepArticle, keepPlaces } from '../support/bundels';

test('Bewaar keeps in Losse markeringen; the check in its list takes it out again', async ({
	page
}) => {
	await keepArticle(page);
	await page.getByRole('button', { name: 'Bewaar art. 6:162 BW in bundel' }).click();
	const menu = page.getByRole('menu', { name: 'Bewaar art. 6:162 BW in bundel' });
	const loose = menu.getByRole('menuitemcheckbox', { name: 'Losse markeringen' });
	await expect(loose).toHaveAttribute('aria-checked', 'true');
	await loose.click();
	await expect(page.getByRole('button', { name: 'Bewaar', exact: true })).toBeVisible();
});

test('a new bundel is named in the menu and keeps the bron at once', async ({ page }) => {
	await page.goto(ARTICLE);
	await page.getByRole('button', { name: 'Bewaar art. 6:162 BW in bundel' }).click();
	await page.getByRole('menuitem', { name: 'Nieuwe bundel' }).click();
	const name = page.getByRole('textbox', { name: 'Naam van de nieuwe bundel' });
	await expect(name).toBeFocused();
	await name.fill('Onrechtmatige daad');
	await name.press('Enter');
	await expect(page.getByRole('button', { name: 'Bewaard', exact: true })).toBeVisible();

	await page.goto('/bundels');
	await expect(page.getByRole('link', { name: 'Onrechtmatige daad' })).toBeVisible();
});

test('the overview opens a bundel in place; its page groups what it keeps', async ({ page }) => {
	await keepArticle(page);
	await keepPlaces(page);
	await page.goto('/bundels');
	// Known (A56): in the first second after a load, a click on a title can go to the page
	// of the bundel instead of opening its row (3 in 10 runs); the list is read anew then.
	await page.waitForTimeout(1000);
	await page.getByRole('link', { name: 'Losse markeringen' }).click();
	await expect(page.getByRole('button', { name: 'Details van Losse markeringen' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(page).toHaveURL(/\/bundels$/);
	await page.getByRole('link', { name: 'Open bundel' }).click();

	await expect(page).toHaveURL(/\/bundels\/losse-markeringen$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Losse markeringen');
	await expect(
		page.getByRole('heading', { level: 3, name: 'Burgerlijk Wetboek Boek 6' })
	).toBeVisible();
	await expect(page.getByRole('heading', { level: 3, name: 'Rechtspraak' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'art. 6:162 lid 2 BW' })).toBeVisible();
	await expect(
		page.getByRole('link', { name: /^HR 20 december 2019, .*r\.o\. 5\.3\.2$/ })
	).toHaveAttribute('href', /#rov-5\.3\.2$/);

	// A click on the title opens the row in place; the bron itself is one step further.
	await page.getByRole('link', { name: 'art. 6:162 lid 2 BW' }).click();
	await expect(
		page.getByRole('button', { name: 'Details van art. 6:162 lid 2 BW' })
	).toHaveAttribute('aria-expanded', 'true');
	await expect(page).toHaveURL(/\/bundels\/losse-markeringen$/);
	await expect(page.getByText(/Als onrechtmatige daad worden aangemerkt/)).toBeVisible();

	await page.getByRole('button', { name: 'Alles uitklappen' }).click();
	await expect(
		page.getByRole('button', { name: /^Details van HR 20 december 2019, .*r\.o\. 5\.3\.2$/ })
	).toHaveAttribute('aria-expanded', 'true');
});

test('two tabs keep at the same time and each sees what the other kept', async ({ context }) => {
	const one = await context.newPage();
	const two = await context.newPage();
	await keepArticle(one);
	await two.goto('/bundels');
	await expect(two.getByRole('link', { name: 'Losse markeringen' })).toBeVisible();

	await keepPlaces(two);
	await one.goto('/bundels/losse-markeringen');
	await expect(one.getByRole('link', { name: 'art. 6:162 BW', exact: true })).toBeVisible();
	await expect(one.getByRole('link', { name: 'art. 6:162 lid 2 BW' })).toBeVisible();
	await expect(
		one.getByRole('link', { name: /^HR 20 december 2019, .*r\.o\. 5\.3\.2$/ })
	).toBeVisible();

	// A note half typed in one tab stays whole while the other writes.
	const note = one.getByRole('textbox', { name: 'Aantekening bij Losse markeringen' });
	await note.fill('Onderzoeksvraag: aansprakelijkheid');
	await two.goto(ARTICLE);
	await two.getByRole('button', { name: 'Bewaar art. 6:162 BW in bundel' }).click();
	await two.getByRole('menuitem', { name: 'Nieuwe bundel' }).click();
	await two.getByRole('textbox', { name: 'Naam van de nieuwe bundel' }).fill('Tweede');
	await two.keyboard.press('Enter');
	await expect(note).toHaveValue('Onderzoeksvraag: aansprakelijkheid');
});

test('a shared link opens the bundel in a browser that has none', async ({ context, browser }) => {
	const copied = await catchClipboard(context);
	const page = await context.newPage();
	await keepArticle(page);
	await keepPlaces(page);
	await page.goto('/bundels/losse-markeringen');
	await page.getByRole('button', { name: 'Kopieer link' }).click();
	const link = await copied(page);
	expect(link).toMatch(/\/bundels#m=/);

	const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
	const { serveApi } = await import('../support/api');
	await serveApi(other, []);
	const fresh = await other.newPage();
	await fresh.goto(new URL(link!).pathname + new URL(link!).hash);
	await expect(fresh.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(fresh.getByRole('link', { name: 'art. 6:162 lid 2 BW' })).toBeVisible();
	await expect(
		fresh.getByRole('link', { name: /^HR 20 december 2019, .*r\.o\. 5\.3\.2$/ })
	).toBeVisible();
	await other.close();
});

test('Meer › PDF opens the print dialog', async ({ page }) => {
	await keepArticle(page);
	await keepPlaces(page);
	await page.goto('/bundels/losse-markeringen');
	await page.evaluate(() => {
		window.print = () => void ((window as unknown as { printed: boolean }).printed = true);
	});
	await page.getByRole('button', { name: 'Meer bij Losse markeringen' }).click();
	await page.getByRole('menuitem', { name: 'PDF' }).click();
	expect(await page.evaluate(() => (window as unknown as { printed?: boolean }).printed)).toBe(
		true
	);
});

test('an article kept keeps the day of its text; a judgment keeps none', async ({ page }) => {
	await keepArticle(page);
	await keepPlaces(page);
	const items = await page.evaluate(() => {
		const stand = JSON.parse(localStorage.getItem('concordans:mappen') ?? '{}') as {
			mappen?: { items?: { kort?: string; versie?: string }[] }[];
		};
		return (stand.mappen ?? []).flatMap((m) => m.items ?? []);
	});
	const versie = (kort: string | RegExp) =>
		items.find((i) => (typeof kort === 'string' ? i.kort === kort : kort.test(i.kort ?? '')))
			?.versie;
	// Geldend recht, tekst sinds 1 januari 1992 (gedrag/transparantie.spec.ts).
	expect(versie('art. 6:162 BW')).toBe('1992-01-01');
	expect(versie('art. 6:162 lid 2 BW')).toBe('1992-01-01');
	expect(versie(/^HR 20 december 2019/)).toBeUndefined();
});
