// The navigation by kind of source (besluit 36): Wetten, Rechtspraak, Kamerstukken, Parlement,
// Regering and Actueel in the bar, Mijn at the right, and the Netwerk button beside the search
// field; on a phone an icon button and the tab bar with four tabs.
import { goToMine, goToSource, isPhone, netwerkKnop } from '../support/navigation';
import { expect, test } from '../support/test';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162';
const bar = (page: import('@playwright/test').Page) =>
	page.getByRole('navigation', { name: 'Hoofdnavigatie' });
const tabs = (page: import('@playwright/test').Page) =>
	page.getByRole('navigation', { name: 'Hoofdmenu' });

test('every kind of source is an item of the navigation, and the one the page stands under is marked', async ({
	page
}) => {
	await page.goto('/explore?mode=index&kind=instruments');
	if (isPhone(page)) {
		await expect(tabs(page).getByRole('button', { name: 'Bronnen' })).toHaveClass(/is-active/);
		await expect(bar(page)).toBeHidden();
		await goToSource(page, 'Rechtspraak');
		await expect(page).toHaveURL(/kind=judgments/);
		return;
	}
	await expect(bar(page).getByRole('link')).toHaveText([
		'Wetten',
		'Rechtspraak',
		'Kamerstukken',
		'Parlement',
		'Regering',
		'Actueel'
	]);
	await expect(bar(page).getByRole('link', { name: 'Wetten' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await goToSource(page, 'Rechtspraak');
	await expect(page).toHaveURL(/kind=judgments/);
	await expect(bar(page).getByRole('link', { name: 'Rechtspraak' })).toHaveAttribute(
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
		['Rechtspraak', 'kind=judgments'],
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
	await expect(page.getByRole('navigation', { name: 'Rechtspraak', exact: true })).toHaveCount(0);
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
	await expect(netwerkKnop(page)).toHaveAttribute('href', /mode=netwerk/);
	await netwerkKnop(page).click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289\/artikel\/6:162\?.*mode=netwerk/);
	await expect(netwerkKnop(page)).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('canvas').first()).toBeVisible();

	await page.goto('/actueel');
	await expect(netwerkKnop(page)).toHaveAttribute('href', '/explore');
	await netwerkKnop(page).click();
	await expect(page).toHaveURL(/\/explore$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Netwerk');
});

test('on a wide screen a bron has the wissel Lezer | Netwerk in the top bar, and nowhere else (B48)', async ({
	page
}) => {
	test.skip(isPhone(page), 'on a phone the tab bar is the switch');
	await page.goto(ARTICLE);
	const wissel = page.getByRole('banner').getByRole('group', { name: 'Lezer of netwerk' });
	const lezer = wissel.getByRole('button', { name: 'Lezer' });
	await expect(lezer).toHaveAttribute('aria-pressed', 'true');
	await wissel.getByRole('button', { name: /^Netwerk/ }).click();
	await expect(page).toHaveURL(/mode=netwerk/);
	await expect(lezer).toHaveAttribute('aria-pressed', 'false');
	await lezer.click();
	await expect(page).not.toHaveURL(/mode=netwerk/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
	// No bron, no text to read: Netwerk alone.
	await page.goto('/actueel');
	await expect(page.getByRole('group', { name: 'Lezer of netwerk' })).toHaveCount(0);
});

test('on a phone Netwerk is a tab of 44 px, not in the top bar, and the tab bar has five tabs', async ({
	page
}) => {
	test.skip(!isPhone(page), 'the tab bar is a phone’s');
	await page.goto('/actueel');
	await expect(page.getByRole('banner').getByRole('button', { name: 'Netwerk' })).toHaveCount(0);
	const knop = tabs(page).getByRole('button', { name: 'Netwerk' });
	const box = await knop.boundingBox();
	expect(box!.width).toBeGreaterThanOrEqual(44);
	expect(box!.height).toBeGreaterThanOrEqual(44);
	await expect(tabs(page).locator('.tab')).toHaveText([
		'Zoeken',
		'Bronnen',
		'Netwerk',
		'Actueel',
		'Mijn'
	]);
	await expect(tabs(page).getByRole('link', { name: 'Actueel' })).toHaveClass(/is-active/);
	await tabs(page).getByRole('button', { name: 'Bronnen' }).click();
	const sheet = page.getByRole('dialog', { name: 'Bronnen' });
	await expect(sheet.getByRole('link')).toHaveText([
		/^Wetten/,
		/^Rechtspraak/,
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
