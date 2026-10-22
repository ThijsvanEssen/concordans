// From the list of laws to a law, an article, its leden and versions: Bronnen › Wetten with
// its filters, the text of a law with its overview and a date, an article with its leden,
// its neighbours and its earlier texts, and what is based on the law (delegations).
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { bijlagenGelezen } from '../support/bijlagen';
import { patchApi } from '../support/api';
import { eigenVoetnoten, metVoetnoten } from '../support/voetnoten';

test('Bronnen › Wetten: a filter narrows the list, a search finds a law that opens', async ({
	page,
	touch
}) => {
	await page.goto('/explore?mode=index');
	await page.getByRole('link', { name: /^Wetten [\d.]+$/ }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bronnen: Wetten');
	const count = page.getByText(/^[\d.]+\s*wetten$/);
	await expect(count).toBeVisible();
	const before = await count.textContent();

	// On a phone the filters fold under Verfijnen.
	if (touch) await page.getByRole('button', { name: 'Verfijnen' }).click();
	const filter = page.getByRole('region', { name: 'Rechtsgebied' }).getByRole('button').first();
	await filter.click();
	await expect(filter).toHaveAttribute('aria-pressed', 'true');
	await expect(page).toHaveURL(/kind=instruments.*&/);
	await expect(count).not.toHaveText(before!);
	// Toon closes the filters on a phone and brings the list into view (besluit 30, X4).
	if (touch) {
		await page.getByRole('button', { name: /^Toon [\d.]+ wetten$/ }).click();
		await expect(page.getByRole('button', { name: /^Verfijnen/ })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
		await expect(count).toBeInViewport();
	}

	await page.goto('/explore?mode=index&kind=instruments');
	await page.getByRole('searchbox', { name: 'Zoek in wetten' }).fill('Burgerlijk Wetboek Boek 6');
	await page.getByRole('link', { name: 'Burgerlijk Wetboek Boek 6', exact: true }).click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Burgerlijk Wetboek Boek 6');
});

test('a law reads whole, with its overview, a date to read it on and what is based on it', async ({
	page,
	touch
}) => {
	await page.goto('/wetten/BWBR0005289');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Burgerlijk Wetboek Boek 6');
	await expect(
		page.getByRole('heading', { level: 2, name: 'Titel 1 Verbintenissen in het algemeen' })
	).toBeVisible();

	const date = page.getByRole('button', { name: /^Tekst geldend op/ });
	await date.click();
	const versions = page.getByRole('menu', { name: 'Tekst geldend op' });
	await expect(versions.getByRole('menuitemradio', { checked: true })).toContainText('vandaag');
	await versions.getByRole('menuitemradio', { name: '1 januari 2024' }).click();
	await expect(date).toHaveText('1 januari 2024');
	await expect(page).toHaveURL(/peildatum=2024-01-01/);

	if (touch) return;
	await expect(
		page.getByRole('complementary', { name: 'Verbonden' }).getByRole('heading', {
			name: 'Gebaseerd op deze wet'
		})
	).toBeVisible();
});

test('an article: its leden, the law above it and the next article', async ({ page }) => {
	await page.goto('/wetten/BWBR0005289/artikel/6:162');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162');
	await expect(page.getByText('Geldend recht, tekst sinds 1 januari 1992')).toBeVisible();
	for (const lid of [1, 2, 3])
		await expect(
			page.getByRole('button', { name: `art. 6:162 lid ${lid} BW: citeren, bewaren` })
		).toBeVisible();
	await expect(
		page.getByRole('navigation', { name: 'Behoort bij' }).getByRole('link', {
			name: /Boek 6/
		})
	).toHaveAttribute('href', /\/wetten\/BWBR0005289/);

	await page.getByRole('link', { name: 'Volgend artikel →' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:163');
	await expect(page).toHaveURL(/\/artikel\/6:163/);
});

test('an earlier text of an article says so, and leads back to the law in force', async ({
	page
}) => {
	await page.goto('/wetten/BWBR0001840/artikel/23');
	await page.getByRole('button', { name: '3 tekstversies' }).click();
	const versions = page.getByRole('menu', { name: 'Tekstversies' });
	await expect(versions.getByRole('menuitemradio', { checked: true })).toHaveText(
		/Geldend, sinds 17 november 2017/
	);
	await versions.getByRole('menuitemradio', { name: '6 april 2006 tot 17 november 2017' }).click();
	await expect(page.getByText('Eerdere tekst, 6 april 2006 tot 17 november 2017')).toBeVisible();
	await expect(page.getByText(/Niet de geldende tekst/)).toBeVisible();

	await page.getByRole('button', { name: 'Geldend recht lezen' }).click();
	await expect(page.getByText('Geldend recht, tekst sinds 17 november 2017')).toBeVisible();
	await expect(page.getByText(/Niet de geldende tekst/)).toHaveCount(0);
});

/** The overview of a law: beside the text from 1440, under Inhoud on a phone. */
async function overview(page: Page, touch: boolean) {
	if (!touch) return page.getByRole('complementary', { name: 'Overzicht' });
	await page.getByRole('button', { name: 'Inhoud', exact: true }).click();
	return page.getByRole('dialog', { name: 'Inhoud' });
}

/** A footnote's marker followed to its note: a click, or on a phone a second tap (the first
 *  shows the note in a card, besluit 29). */
async function toNote(page: Page, marker: Locator, touch: boolean) {
	if (touch) {
		await marker.tap();
		await expect(page.getByRole('dialog', { name: /^Voetnoot / })).toBeVisible();
		await marker.tap();
	} else await marker.click();
}

test('a law lists its bijlagen after its articles; a bijlage reads its table', async ({
	page,
	touch
}) => {
	await bijlagenGelezen(page, 'BWBR0052872', ['bwbr0052872_annex_1']);
	await page.goto('/wetten/BWBR0052872');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cyberbeveiligingswet');
	const bijlagen = (await overview(page, touch)).getByRole('list', { name: 'Bijlagen' });
	await bijlagen.getByRole('link', { name: 'Bijlage 1', exact: true }).click();
	// A bijlage with a text of its own reads as the law does (besluit 29): still Tekst, the
	// bijlage marked in the contents.
	await expect(page).toHaveURL(/\/wetten\/BWBR0052872\/bijlage\/1$/);
	if (!touch)
		await expect(
			(await overview(page, touch))
				.getByRole('list', { name: 'Bijlagen' })
				.getByRole('link', { name: 'Bijlage 1', exact: true })
		).toHaveAttribute('aria-current', 'page');
	const table = page.getByRole('table').first();
	await expect(table.getByRole('columnheader')).toHaveText([
		'Sector',
		'Subsector',
		'Soort entiteit'
	]);
	await expect(table.getByRole('cell', { name: 'Energie', exact: true })).toBeVisible();
	// The table takes the text's whole width: beside the contents that of a lid's text, on a
	// phone the column's, from under the numbers (A110). It fits: nothing pans.
	const box = page.locator('.text-table').first();
	const width = (sel: string) =>
		page
			.locator(sel)
			.first()
			.evaluate((e) => e.clientWidth);
	const column = await width(touch ? '.article-text' : '.lid__text');
	expect(await width('.text-table')).toBeGreaterThanOrEqual(column - 1);
	await expect(box).not.toHaveAttribute('data-more-right');
});

test('a footnote of a bijlage: its marker goes to the note, the note back (#875)', async ({
	page,
	touch
}) => {
	await bijlagenGelezen(page, 'BWBR0052872', ['bwbr0052872_annex_1'], (body) =>
		metVoetnoten(body, 'annex', [{ after: 'Richtlijn (EU) 2019/944', number: '1' }])
	);
	await page.goto('/wetten/BWBR0052872/bijlage/1');
	const marker = page.getByRole('link', { name: 'Voetnoot 1', exact: true });
	await expect(marker).toHaveAttribute('href', '#fn-1');
	await expect(page.getByRole('cell').filter({ has: marker })).toContainText(
		'Richtlijn (EU) 2019/9441, die de functie'
	);
	await toNote(page, marker, touch);
	const note = page.locator('#fn-1');
	await expect(note).toHaveClass(/is-landed/);
	await expect(note).toBeInViewport();
	await expect(note).toContainText('1 Richtlijn (EU) 2019/944 van het Europees Parlement');
	await note.getByRole('link', { name: 'Terug naar de tekst bij voetnoot 1' }).click();
	await expect(page.locator('#fnref-1')).toHaveClass(/is-landed/);
	await expect(marker).toBeInViewport();
});

test('a footnote in the head of a table of an article (Successiewet art. 24, #875)', async ({
	page,
	touch
}) => {
	await patchApi(page, /^\/api\/articles\/BWBR0002226\/24$/, (body) =>
		metVoetnoten(body, 'article', [{ after: 'rechte lijn', number: '1', printed: '1)' }])
	);
	await page.goto('/wetten/BWBR0002226/artikel/24');
	const marker = page.getByRole('link', { name: 'Voetnoot 1', exact: true });
	await expect(page.getByRole('columnheader').filter({ has: marker })).toContainText(
		'in de rechte lijn1'
	);
	await toNote(page, marker, touch);
	await expect(page.locator('#fn-1')).toHaveClass(/is-landed/);
	await expect(page.locator('#fn-1')).toContainText('1 Voor afstammelingen in de tweede');
});

test('the footnotes of a bijlage of their own, a number twice (Meststoffenwet bijlage I, #881)', async ({
	page,
	touch
}) => {
	await eigenVoetnoten(
		page,
		/^\/api\/annexes\/bwbr0004054_annex_i$/,
		'annex',
		'bwbr0004054_annex_i'
	);
	await page.goto('/wetten/BWBR0004054/bijlage/I');
	// No note stands in the text: they are listed under it, in their order.
	const notes = page.locator('.voetnoten .voetnoot');
	await expect(notes).toHaveCount(5);
	await expect(notes.first()).toContainText('1Tot het grondgebied van de gemeente Dalfsen');
	await expect(page.locator('.article-text')).not.toContainText('Dalfsen 1)');
	// The second note numbered 1 is its own: Breda's marker goes there, and back.
	const breda = page.locator('#fnref-1-2').getByRole('link', { name: 'Voetnoot 1' });
	await expect(breda).toHaveAttribute('href', '#fn-1-2');
	await toNote(page, breda, touch);
	const note = page.locator('#fn-1-2');
	await expect(note).toHaveClass(/is-landed/);
	await expect(note).toBeInViewport();
	await expect(note).toContainText('gemeente Breda');
	await note.getByRole('link', { name: 'Terug naar de tekst bij voetnoot 1' }).click();
	await expect(page.locator('#fnref-1-2')).toHaveClass(/is-landed/);
});

test('a link in a footnote of an article (BWBV0007162 art. 15, #881)', async ({ page, touch }) => {
	await eigenVoetnoten(page, /^\/api\/articles\/BWBV0007162\/15$/, 'article', 'bwbv0007162_15');
	await page.goto('/wetten/BWBV0007162/artikel/15');
	const marker = page.getByRole('link', { name: 'Voetnoot 1', exact: true });
	await expect(marker).toHaveAttribute('href', '#fn-1');
	await toNote(page, marker, touch);
	const note = page.locator('#fn-1');
	await expect(note).toHaveClass(/is-landed/);
	// The regulation it names is a link, as in the text.
	await expect(note.getByRole('link', { name: 'Verordening (EU) 2016/1953' })).toBeVisible();
});

test('a list of the Opiumwet reads as its table', async ({ page, touch }) => {
	await bijlagenGelezen(page, 'BWBR0001941', ['bwbr0001941_annex_i']);
	await page.goto('/wetten/BWBR0001941');
	const bijlagen = (await overview(page, touch)).getByRole('list', { name: 'Bijlagen' });
	await bijlagen.getByRole('link', { name: 'Lijst I', exact: true }).click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0001941\/bijlage\/I$/);
	const table = page.getByRole('table').first();
	await expect(table.getByRole('columnheader').first()).toContainText(
		'International Non-proprietary Name'
	);
	await expect(table.getByRole('cell', { name: '25B-NBOMe', exact: true })).toBeVisible();
	// Beside the contents it fits the column; on a phone its names of substances do not, and
	// the table pans in its own box, its right edge faded (A110). The page never pans.
	const box = page.locator('.text-table').first();
	if (touch) await expect(box).toHaveAttribute('data-more-right');
	else await expect(box).not.toHaveAttribute('data-more-right');
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});

test('a footnote comes to the reader: its card on hover or a tap, with its links (besluit 29)', async ({
	page,
	touch
}) => {
	await eigenVoetnoten(page, /^\/api\/articles\/BWBV0007162\/15$/, 'article', 'bwbv0007162_15');
	await page.goto('/wetten/BWBV0007162/artikel/15');
	const marker = page.getByRole('link', { name: 'Voetnoot 1', exact: true });
	const card = page.getByRole('dialog', { name: 'Voetnoot 1' });
	if (touch) await marker.tap();
	else await marker.hover();
	// The note's text, its regulation a link as in the text; the reader stays where they are.
	await expect(card.getByRole('link', { name: 'Verordening (EU) 2016/1953' })).toBeVisible();
	await expect(page.locator('#fn-1')).not.toHaveClass(/is-landed/);
	// Escape closes it, as the pointer leaving does.
	if (touch) {
		await page.keyboard.press('Escape');
		await expect(card).toBeHidden();
	} else {
		await page.mouse.move(0, 0);
		await expect(card).toBeHidden();
	}
	// Its own link goes to the note.
	if (touch) await marker.tap();
	else await marker.focus();
	await card.getByRole('link', { name: 'Naar de voetnoot' }).click();
	await expect(card).toBeHidden();
	await expect(page.locator('#fn-1')).toHaveClass(/is-landed/);
});

test('a footnote of a bijlage of its own shows in a card at its marker (Meststoffenwet, #881)', async ({
	page,
	touch
}) => {
	await eigenVoetnoten(
		page,
		/^\/api\/annexes\/bwbr0004054_annex_i$/,
		'annex',
		'bwbr0004054_annex_i'
	);
	await page.goto('/wetten/BWBR0004054/bijlage/I');
	const breda = page.locator('#fnref-1-2').getByRole('link', { name: 'Voetnoot 1' });
	if (touch) await breda.tap();
	else await breda.hover();
	await expect(page.getByRole('dialog', { name: 'Voetnoot 1' })).toContainText('gemeente Breda');
});
