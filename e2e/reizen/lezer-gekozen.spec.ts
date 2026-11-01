// B85: welke bron de lezer toont en welke bronnen gekozen zijn. Het pad bepaalt de lezer en
// ?netwerk de gekozen bronnen; de werkplek houdt ze bij elkaar, in elke stand van het ontwerp.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';
import { isPhone, netwerkKnop } from '../support/navigation';

const WVW = 'instruments/bwbr0006622';
const CBB = 'instruments/bwbr0052875';
const DOSSIER = 'dossiers/36702';
const LANG = 'instruments/bwbr0007325';
const THIJS = `/wetten/BWBR0006622?diepte=2&mode=netwerk&netwerk=${CBB}&weergave=keten`;
const werkplek = (...ids: string[]) => `/wetten/BWBR0006622?mode=netwerk&netwerk=${ids.join(',')}`;

const rij = (page: Page, naam: string) =>
	page
		.getByRole('listitem')
		.filter({ has: page.getByRole('button', { name: `${naam} uit het netwerk weghalen` }) });
const inDeLezer = (page: Page) => page.getByRole('link', { name: 'In de lezer' });
const lezerKnop = (page: Page) => page.getByRole('banner').getByRole('button', { name: /^Lezer/ });

/** The wissel a wide screen has: on a phone it is the tab bar, and Gekozen does this work. */
async function wisselNoemt(page: Page, tekst: string, titel: string) {
	if (isPhone(page)) return;
	await expect(lezerKnop(page)).toHaveText(tekst);
	await expect(lezerKnop(page)).toHaveAccessibleName(`Lezer, ${titel}`);
}

test('één bron: in Gekozen, in de lezer, zonder teller en zonder Wis alles', async ({ page }) => {
	await page.goto('/wetten/BWBR0006622?mode=netwerk');
	await openSheet(page);
	await expect(rij(page, 'WVW').getByRole('link', { name: 'In de lezer' })).toBeVisible();
	await expect(page.getByText('Wis alles')).toHaveCount(0);
	await expect(netwerkKnop(page)).toHaveAccessibleName('Netwerk');
	await wisselNoemt(page, 'Lezer: WVW', 'Wegenverkeerswet 1994');
	await rij(page, 'WVW').getByRole('link', { name: 'In de lezer' }).click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0006622$/);
});

test('twee bronnen: Lezen opent de andere bron, en Netwerk brengt beide terug', async ({
	page
}) => {
	await page.goto(werkplek(WVW, DOSSIER));
	await openSheet(page);
	await expect(rij(page, 'WVW').getByRole('link', { name: 'In de lezer' })).toBeVisible();
	await expect(inDeLezer(page)).toHaveCount(1);
	await expect(netwerkKnop(page)).toHaveAccessibleName('Netwerk, 2 bronnen');
	await page.getByRole('link', { name: /lezen$/ }).click();
	await expect(page).toHaveURL(/\/dossiers\/36702$/);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	if (!isPhone(page)) await expect(lezerKnop(page)).toHaveText('Lezer: 36702');
});

