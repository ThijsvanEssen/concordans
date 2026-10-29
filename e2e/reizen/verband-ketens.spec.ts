// Verband at two and three steps (A284, DS Verband): the ketens through laws and articles
// between two chosen bronnen, from /api/chains, which takes 10 s cold. One step is what
// /api/nodes/shared shows; Aantal stappen is in the URL (?diepte), and a clean link gives the
// same drawing.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';

const BOEK6 = 'instruments/bwbr0005289';
const BOEK7 = 'instruments/bwbr0005290';
const PAIR = `/explore?netwerk=${BOEK6},${BOEK7}&weergave=verband`;

const shared = (page: Page) => page.locator('.shared');
const steps = (page: Page) =>
	page.getByRole('region', { name: 'Weergave' }).or(page.getByRole('dialog', { name: 'Weergave' }));

test('two steps add the block Twee stappen, with what was cut off said as N of M', async ({
	page,
	touch
}) => {
	await page.goto(`${PAIR}&diepte=2`);
	await expect(shared(page).getByRole('heading', { name: 'Twee stappen' })).toBeVisible({
		timeout: 30_000
	});
	await expect(shared(page).getByRole('heading', { name: 'Eén stap' })).toBeVisible();
	// 281 chains, the first 12 drawn.
	await expect(
		shared(page).getByText('12 van 281 ketens').locator('visible=true').first()
	).toBeVisible();
	if (touch) {
		const list = shared(page).getByRole('list', { name: /^Twee stappen/ });
		await expect(list.getByRole('listitem').first()).toBeVisible();
		// A tussenbron is a button, as on a wide screen.
		await expect(list.getByRole('button').first()).toBeVisible();
	} else {
		const drawing = shared(page).getByRole('group', { name: /^Ketens tussen/ });
		await expect(drawing).toBeVisible();
		// A pill and a tussenbron are buttons with their name and what they do.
		await expect(drawing.getByRole('button', { name: /tussenbron$/ }).first()).toHaveAccessibleName(
			/\S/
		);
		await expect(drawing.getByRole('button', { name: /noemt beide$/ }).first()).toBeVisible();
	}
});

