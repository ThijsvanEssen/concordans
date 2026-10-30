// Bundels: Bewaar and its checks, a new bundel, the overview and the page of a bundel, two
// tabs writing at once, a shared link (#m=), the PDF, and words of a lid arceerd in the reader
// and seen again in the bundel.
import { expect, test } from '../support/test';
import {
	ARTICLE,
	catchClipboard,
	keepArticle,
	keepPlaces,
	letGo,
	selectWords
} from '../support/bundels';

test('Bewaar keeps in Mijn markeringen; the check in its list takes it out again', async ({
	page
}) => {
	await keepArticle(page);
	await page.getByRole('button', { name: 'Bewaar art. 6:162 BW in bundel' }).click();
	const menu = page.getByRole('menu', { name: 'Bewaar art. 6:162 BW in bundel' });
	const loose = menu.getByRole('menuitemcheckbox', { name: 'Mijn markeringen' });
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
	await expect(page.getByRole('button', { name: /^Bewaard/ })).toBeVisible();

	await page.goto('/bundels');
	await expect(page.getByRole('link', { name: 'Onrechtmatige daad' })).toBeVisible();
});

test('a lid is kept in a chosen bundel from its menu, with its anchor', async ({ page }) => {
	await page.goto(ARTICLE);
	await page.getByRole('button', { name: 'Bewaar art. 6:162 BW in bundel' }).click();
	await page.getByRole('menuitem', { name: 'Nieuwe bundel' }).click();
	const name = page.getByRole('textbox', { name: 'Naam van de nieuwe bundel' });
	await name.fill('Onrechtmatige daad');
	await name.press('Enter');

	await page.getByRole('button', { name: 'art. 6:162 lid 2 BW: citeren, bewaren' }).click();
	await page.getByRole('menuitem', { name: 'Bewaar in bundel…' }).click();
	await expect(page.getByRole('menuitemcheckbox').first()).toBeFocused();
	await page.getByRole('menuitemcheckbox', { name: 'Onrechtmatige daad' }).click();
	await expect(page.getByRole('menuitemcheckbox', { name: 'Onrechtmatige daad' })).toHaveAttribute(
		'aria-checked',
		'true'
	);

	await page.goto('/bundels');
	await page.getByRole('link', { name: 'Onrechtmatige daad' }).click();
	const lid = page.getByRole('link', { name: 'art. 6:162 lid 2 BW' });
	await expect(lid).toBeVisible();
	await expect(lid).toHaveAttribute('href', /#lid-2$/);
});

test('the overview opens a bundel in place; its page groups what it keeps', async ({ page }) => {
	await keepArticle(page);
	await keepPlaces(page);
	await page.goto('/bundels');
	await page.getByRole('link', { name: 'Mijn markeringen' }).click();
	await expect(page.getByRole('button', { name: 'Details van Mijn markeringen' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(page).toHaveURL(/\/bundels$/);
	await page.getByRole('link', { name: 'Open bundel' }).click();

	await expect(page).toHaveURL(/\/bundels\/losse-markeringen$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mijn markeringen');
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

test('the Inhoudsopgave of a bundel starts on its first group, as Bronnen’s', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a phone has no Inhoudsopgave');
	await keepArticle(page);
	await keepPlaces(page);
	await page.goto('/bundels/losse-markeringen');
	const eersteLink = page.getByRole('navigation', { name: 'Inhoud' }).getByRole('link').first();
	const eerste = page.getByRole('heading', { level: 3, name: 'Burgerlijk Wetboek Boek 6' });
	await expect(eersteLink).toBeVisible();
	await expect(eerste).toBeVisible();
	const lijn = (await eersteLink.boundingBox())!;
	const kop = (await eerste.boundingBox())!;
	expect(Math.abs(lijn.y + lijn.height / 2 - (kop.y + kop.height / 2))).toBeLessThan(8);
});

test('two tabs keep at the same time and each sees what the other kept', async ({ context }) => {
	const one = await context.newPage();
	const two = await context.newPage();
	await keepArticle(one);
	await two.goto('/bundels');
	await expect(two.getByRole('link', { name: 'Mijn markeringen' })).toBeVisible();

	await keepPlaces(two);
	await one.goto('/bundels/losse-markeringen');
	await expect(one.getByRole('link', { name: 'art. 6:162 BW', exact: true })).toBeVisible();
	await expect(one.getByRole('link', { name: 'art. 6:162 lid 2 BW' })).toBeVisible();
	await expect(
		one.getByRole('link', { name: /^HR 20 december 2019, .*r\.o\. 5\.3\.2$/ })
	).toBeVisible();

	// A note half typed in one tab stays whole while the other writes.
	const note = one.getByRole('textbox', { name: 'Aantekening bij Mijn markeringen' });
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
	await expect(fresh.getByText('Gedeelde bundel, via een link')).toBeVisible();
	await expect(fresh.getByRole('button', { name: 'Bewaar als kopie' })).toBeVisible();
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
	await page.getByRole('button', { name: 'Meer bij Mijn markeringen' }).click();
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

test('arceer words of a lid and see them again in the bundel', async ({ page, touch }) => {
	await page.goto(ARTICLE);
	await expect(page.getByText(/ongeschreven recht/)).toBeVisible();
	await selectWords(page, 'lid-2', 'ongeschreven recht', touch);
	// The menu of the place, by the words: Arceer keeps them, in Mijn markeringen.
	const menu = page.getByRole('menu', { name: 'art. 6:162 lid 2 BW, "ongeschreven recht"' });
	if (touch) {
		// While the finger is down nothing opens and nothing scrolls: iOS would drag the
		// selection on under it (A92). Once it lets go, the menu opens below the words.
		const top = await page.evaluate(() => scrollY);
		await page.waitForTimeout(1000);
		await expect(menu).toBeHidden();
		expect(await page.evaluate(() => scrollY)).toBe(top);
		await letGo(page);
	}
	await expect(menu).toBeVisible();
	await menu.getByRole('menuitem', { name: 'Arceer' }).click();
	await expect(menu).toBeHidden();
	const drawn = () =>
		page.evaluate(() =>
			[...((CSS.highlights.get('arcering') as unknown as Set<Range> | undefined) ?? [])].map((r) =>
				r.toString()
			)
		);
	await expect.poll(drawn).toEqual(['ongeschreven recht']);

	// A click (a tap) on the arcering opens its own menu.
	// On the first line the words stand on: they may wrap in a narrower column.
	const at = await page.evaluate(() => {
		const r = [...(CSS.highlights.get('arcering') as unknown as Set<Range>)][0].getClientRects()[0];
		return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
	});
	if (touch) await page.touchscreen.tap(at.x, at.y);
	else await page.mouse.click(at.x, at.y);
	await expect(page.getByRole('menuitem', { name: 'Arcering weg' })).toBeVisible();
	// Its note, written in the menu, stands under the lid at rest (O4 step 6).
	await page.getByRole('menuitem', { name: 'Aantekening', exact: true }).click();
	await page.getByRole('textbox', { name: /^Aantekening bij/ }).fill('Ook ongeschreven recht');
	await page.getByRole('button', { name: 'Bewaar aantekening' }).click();
	const note = page.locator('[data-plaats="lid-2"] .noot').getByRole('button', {
		name: 'Ook ongeschreven recht'
	});
	await expect(note).toBeVisible();
	// A click (a tap) on the note opens the menu of its arcering, where it is changed.
	if (touch) await note.tap();
	else await note.click();
	await expect(page.getByRole('menuitem', { name: 'Wijzig aantekening' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('menuitem', { name: 'Wijzig aantekening' })).toBeHidden();

	// In the bundel the opened row shows the arcering and its note under the lid (step 8).
	await page.goto('/bundels/losse-markeringen');
	await page.getByRole('link', { name: 'art. 6:162 lid 2 BW' }).click();
	await expect(page.getByText(/Als onrechtmatige daad worden aangemerkt/)).toBeVisible();
	await expect.poll(drawn).toEqual(['ongeschreven recht']);
	await expect(
		page.locator('[data-plaats="lid-2"] .noot').getByRole('button', {
			name: 'Ook ongeschreven recht'
		})
	).toBeVisible();
});
