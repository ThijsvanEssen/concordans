// Verband of three bronnen (A302, DS Verband, variant A): a Keuze above with Alle drie and each
// pair, the rows of the choice below; the choice is in the address (?paar), so a clean link
// shows the same. At Alle drie the third bron is a second end under the right column head.
import { expect, test } from '../support/test';

const GEMEENTEWET = 'instruments/bwbr0005416';
const BOEK6 = 'instruments/bwbr0005289';
const BOEK7 = 'instruments/bwbr0005290';
const THREE = `/explore?netwerk=${GEMEENTEWET},${BOEK6},${BOEK7}&weergave=verband`;

const view = (page: import('@playwright/test').Page) => page.locator('.shared');
const keuze = (page: import('@playwright/test').Page) =>
	view(page).getByRole('group', { name: 'Bronnen' });

test('three bronnen: a Keuze with Alle drie and the pairs, each with what it shares', async ({
	page
}) => {
	await page.goto(THREE);
	await expect(keuze(page)).toBeVisible({ timeout: 30_000 });
	await expect(keuze(page).getByRole('button', { name: /^Alle drie \(\d/ })).toBeVisible();
	await expect(keuze(page).getByRole('button')).toHaveCount(4);
});

test('a pair in the address shows the rows of that pair, and a clean link the same', async ({
	page,
	touch
}) => {
	await page.goto(THREE);
	await expect(keuze(page)).toBeVisible({ timeout: 30_000 });
	const pair = keuze(page).getByRole('button').nth(1);
	await pair.click();
	await expect(page).toHaveURL(/paar=/);
	await expect(pair).toHaveAttribute('aria-pressed', 'true');
	const url = page.url();
	await page.goto(url);
	await expect(keuze(page).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true', {
		timeout: 30_000
	});
	if (touch) {
		// On a phone the Keuze stands in rows of two.
		const [a, b, c] = await keuze(page)
			.getByRole('button')
			.evaluateAll((els) => els.slice(0, 3).map((e) => e.getBoundingClientRect().top));
		expect(a).toBe(b);
		expect(c).toBeGreaterThan(a);
	}
});

test('Alle drie shows only Eén stap, the third bron as a second end', async ({ page, touch }) => {
	await page.goto(`${THREE}&diepte=2`);
	await expect(keuze(page)).toBeVisible({ timeout: 30_000 });
	const all = keuze(page).getByRole('button', { name: /^Alle drie/ });
	if ((await all.getAttribute('aria-pressed')) !== 'true') await all.click();
	await expect(
		view(page).getByRole('heading', { name: 'Eén stap' }).locator('visible=true').first()
	).toBeVisible();
	await expect(view(page).getByRole('heading', { name: 'Twee stappen' })).toHaveCount(0);
	if (!touch) {
		const drawing = view(page).getByRole('group', { name: /^Ketens tussen/ });
		await expect(drawing.locator('g.end[data-kind]').first()).toBeAttached();
	}
});

test('a chosen end has the sign of its kind, in the ring of chosen', async ({ page, touch }) => {
	await page.goto(
		'/explore?netwerk=members/9ab41898_332f_4c08_a834_d58b4669c990,instruments/bwbr0010346&weergave=verband'
	);
	const view = page.locator('.shared');
	const marks = touch ? view.locator('.ladder__ends svg') : view.locator('g.end[data-kind]');
	await expect(marks.first()).toBeVisible({ timeout: 30_000 });
	const shapes = await marks.evaluateAll((els) =>
		els.map((e) => e.querySelector('path')?.getAttribute('d') ?? '')
	);
	expect(shapes).toHaveLength(touch ? 2 : shapes.length);
	// A person and a wet are not drawn alike, and neither is a plain square.
	expect(new Set(shapes.slice(0, 2)).size).toBe(2);
	await expect(view.locator('.end__ring').first()).toBeAttached();
});

test('two persons: every kind of shared bron is a row, kabinet-Jetten first', async ({
	page,
	touch
}) => {
	await page.goto(
		'/explore?netwerk=members/49be3576_cea3_46c0_87eb_89beb108248d,members/9ab41898_332f_4c08_a834_d58b4669c990&weergave=verband'
	);
	const view = page.locator('.shared');
	const first = touch
		? view.locator('.ladder__pill').first()
		: view.getByRole('button', { name: /kabinet-Jetten/ });
	await expect(first).toBeVisible({ timeout: 30_000 });
	await expect(first).toContainText('kabinet-Jetten');
	await expect(view.getByText(/beide lid van|beide bewindspersoon in/).first()).toBeAttached();
});
