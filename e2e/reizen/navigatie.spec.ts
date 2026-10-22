// The navigation by kind of source (besluit 36): Wetten, Uitspraken, Kamerstukken, Parlement,
// Regering and Actueel in the bar, Mijn at the right, and the Netwerk button beside the search
// field; on a phone an icon button and the tab bar with four tabs.
import { goToMine, goToSource, isPhone } from '../support/navigation';
import { expect, test } from '../support/test';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162';
const bar = (page: import('@playwright/test').Page) =>
	page.getByRole('navigation', { name: 'Hoofdnavigatie' });
const tabs = (page: import('@playwright/test').Page) =>
	page.getByRole('navigation', { name: 'Hoofdmenu' });
const netwerk = (page: import('@playwright/test').Page) =>
	page.getByRole('banner').getByRole('link', { name: 'Netwerk' });

test('every kind of source is an item of the navigation, and the one the page stands under is marked', async ({
	page
}) => {
	await page.goto('/explore?mode=index&kind=instruments');
	if (isPhone(page)) {
		await expect(tabs(page).getByRole('button', { name: 'Bladeren' })).toHaveClass(/is-active/);
		await expect(bar(page)).toBeHidden();
		await goToSource(page, 'Uitspraken');
		await expect(page).toHaveURL(/kind=judgments/);
		return;
	}
	await expect(bar(page).getByRole('link')).toHaveText([
		'Wetten',
		'Uitspraken',
		'Kamerstukken',
		'Parlement',
		'Regering',
		'Actueel'
	]);
	await expect(bar(page).getByRole('link', { name: 'Wetten' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await goToSource(page, 'Uitspraken');
	await expect(page).toHaveURL(/kind=judgments/);
	await expect(bar(page).getByRole('link', { name: 'Uitspraken' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(bar(page).getByRole('link', { name: 'Wetten' })).not.toHaveAttribute('aria-current');
});

test('each item leads to the list of its kind, Actueel to the day', async ({ page }) => {
	test.skip(isPhone(page), 'the links of the bar are a wide screen’s');
	await page.goto('/actueel');
	const links = bar(page).getByRole('link');
	for (const [label, href] of [
		['Wetten', 'kind=instruments'],
		['Uitspraken', 'kind=judgments'],
		['Kamerstukken', 'kind=dossiers'],
		['Parlement', 'kind=members'],
		['Regering', 'kind=cabinets'],
		['Actueel', '/actueel']
	])
		await expect(links.filter({ hasText: label })).toHaveAttribute('href', new RegExp(href));
});

test('a bron stands under its kind of source: the bar marks it and its breadcrumb begins with it', async ({
	page
}) => {
	await page.goto(ARTICLE);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
	if (!isPhone(page))
		await expect(bar(page).getByRole('link', { name: 'Wetten' })).toHaveAttribute(
			'aria-current',
			'page'
		);
	const band = page.getByRole('navigation', { name: 'Behoort bij' });
	await expect(band.getByRole('link').first()).toHaveText('Wetten');
	await expect(band.getByRole('link').first()).toHaveAttribute(
		'href',
		'/explore?mode=index&kind=instruments'
	);
});

test('the kinds of one source are its lists, the sources themselves are the navigation', async ({
	page
}) => {
	await page.goto('/explore?mode=index&kind=factions');
	const lists = page.getByRole('navigation', { name: 'Parlement', exact: true });
	await expect(lists.getByRole('link')).toHaveText(['Kamerleden', 'Fracties', 'Commissies']);
	await expect(lists.getByRole('link', { name: 'Fracties' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await page.goto('/explore?mode=index&kind=judgments');
	await expect(page.getByRole('navigation', { name: 'Uitspraken', exact: true })).toHaveCount(0);
});

test('Mijn holds Bundels and Gevolgd', async ({ page }) => {
	await page.goto('/actueel');
	await goToMine(page, 'Gevolgd');
	await expect(page).toHaveURL(/\/onderwerpen$/);
	await goToMine(page, 'Bundels');
	await expect(page).toHaveURL(/\/bundels$/);
});

test('Netwerk opens the bron of the page big, and elsewhere begins with choosing', async ({
	page
}) => {
	await page.goto(ARTICLE);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
	await expect(netwerk(page)).toHaveAttribute('href', /mode=netwerk/);
	await netwerk(page).click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289\/artikel\/6:162\?.*mode=netwerk/);
	await expect(netwerk(page)).toHaveAttribute('aria-current', 'page');
	await expect(page.locator('canvas').first()).toBeVisible();

	await page.goto('/actueel');
	await expect(netwerk(page)).toHaveAttribute('href', '/explore');
	await netwerk(page).click();
	await expect(page).toHaveURL(/\/explore$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Netwerk');
});

test('on a phone Netwerk is an icon of 44 px and the tab bar has four tabs', async ({ page }) => {
	test.skip(!isPhone(page), 'the tab bar is a phone’s');
	await page.goto('/actueel');
	const knop = netwerk(page);
	const box = await knop.boundingBox();
	expect(box!.width).toBeGreaterThanOrEqual(44);
	expect(box!.height).toBeGreaterThanOrEqual(44);
	await expect(tabs(page).locator('.tab')).toHaveText(['Zoeken', 'Bladeren', 'Actueel', 'Mijn']);
	await expect(tabs(page).getByRole('link', { name: 'Actueel' })).toHaveClass(/is-active/);
	await tabs(page).getByRole('button', { name: 'Bladeren' }).click();
	const sheet = page.getByRole('dialog', { name: 'Bladeren op soort bron' });
	await expect(sheet.getByRole('link')).toHaveText([
		/^Wetten/,
		/^Uitspraken/,
		/^Kamerstukken/,
		/^Parlement/,
		/^Regering/
	]);
	// A tap outside closes it, and nothing below it opens.
	await page.locator('.scrim').click({ position: { x: 40, y: 40 } });
	await expect(sheet).toHaveCount(0);
	await expect(page).toHaveURL(/\/actueel$/);
});

test('on a wide screen there is no tab bar', async ({ page }) => {
	test.skip(isPhone(page), 'the bar is a wide screen’s');
	await page.goto('/actueel');
	await expect(tabs(page)).toBeHidden();
	await expect(page.getByRole('button', { name: /^Mijn/ })).toBeVisible();
});
