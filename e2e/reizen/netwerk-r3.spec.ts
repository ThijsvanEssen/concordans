// The werkplek after round 3 (R3-N, R3-K): a chosen bron stays drawn whatever Soort leaves, the
// last bron leaves /explore as it leaves a bron's page, and Keten follows the bron of the
// netwerk, not the route; where it can mean nothing it is not offered.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';
import { netwerkKnop } from '../support/navigation';

const strip = (page: Page) => page.getByRole('complementary', { name: 'Bronnen en filters' });
/** The filters of the strip, behind Filter on a narrow screen. */
async function filters(page: Page) {
	await openSheet(page);
	const toggle = strip(page).getByRole('button', { name: 'Filter', exact: true });
	await expect(
		strip(page).getByRole('region', { name: 'Weergave en legenda' }).or(toggle).first()
	).toBeVisible();
	if (await toggle.isVisible()) await toggle.click();
	return strip(page).getByRole('region', { name: 'Filters' });
}

test('Soort off for the kind of the chosen bronnen leaves them and the filters standing (R3-N B1)', async ({
	page
}) => {
	await page.goto('/explore?netwerk=articles/bwbr0005289_162');
	await openSheet(page);
	const legend = await filters(page);
	const articles = legend.getByRole('button', { name: /^Artikelen/ });
	await expect(articles).toHaveAttribute('aria-pressed', 'true');
	await articles.click();
	await expect(page).toHaveURL(/bronnen=/);
	await expect(articles).toHaveAttribute('aria-pressed', 'false');
	// The bron stays on the canvas: the keyboard's list of what is drawn names it.
	await expect(page.locator('.canvas-node-list')).toContainText('Art. 6:162 BW');
	await articles.click();
	await expect(articles).toHaveAttribute('aria-pressed', 'true');
});

test('the last bron on /explore leaves with × and stays gone (R3-N B2)', async ({ page }) => {
	await page.goto('/explore?netwerk=instruments/bwbr0005537');
	await openSheet(page);
	await page.getByRole('button', { name: /^Haal .* uit het netwerk$/ }).click();
	// The top bar counting no bron is the signal that the page has taken it out and settled.
	await expect(netwerkKnop(page)).toHaveAccessibleName('Netwerk');
	await expect(page).not.toHaveURL(/netwerk=/);
});

test('Keten on /explore with a law draws its keten (R3-N B3)', async ({ page, touch }) => {
	await page.goto('/explore?netwerk=instruments/bwbr0010346&weergave=keten');
	await openSheet(page);
	await expect(page.getByRole('button', { name: 'Keten', pressed: true })).toBeVisible();
	await expect(page.getByText(/alleen bij een wet/)).toHaveCount(0);
	const regulation = touch
		? page.getByRole('region', { name: 'AMvB' }).getByRole('button').first()
		: page
				.getByRole('group', { name: 'Keten' })
				.getByRole('button', { name: /^(Arbowet|Arbeidsomstandighedenwet)$/ });
	await expect(regulation).toBeVisible();
});