test('een bron zonder afkorting: de knop kapt af, de hele naam in de tooltip', async ({ page }) => {
	test.skip(isPhone(page), 'op de telefoon staat de wissel er niet');
	await page.goto(`/explore?focus=${LANG}&mode=netwerk&netwerk=${WVW}`);
	const knop = lezerKnop(page);
	await expect(knop).toHaveAttribute('title', /^Besluit aanwijzing ambtenaren/);
	const naam = knop.locator('.lees-keuze__tekst');
	const breedte = await naam.evaluate((el) => el.getBoundingClientRect().width);
	expect(breedte).toBeLessThanOrEqual(136);
	expect(await naam.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});

for (const [soort, pad, knop] of [
	['dossier', '/dossiers/36702', 'Lezer: 36702'],
	['uitspraak', '/uitspraken/ECLI:NL:RBDHA:2024:14069', 'Lezer: Rb. Den Haag 30 augustus 2024'],
	['artikel', '/wetten/BWBR0006622/artikel/8', 'Lezer: Art. 8 WVW']
] as const)
	test(`een ${soort}: de korte naam op de knop, één rij, ook met een tweede bron`, async ({
		page
	}) => {
		await page.goto(`${pad}?mode=netwerk`);
		await openSheet(page);
		await expect(inDeLezer(page)).toHaveCount(1);
		if (!isPhone(page)) await expect(lezerKnop(page)).toHaveText(knop);
		await page.goto(`${pad}?mode=netwerk&netwerk=${CBB}`);
		await openSheet(page);
		await expect(rij(page, 'Cbb').getByRole('link', { name: 'Cbb lezen' })).toBeVisible();
		await expect(inDeLezer(page)).toHaveCount(1);
		await expect(page.getByRole('button', { name: /uit het netwerk weghalen$/ })).toHaveCount(2);
		await expect(netwerkKnop(page)).toHaveAccessibleName('Netwerk, 2 bronnen');
	});

test('× op de bron van de lezer: de lezer gaat mee naar de volgende bron', async ({ page }) => {
	await page.goto(werkplek(WVW, CBB, DOSSIER));
	await openSheet(page);
	await rij(page, 'WVW')
		.getByRole('button', { name: /weghalen$/ })
		.click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0052875\?/);
	await expect(page).not.toHaveURL(/bwbr0006622/);
	await openSheet(page);
	await expect(rij(page, 'Cbb').getByRole('link', { name: 'In de lezer' })).toBeVisible();
	await expect(rij(page, 'WVW')).toHaveCount(0);
	await expect(netwerkKnop(page)).toHaveAccessibleName('Netwerk, 2 bronnen');
	await wisselNoemt(page, 'Lezer: Cbb', 'Cyberbeveiligingsbesluit');
});

test('× op de laatste bron: het netwerk is leeg en de lezer blijft op die bron', async ({
	page
}) => {
	await page.goto('/wetten/BWBR0006622?mode=netwerk');
	await openSheet(page);
	await rij(page, 'WVW')
		.getByRole('button', { name: /weghalen$/ })
		.click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0006622$/);
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Wegenverkeerswet 1994');
	await expect(netwerkKnop(page)).toHaveAccessibleName('Netwerk');
	await expect(page.getByText(/WVW weggehaald uit het netwerk/)).toBeVisible();
	await page.getByRole('button', { name: 'Ongedaan maken' }).click();
	await expect(page).toHaveURL(/mode=netwerk/);
});

test('een andere bron weghalen tot de bron van de pagina alleen staat: geen netwerk meer', async ({
	page
}) => {
	await page.goto(werkplek(WVW, CBB));
	await openSheet(page);
	await rij(page, 'Cbb')
		.getByRole('button', { name: /weghalen$/ })
		.click();
	await expect(page).not.toHaveURL(/netwerk=/);
	await openSheet(page);
	await expect(rij(page, 'WVW').getByRole('link', { name: 'In de lezer' })).toBeVisible();
	await expect(netwerkKnop(page)).toHaveAccessibleName('Netwerk');
});

test('de link van Thijs: de keten gaat over de WVW, en die staat in Gekozen', async ({ page }) => {
	await page.goto(THIJS);
	await expect(page.getByText(/Ook gekozen, niet in deze keten/)).toContainText('Cbb');
	await expect(page.getByText(/Ook gekozen, niet in deze keten/)).not.toContainText('WVW');
	await openSheet(page);
	await expect(rij(page, 'WVW').getByRole('link', { name: 'In de lezer' })).toBeVisible();
	await expect(rij(page, 'Cbb').getByRole('link', { name: 'Cbb lezen' })).toBeVisible();
	await expect(netwerkKnop(page)).toHaveAccessibleName('Netwerk, 2 bronnen');
	await wisselNoemt(page, 'Lezer: WVW', 'Wegenverkeerswet 1994');
	if (!isPhone(page)) {
		await lezerKnop(page).click();
		await expect(page).toHaveURL(/\/wetten\/BWBR0006622\?diepte=2$/);
	}
});

test('een bron gemarkeerd op het doek is niet de bron van de lezer', async ({ page }) => {
	await page.goto(`/explore?netwerk=${CBB},${DOSSIER}&kies=${DOSSIER}`);
	await openSheet(page);
	await expect(rij(page, 'Cbb').getByRole('link', { name: 'In de lezer' })).toBeVisible();
});
