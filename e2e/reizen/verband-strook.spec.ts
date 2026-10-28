// Verband and the Tijdstrook after the toets of A315 (A319): a dossier is named by its number,
// so it differs from the wet of the same name; a phone has the button "Verband, N stappen" and
// rows of a finger's height; the strip dates a publication by its day of publication, counts
// as Tonen does and says what has no date.
import { expect, test } from '../support/test';

const BW7 = 'instruments/bwbr0005290';
const WET = 'instruments/bwbr0049889';
const DOSSIER = 'dossiers/36496';
const STB = ['stb_2024_200', 'stb_2021_100', 'stb_2018_100'].map((k) => `instruments/${k}`);

test('Verband names a dossier by its number, not as the wet of the same name', async ({
	page,
	touch
}) => {
	await page.goto(`/explore?netwerk=${BW7},${DOSSIER},${WET}&weergave=verband`);
	const shared = page.locator('.shared');
	const keuze = shared.getByRole('group', { name: 'Bronnen' }).or(shared.locator('.keuze'));
	await expect(keuze.first()).toBeVisible({ timeout: 30_000 });
	const text = (await keuze.first().innerText()).replace(/\s+/g, ' ');
	expect(text).toContain('36496 Wet betaalbare huur');
	// No Keuze reads "Wet betaalbare huur en Wet betaalbare huur".
	expect(text).not.toMatch(/(?<!\d )Wet betaalbare huur en (?!36496 )Wet betaalbare huur/);
	expect(text).toMatch(
		/Wet betaalbare huur en 36496 Wet betaalbare huur|36496 Wet betaalbare huur en Wet betaalbare huur/
	);
	if (!touch) {
		const heads = await shared.locator('.head').allTextContents();
		expect(heads.join(' ')).toContain('36496 Wet betaalbare huur');
	}
});

test('a phone has the button "Verband, N stappen", and rows a finger can press', async ({
	page,
	touch
}) => {
	test.skip(!touch, 'the telefoon');
	await page.goto(`/explore?netwerk=${BW7},${WET}&weergave=verband`);
	const knop = page.locator('.shared').getByRole('button', { name: /^Verband, 1 stap$/ });
	await expect(knop).toBeVisible({ timeout: 30_000 });
	await knop.click();
	await expect(page.getByRole('dialog', { name: 'Weergave' })).toBeVisible();
	await page
		.getByRole('dialog', { name: 'Weergave' })
		.getByRole('button', { name: 'Sluiten' })
		.click();
	const hoogte = async (sel: string) =>
		page
			.locator(`.shared ${sel}`)
			.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
	for (const h of await hoogte('.ladder__ends li')) expect(h).toBeGreaterThanOrEqual(44);
	for (const h of await hoogte('.ladder__list li')) expect(h).toBeGreaterThanOrEqual(44);
	for (const h of await hoogte('.ladder__pill')) expect(h).toBeGreaterThanOrEqual(44);
});

test('the strip dates a publication by its day of publication and calls it a publicatie', async ({
	page,
	touch
}) => {
	await page.goto(`/explore?netwerk=${STB.join(',')}`);
	const strook = page.locator('.tijdstrook');
	await expect(strook).toBeVisible({ timeout: 30_000 });
	// A phone says the count on its one button, wider it stands in the strip.
	const telling = strook.locator('.telling, .micro').first();
	await expect(telling).toContainText(/publicaties?/);
	if (!touch) await expect(strook.locator('[data-wijziging]').first()).toBeVisible();
});

test('the strip counts what Tonen counts and names what has no date', async ({ page }) => {
	await page.goto(`/explore?netwerk=${BW7}`);
	const telling = page.locator('.tijdstrook .telling, .tijdstrook .micro').first();
	await expect(telling).toBeVisible({ timeout: 30_000 });
	// What has no date is said by what it is, not as a number of "zonder jaar".
	await expect(telling).toContainText(/artikelen.* zonder datum/);
	await expect(telling).not.toContainText('zonder jaar');
});