test('Aantal stappen sets ?diepte and a clean link shows the same', async ({ page }) => {
	await page.goto(PAIR);
	await openSheet(page);
	const group = steps(page);
	await expect(group.getByRole('button', { name: '1 stap' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await group.getByRole('button', { name: '2 stappen' }).click();
	await expect(page).toHaveURL(/diepte=2/);
	await expect(shared(page).getByRole('heading', { name: 'Twee stappen' })).toBeVisible({
		timeout: 30_000
	});
	const url = page.url();
	await page.goto(url);
	await expect(shared(page).getByRole('heading', { name: 'Twee stappen' })).toBeVisible({
		timeout: 30_000
	});
});

test('Verband is offered from two chosen bronnen, not with one', async ({ page }) => {
	await page.goto(`/explore?netwerk=${BOEK6}`);
	await openSheet(page);
	const weergave = steps(page).getByRole('group', { name: 'Weergave' });
	await expect(weergave.getByRole('button', { name: 'Omgeving' })).toBeVisible();
	await expect(weergave.getByRole('button', { name: 'Verband' })).toHaveCount(0);
	await expect(page.getByText('Kies eerst een tweede bron.')).toHaveCount(0);
});

test('Omgeving with two bronnen has all the steps, Alleen gekozen first, and no line', async ({
	page
}) => {
	await page.goto(`/explore?netwerk=${BOEK6},${BOEK7}`);
	await openSheet(page);
	const group = steps(page).getByRole('group', { name: 'Aantal stappen' });
	await expect(group.getByRole('button').first()).toHaveText('Gekozen');
	await expect(group.getByRole('button', { name: '2 stappen' })).toBeVisible();
	await expect(page.getByText('Klik een bron op het canvas.')).toHaveCount(0);
	await expect(page.getByText('Alleen de gekozen bronnen tonen')).toHaveCount(0);
});

test('one bron brings 150 neighbours, as Tonen counts them (besluit 29)', async ({ page }) => {
	await page.goto(`/explore?netwerk=${BOEK7}`);
	await openSheet(page);
	const strip = page.getByRole('complementary', { name: 'Bronnen en filters' }).or(steps(page));
	await expect(strip.getByText(/^150 van [\d.]+$/).first()).toBeVisible({ timeout: 30_000 });
	await expect(strip.getByText(/^200 van /)).toHaveCount(0);
});

test('the ketens stand still while they load and say after 3 s that it takes longer', async ({
	page
}) => {
	let release!: () => void;
	const released = new Promise<void>((done) => (release = done));
	await page.route(/\/api\/chains/, async (route) => {
		await released;
		await route.fallback();
	});
	await page.goto(`${PAIR}&diepte=2`);
	// One step is there while the ketens are sought.
	await expect(shared(page).getByText('Ketens zoeken…')).toBeVisible({ timeout: 30_000 });
	await expect(shared(page).getByRole('heading', { name: 'Eén stap' })).toBeVisible();
	await expect(shared(page).getByText('Laden duurt langer dan gewoonlijk')).toBeVisible({
		timeout: 8_000
	});
	await expect(page.getByText(/konden niet/)).toHaveCount(0);
	release();
	await expect(shared(page).getByRole('heading', { name: 'Twee stappen' })).toBeVisible({
		timeout: 30_000
	});
	await expect(shared(page).getByText('Laden duurt langer dan gewoonlijk')).toHaveCount(0);
});

test('a pair without a keten says so, with what the search could not finish, and offers one more step', async ({
	page
}) => {
	await page.route(/\/api\/chains/, (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			headers: { 'access-control-allow-origin': '*' },
			body: JSON.stringify({
				ids: [BOEK6, BOEK7],
				max_steps: 2,
				limit: 12,
				blocks: [
					{ steps: 1, total: 0, complete: true, chains: [] },
					{ steps: 2, total: 0, complete: false, chains: [] }
				],
				nodes: [],
				edges: [],
				capped: false,
				partial: true
			})
		})
	);
	await page.route(/\/api\/nodes\/shared/, (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			headers: { 'access-control-allow-origin': '*' },
			body: JSON.stringify({ ids: [BOEK6, BOEK7], total: 0, buckets: [] })
		})
	);
	await page.goto(`${PAIR}&diepte=2`);
	await expect(
		shared(page).getByText('Geen keten gevonden binnen 2 stappen, het zoeken was niet volledig')
	).toBeVisible({ timeout: 30_000 });
	await shared(page).getByRole('button', { name: 'Zoek tot 3 stappen' }).click();
	await expect(page).toHaveURL(/diepte=3/);
});

test('a table not built yet (503) says the ketens are not available yet, with Opnieuw', async ({
	page,
	guard
}) => {
	guard.allow(/status of 503/);
	await page.route(/\/api\/chains/, (route) =>
		route.fulfill({
			status: 503,
			contentType: 'application/json',
			headers: { 'access-control-allow-origin': '*' },
			body: JSON.stringify({ detail: 'not built' })
		})
	);
	await page.goto(`${PAIR}&diepte=2`);
	await expect(shared(page).getByText('De ketens zijn nog niet beschikbaar.')).toBeVisible({
		timeout: 30_000
	});
	await expect(shared(page).getByRole('button', { name: 'Opnieuw' })).toBeVisible();
});

const GEMEENTEWET = 'instruments/bwbr0005416';

test('Verband writes a Kamerstuk by its notation in a pill, with lines and arrows, one step a chain too', async ({
	page,
	touch
}) => {
	await page.goto(`/explore?netwerk=${GEMEENTEWET},${BOEK6}&weergave=verband`);
	const view = shared(page);
	await expect(
		view.getByRole('heading', { name: 'Eén stap' }).locator('visible=true').first()
	).toBeVisible({
		timeout: 30_000
	});
	if (touch) {
		await expect(view.locator('.ladder__ends')).toContainText('Gemeentewet');
		await expect(view.locator('.ladder__ends')).not.toContainText('Gemw');
		await expect(view.locator('.ladder__pill').first()).toContainText(
			/^\d+( ?-?[IVX]+)?, nr\. \d+ /
		);
	} else {
		const drawing = view.getByRole('group', { name: /^Ketens tussen/ });
		await expect(drawing).toBeVisible();
		await expect(drawing.getByText('Gemeentewet', { exact: true })).toBeVisible();
		const names = await drawing
			.getByRole('button')
			.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
		expect(names.some((n) => /^\d+(-[IVX]+)?, nr\. \d+ .*noemt beide$/.test(n))).toBe(true);
		expect(names.every((n) => !n.includes('…'))).toBe(true);
		// The lines have their kind's style: a dashed Aanhaling with an arrow.
		await expect(drawing.locator('path.line[stroke-dasharray]').first()).toBeAttached();
		await expect(drawing.locator('polygon.line').first()).toBeAttached();
	}
});

test('a tap on a pill marks its row: its ring, the other rows at 35 %, Escape wipes it', async ({
	page,
	touch
}) => {
	test.skip(touch, 'the ring is of the drawing');
	await page.goto(`/explore?netwerk=${GEMEENTEWET},${BOEK6}&weergave=verband`);
	const drawing = shared(page).getByRole('group', { name: /^Ketens tussen/ });
	const pills = drawing.getByRole('button', { name: /noemt beide$/ });
	await expect(pills.first()).toBeVisible({ timeout: 30_000 });
	await pills.first().click();
	await expect(pills.first()).toHaveAttribute('aria-pressed', 'true');
	await expect(drawing.locator('.ring')).toHaveCount(1);
	await expect(drawing.locator('.row.is-dim')).not.toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(drawing.locator('.ring')).toHaveCount(0);
});
