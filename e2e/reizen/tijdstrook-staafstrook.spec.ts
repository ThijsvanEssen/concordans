// The Tijdstrook as a bar strip (besluit 41): a stacked bar per year on a scale relative to the
// busiest year, the period in words at the left with its quick choices and the date fields, the
// years named under the bars without touching them; a phone shows it small and opens a Blad.
import { expect, test } from '../support/test';

const URL = '/wetten/BWBR0005289/artikel/6:162?mode=netwerk';

async function strook(page: import('@playwright/test').Page) {
	await page.goto(URL);
	const root = page.locator('.tijdstrook');
	await expect(root).toBeVisible();
	await expect(root.locator('.deel').first()).toBeVisible();
	return root;
}

/** No name of a year over a bar: the boxes of the years and of the bars do not cross. */
async function noOverlap(root: import('@playwright/test').Locator) {
	const years = await root
		.locator('.as span')
		.evaluateAll((els) =>
			els
				.map((e) => e.getBoundingClientRect())
				.map((r) => ({ t: r.top, b: r.bottom, l: r.left, r: r.right }))
		);
	const bars = await root
		.locator('.staaf, .leeg')
		.evaluateAll((els) =>
			els.map((e) => e.getBoundingClientRect()).map((r) => ({ t: r.top, b: r.bottom }))
		);
	expect(years.length).toBeGreaterThanOrEqual(2);
	const bottom = Math.max(...bars.map((b) => b.b));
	for (const y of years) expect(y.t).toBeGreaterThanOrEqual(bottom + 4 - 0.5);
	// Names of years never touch each other.
	const sorted = [...years].sort((a, b) => a.l - b.l);
	for (let i = 1; i < sorted.length; i++)
		expect(sorted[i].l).toBeGreaterThanOrEqual(sorted[i - 1].r);
}

test('the years stand under the bars, apart from them and from each other', async ({ page }) => {
	const root = await strook(page);
	await noOverlap(root);
	const jaren = await root.locator('.as span').allTextContents();
	const band = (await root.locator('.band, .mini').first().boundingBox())!;
	expect(band.height).toBeGreaterThan(0);
	// The first and the last year are always named.
	expect(Number(jaren.at(-1))).toBeGreaterThan(Number(jaren[0]));
});

test('desktop: quick choices and the date fields choose the period', async ({ page, touch }) => {
	test.skip(touch, 'a phone has them in the Blad (below)');
	const root = await strook(page);
	await root.getByRole('button', { name: '5 jaar' }).click();
	await expect(page).toHaveURL(/[?&]van=\d{4}-01-01/);
	await expect(page).not.toHaveURL(/[?&]tot=/);
	await expect(root.getByRole('button', { name: '5 jaar' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await root.getByRole('button', { name: 'Alle jaren' }).click();
	await expect(page).not.toHaveURL(/[?&]van=/);

	// The period in words opens the date fields; the fields replace Periode in the left strip.
	await root.locator('.woorden').click();
	const dialog = page.getByRole('dialog', { name: 'Periode' });
	await expect(dialog).toBeVisible();
	await dialog.getByLabel('van').fill('1-3-2020');
	await dialog.getByRole('button', { name: 'Toepassen' }).click();
	await expect(page).toHaveURL(/[?&]van=2020-03-01/);
	await expect(root.locator('.woorden')).toContainText('1 mrt 2020');
	await expect(page.locator('.legend, aside').getByText('Periode', { exact: true })).toHaveCount(0);
});

test('the grips are sliders: the keyboard chooses the period without dragging', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a phone has its grips in the Blad');
	const root = await strook(page);
	const tot = root.getByRole('slider', { name: 'Tot' });
	await tot.focus();
	await page.keyboard.press('ArrowLeft');
	await expect(page).toHaveURL(/[?&]tot=\d{4}-12-31/);
	await expect(root.getByRole('slider', { name: 'Van' })).toBeAttached();
	await expect(root.locator('.kaart')).toBeVisible();
});

test('desktop: a hover on a year shows the count per kind', async ({ page, touch }) => {
	test.skip(touch, 'hover');
	const root = await strook(page);
	const box = (await root.locator('.band').boundingBox())!;
	await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2);
	await expect(root.locator('.kaart')).toBeVisible();
});

test('phone: a tap on the strip opens a Blad with grips of 44 px and the quick choices', async ({
	page,
	touch
}) => {
	test.skip(!touch, 'a phone');
	const root = await strook(page);
	expect((await root.boundingBox())!.height).toBeLessThanOrEqual(72);
	await root.getByRole('button', { name: /^Periode/ }).click();
	const blad = page.getByRole('dialog', { name: 'Periode' });
	await expect(blad).toBeVisible();
	await noOverlap(blad);
	const wide = await blad
		.getByRole('slider', { name: 'Van' })
		.evaluate((e) => parseFloat(getComputedStyle(e, '::before').width));
	expect(wide).toBeGreaterThanOrEqual(44);
	await blad.getByRole('button', { name: '5 jaar' }).click();
	await expect(page).toHaveURL(/[?&]van=\d{4}-01-01/);
	await blad.getByRole('button', { name: 'Sinds…' }).click();
	await expect(
		page.getByRole('dialog', { name: 'Periode' }).last().getByLabel('van')
	).toBeVisible();
});
