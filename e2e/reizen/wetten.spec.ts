// From the list of laws to a law, an article, its leden and versions: Bronnen › Wetten with
// its filters, the text of a law with its overview and a date, an article with its leden,
// its neighbours and its earlier texts, and what is based on the law (delegations).
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { showText } from '../support/panes';
import { bijlagenGelezen } from '../support/bijlagen';

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

	await page.goto('/explore?mode=index&kind=instruments');
	await page.getByRole('searchbox', { name: 'Zoek in wetten' }).fill('Burgerlijk Wetboek Boek 6');
	await page.getByRole('link', { name: 'Burgerlijk Wetboek Boek 6', exact: true }).click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289$/);
	await showText(page, touch);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Burgerlijk Wetboek Boek 6');
});

test('a law reads whole, with its overview, a date to read it on and what is based on it', async ({
	page,
	touch
}) => {
	await page.goto('/wetten/BWBR0005289?lezen=1');
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
	await page.goto('/wetten/BWBR0005289/artikel/6:162?lezen=1');
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
	await page.goto('/wetten/BWBR0001840/artikel/23?lezen=1');
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

test('a law lists its bijlagen after its articles; a bijlage reads its table', async ({
	page,
	touch
}) => {
	await bijlagenGelezen(page, 'BWBR0052872', ['bwbr0052872_annex_1']);
	await page.goto('/wetten/BWBR0052872?lezen=1');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cyberbeveiligingswet');
	const bijlagen = (await overview(page, touch)).getByRole('list', { name: 'Bijlagen' });
	await bijlagen.getByRole('link', { name: 'Bijlage 1', exact: true }).click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0052872\/bijlage\/1/);
	const table = page.getByRole('table').first();
	await expect(table.getByRole('columnheader')).toHaveText([
		'Sector',
		'Subsector',
		'Soort entiteit'
	]);
	await expect(table.getByRole('cell', { name: 'Energie', exact: true })).toBeVisible();
});

test('a list of the Opiumwet reads as its table', async ({ page, touch }) => {
	await bijlagenGelezen(page, 'BWBR0001941', ['bwbr0001941_annex_i']);
	await page.goto('/wetten/BWBR0001941?lezen=1');
	const bijlagen = (await overview(page, touch)).getByRole('list', { name: 'Bijlagen' });
	await bijlagen.getByRole('link', { name: 'Lijst I', exact: true }).click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0001941\/bijlage\/I$/);
	const table = page.getByRole('table').first();
	await expect(table.getByRole('columnheader').first()).toContainText(
		'International Non-proprietary Name'
	);
	await expect(table.getByRole('cell', { name: '25B-NBOMe', exact: true })).toBeVisible();
});
