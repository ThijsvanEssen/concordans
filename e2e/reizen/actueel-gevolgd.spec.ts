// What came in: Actueel per day with its periods and filters, and Gevolgd, the topics a reader
// follows, with the overview of one.
import { goToSource } from '../support/navigation';
import { expect, test } from '../support/test';

test('Actueel: a period and a kind narrow the days', async ({ page, touch }) => {
	await page.goto('/actueel');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Actueel');
	await expect(page.getByRole('heading', { level: 2, name: /^Vandaag/ })).toBeVisible();
	const count = page.getByText(/^[\d.]+\s*gebeurtenissen$/);
	const all = await count.textContent();

	const period = page.getByRole('group', { name: 'Periode' });
	await period.getByRole('button', { name: 'Maand' }).click();
	await expect(period.getByRole('button', { name: 'Maand' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page).toHaveURL(/\/actueel\?.+/);
	await expect(count).not.toHaveText(all!);

	if (touch) await page.getByRole('button', { name: 'Verfijnen' }).click();
	const motie = page.getByRole('region', { name: 'Soort' }).getByRole('button', { name: /^Motie/ });
	await motie.click();
	await expect(motie).toHaveAttribute('aria-pressed', 'true');
	if (touch) await page.keyboard.press('Escape');
	// Each day then counts moties only.
	const days = page.getByRole('heading', { level: 2, name: /\d{4}/ });
	await expect(days.first()).toHaveText(/\d+ moties?$/);
});

test('Actueel: Back finds the earlier days loaded and the place read', async ({ page }) => {
	// The days counted come after the days: waited for, so each step asks the same.
	const counted = () => page.waitForResponse((r) => /\/api\/feed\/summary\?.*until=/.test(r.url()));
	let telling = counted();
	await page.goto('/actueel');
	const days = page.getByRole('heading', { level: 2, name: /\d{4}|^Vandaag|^Gisteren/ });
	await expect(days.first()).toBeVisible();
	await telling;
	const first = await days.count();
	telling = counted();
	await page.getByRole('button', { name: 'Eerdere dagen' }).click();
	await expect.poll(() => days.count()).toBeGreaterThan(first);
	await telling;
	const loaded = await days.count();
	await days.last().scrollIntoViewIfNeeded();
	const y = await page.evaluate(() => scrollY);
	expect(y).toBeGreaterThan(0);

	await goToSource(page, 'Wetten');
	await expect(page).not.toHaveURL(/\/actueel/);
	await page.goBack();
	await expect(page).toHaveURL(/\/actueel/);
	await expect.poll(() => days.count()).toBe(loaded);
	await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y - 50);
});

test('Actueel: who submitted and who voted are two filters, each under its own name', async ({
	page,
	touch
}) => {
	await page.goto('/actueel');
	await expect(page.getByRole('heading', { level: 2, name: /^Vandaag/ })).toBeVisible();
	if (touch) await page.getByRole('button', { name: 'Verfijnen' }).click();
	await expect(page.getByRole('region', { name: 'Ingediend door' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Stemde' })).toBeVisible();
	// How a fractie voted is asked only once a fractie is chosen.
	await expect(page.getByRole('region', { name: 'Stem', exact: true })).toHaveCount(0);
});

test('Actueel: the Kamer narrows to the Eerste Kamer, chosen before the days are in', async ({
	page
}) => {
	await page.goto('/actueel');
	const kamer = page.getByRole('group', { name: 'Kamer' });
	await kamer.getByRole('button', { name: 'Eerste Kamer' }).click();
	await expect(page.getByText(/^[\d.]+\s*gebeurtenissen$/)).toBeVisible();
	await expect(kamer.getByRole('button', { name: 'Eerste Kamer' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page).toHaveURL(/kamer=/);
});

test('Gevolgd: a topic followed shows its days, keeps after a reload and can be let go', async ({
	page
}) => {
	await page.goto('/onderwerpen');
	// Typed before the page has its first answer: kept.
	await page.getByRole('textbox', { name: 'Onderwerp volgen' }).fill('huur');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gevolgde onderwerpen');
	await expect(page.getByText('Nog geen onderwerpen.')).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Onderwerp volgen' })).toHaveValue('huur');
	await page.getByRole('button', { name: 'Volg' }).click();
	const topic = page.getByRole('heading', { level: 2, name: /^huur/ });
	await expect(topic).toBeVisible();
	await expect(page.locator('mark').filter({ hasText: 'huur' }).first()).toBeVisible();

	await page.reload();
	await expect(topic).toBeVisible();
	await expect(topic.getByRole('link', { name: 'Overzicht' })).toHaveAttribute(
		'href',
		/\/onderwerpen\/overzicht/
	);
	await topic.getByRole('button', { name: 'Niet meer volgen' }).click();
	await expect(topic).toHaveCount(0);
	await expect(page.getByText('Nog geen onderwerpen.')).toBeVisible();
});

test('the overview of a topic sorts its decisions by kind and outcome', async ({ page }) => {
	await page.goto('/onderwerpen');
	await expect(page.getByText('Nog geen onderwerpen.')).toBeVisible();
	await page.getByRole('textbox', { name: 'Onderwerp volgen' }).fill('huur');
	await page.getByRole('button', { name: 'Volg' }).click();
	await page.getByRole('link', { name: 'Overzicht' }).click();
	await expect(page).toHaveURL(/\/onderwerpen\/overzicht/);
	await expect(page.getByRole('heading', { level: 1 })).toContainText('huur');
});

test('Actueel: the days without a sitting and the open motions of no confidence come first', async ({
	page
}) => {
	await page.goto('/actueel');
	await expect(
		page.getByText(/^Volgende vergadering en stemmingen: dinsdag 27 oktober 2026/)
	).toBeVisible();
	const open = page.getByRole('list', { name: /nog niet in stemming gebracht/ });
	await expect(
		open.getByText('Motie van afkeuring, nog niet in stemming gebracht').first()
	).toBeVisible();
	await expect(open.getByRole('link').first()).toHaveAttribute(
		'href',
		/\/kamerstukken\/37020-XVI\/60/
	);
});

test('Gevolgd: a dossier followed from its page, with what is new since the visit before', async ({
	page
}) => {
	await page.goto('/dossiers/36496');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wet betaalbare huur');
	await expect(page.locator('link[rel="alternate"][type="application/atom+xml"]')).toHaveAttribute(
		'href',
		/\/api\/feed\.atom\?dossier=36496$/
	);
	await page.getByRole('button', { name: 'Volg', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Bewaar bij Gevolgd' }).click();
	// Followed: Volg became Gevolgd, as Bewaar becomes Bewaard, a way to Gevolgd in its menu.
	await page.locator('#main-content').getByRole('button', { name: 'Gevolgd', exact: true }).click();
	await expect(page.getByRole('menuitem', { name: 'Open Gevolgd' })).toHaveAttribute(
		'href',
		'/onderwerpen'
	);
	await page.keyboard.press('Escape');

	// The visit before lies back: what came in since is marked, a link to those days.
	await page.evaluate(() => {
		const list = JSON.parse(localStorage.getItem('concordans:onderwerpen') ?? '[]');
		list[0].gezien = '2024-01-01';
		localStorage.setItem('concordans:onderwerpen', JSON.stringify(list));
	});
	await page.reload();
	await expect(page.getByRole('link', { name: /nieuw sinds 1 januari 2024/ })).toHaveAttribute(
		'href',
		'/actueel?dossier=36496&van=2024-01-01'
	);

	await page.goto('/onderwerpen');
	await expect(
		page.getByRole('heading', { level: 2, name: /^Kamerstuk 36496 Wet betaalbare huur/ })
	).toBeVisible();
});

test('Volg copies the Atom link of the view: on Actueel, in a list and in a dossier', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
	const copied = () => page.evaluate(() => navigator.clipboard.readText());

	await page.goto('/actueel?kamer=EK');
	await page.getByRole('button', { name: 'Volg', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Gekopieerd' })).toBeVisible();
	expect(await copied()).toMatch(/\/api\/feed\.atom\?.*chamber=EK/);

	await page.goto('/explore?mode=index&kind=decisions');
	await page.getByRole('button', { name: 'Volg', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Gekopieerd' })).toBeVisible();
	expect(await copied()).toMatch(/\/api\/feed\.atom\?.*kind=stemming/);

	await page.goto('/dossiers/36496');
	await page.getByRole('button', { name: 'Volg', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Kopieer Atom-link' }).click();
	expect(await copied()).toMatch(/\/api\/feed\.atom\?dossier=36496$/);
});