test('Keten is not offered where there is none (R3-K F9, besluit 41)', async ({ page }) => {
	await page.goto('/dossiers/36496?mode=netwerk');
	await openSheet(page);
	await expect(page.getByRole('button', { name: 'Omgeving', pressed: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Keten' })).toHaveCount(0);
});

// A keten per kind, with layers of its own (besluit 41): a judgment through its instances.
test('the keten of a judgment stands in its instances', async ({ page, touch }) => {
	await page.goto('/uitspraken/ECLI:NL:HR:2019:2006?mode=netwerk&weergave=keten');
	await openSheet(page);
	await expect(page.getByRole('button', { name: 'Keten', pressed: true })).toBeVisible();
	if (touch) {
		for (const laag of ['Rechtbank', 'Gerechtshof', 'Hoge Raad'])
			await expect(page.getByRole('region', { name: laag })).toBeVisible();
	} else
		await expect(page.getByRole('group', { name: 'Keten' })).toContainText(
			/RECHTBANK.*GERECHTSHOF.*HOGE RAAD/
		);
});

test('Verband counts the bron of the page as the first end (R3-I F2)', async ({ page }) => {
	await page.goto(
		'/wetten/BWBR0005289/artikel/6:162?mode=netwerk&weergave=verband&netwerk=articles/bwbr0005290_658'
	);
	await openSheet(page);
	await expect(page.getByRole('button', { name: 'Verband', pressed: true })).toBeVisible();
	await expect(page.getByText('Art. 7:658 BW').first()).toBeVisible();
	await expect(page.getByText('Voeg een tweede bron toe')).toHaveCount(0);
});

test('no "?" for judgments both cite where one end cites none (R3-N B7)', async ({ page }) => {
	await page.goto(
		'/leden/rob-jetten?mode=netwerk&weergave=verband&netwerk=instruments/bwbr0005537'
	);
	await openSheet(page);
	await expect(page.getByText('Rob Jetten').first()).toBeVisible();
	// Absence counts only once Verband has answered: its drawing, its list or its empty line.
	const shared = page.locator('.shared');
	await expect(
		shared
			.getByRole('group', { name: 'Verband' })
			.or(shared.locator('.ladder, .gap, .empty'))
			.first()
	).toBeVisible();
	await expect(shared.getByText('Verband zoeken')).toHaveCount(0);
	await expect(page.getByText(/die beide aanhalen/)).toHaveCount(0);
});

test('a cut neighbourhood says how much of it is shown (R3-N B6)', async ({ page }) => {
	await page.goto('/explore?netwerk=instruments/bwbr0005537');
	await openSheet(page);
	const legend = await filters(page);
	// In Soort's own column of counts, no block of its own.
	await expect(legend.getByRole('button', { name: /^Artikelen [\d.]+ van [\d.]+$/ })).toBeVisible();
	await expect(legend.getByRole('heading', { name: 'Getoond' })).toHaveCount(0);
});

test('an article the data lacks leads to its law, by name (R3-I F19)', async ({ page, guard }) => {
	// The 404 of the lookup, as the server gives it.
	guard.allow(/status of 404/);
	await page.goto('/wetten/BWBR0005289/artikel/6:99999');
	await expect(page.getByRole('link', { name: 'Burgerlijk Wetboek Boek 6' })).toHaveAttribute(
		'href',
		'/wetten/BWBR0005289'
	);
});

test('the keten names a publication by its citation, its layer by its kind (R3-K F2, F11)', async ({
	page
}) => {
	await page.goto('/stb/2018/101?mode=netwerk&weergave=keten');
	await openSheet(page);
	await expect(page.getByRole('button', { name: 'Keten', pressed: true })).toBeVisible();
	await expect(page.getByText('Stb. 2018, 101').first()).toBeVisible();
	await expect(page.getByText(/STB_2018_101/)).toHaveCount(0);
});

test('Alle N lists the regulations a layer does not draw (R3-K F4)', async ({ page, touch }) => {
	await page.goto('/wetten/BWBR0010346?mode=netwerk&weergave=keten');
	const alle = touch
		? page.getByRole('region', { name: 'AMvB' }).getByRole('button', { name: /^Alle \d+/ })
		: page
				.getByRole('group', { name: 'Keten' })
				.getByRole('button', { name: /^Alle \d+/ })
				.first();
	await expect(alle).toBeVisible();
	await alle.click();
	await expect(page.getByRole('button', { name: 'Minder' }).first()).toBeVisible();
});

test('Keten fits its width: no zoom, Deel stays', async ({ page }) => {
	await page.goto('/wetten/BWBR0010346?mode=netwerk&weergave=keten');
	await openSheet(page);
	await expect(page.getByRole('button', { name: 'Keten', pressed: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Deel/ }).first()).toBeAttached();
	await expect(page.getByRole('button', { name: 'Inzoomen' })).toHaveCount(0);
});

// Verband per pair (Thijs, 23 Oct): every chosen bron drawn, the same bronnen in another order
// give the same Verband, and a bron added takes no verband away.
const D = 'members/9ab41898_332f_4c08_a834_d58b4669c990';
const R = 'members/8b3664bd_77e4_468b_af96_f3f4ec27fcce';
const VIER = ['instruments/bwbr0010346', D, 'articles/bwbr0001903_126ffa', 'factions/vvd'];
/** What Verband draws and says, in order: the drawing on a wide screen, the list on a phone. */
async function verband(page: Page, ids: string[], touch: boolean) {
	await page.goto(`/explore?netwerk=${ids.join(',')}&weergave=verband`);
	const shared = page.locator('.shared');
	const lines = touch ? shared.locator('.ladder__name') : shared.locator('svg text');
	await expect(lines.filter({ hasText: /lid van/ }).first()).toBeVisible({ timeout: 20_000 });
	return (await lines.evaluateAll((els) => els.map((e) => e.textContent ?? ''))).map((t) =>
		t.trim()
	);
}

test('Verband draws every chosen bron, the same in any order, and keeps its verbanden', async ({
	page,
	touch
}) => {
	const vier = await verband(page, VIER, touch);
	for (const naam of ['Arbowet', 'Art. 126ffa Sv', 'Dilan Yeşilgöz-Zegerius'])
		expect(vier.some((t) => t.startsWith(naam))).toBe(true);
	const evaluatie = vier.find((t) => /Evaluat/.test(t))!;
	expect(evaluatie).toBeTruthy();
	const omgekeerd = await verband(page, [...VIER].reverse(), touch);
	expect(omgekeerd).toEqual(vier);
	const vijf = await verband(page, [...VIER, R], touch);
	expect(vijf).toContain(evaluatie);
	expect(vijf.some((t) => t.startsWith('Mark Rutte'))).toBe(true);
});

test('the same keten on /explore and on the page of the law (besluit 41)', async ({
	page,
	touch
}) => {
	const keten = async (url: string) => {
		await page.goto(url);
		const view = touch ? page.locator('.chain .list') : page.getByRole('group', { name: 'Keten' });
		await expect(view.getByRole('button').first()).toBeVisible();
		return view.evaluate((el) => el.textContent?.replace(/\s+/g, ' ').trim());
	};
	const hier = await keten('/explore?netwerk=instruments/bwbr0010346&weergave=keten');
	const daar = await keten('/wetten/BWBR0010346?mode=netwerk&weergave=keten');
	expect(hier).toBe(daar);
});
