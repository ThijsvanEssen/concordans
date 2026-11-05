// The keten stands as soon as its regulations are in; the wetten that only name the law
// (`related-instruments`) come later, cold up to 5 s, in the layer Noemt under all the rest (B109).
// What stands stays where it is: the layers, the law, the regulations. At 1440 and on a phone.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { noemt } from '../support/noemt';

const WVW = '/explore?netwerk=instruments/bwbr0006622&weergave=keten';
const GRONDWET = '/explore?netwerk=instruments/bwbr0001840&weergave=keten';
const LATE = 2_000;
const NAAR_NOEMT = /^Genoemd in \d+ wet(ten)?$/;

/** Where every layer heading, and on a wide screen every bron, stands (page coordinates). */
const standing = (page: Page) =>
	page.evaluate(() => {
		const at = (el: Element) => {
			const r = el.getBoundingClientRect();
			return [Math.round(r.x), Math.round(r.y + scrollY)];
		};
		const drawing = document.querySelector('svg.drawing');
		const shown = (el: Element) => (el as HTMLElement | SVGElement).getClientRects().length > 0;
		const heads = [
			...document.querySelectorAll('svg.drawing .layer-label, .list .list__head')
		].filter(shown);
		const nodes = drawing ? [...drawing.querySelectorAll('g.node')].filter(shown) : [];
		return Object.fromEntries([
			...heads.map((el) => [`kop ${el.textContent?.trim().toLowerCase()}`, at(el)]),
			...nodes.map((el) => [el.textContent?.trim(), at(el)])
		]) as Record<string, number[]>;
	});

for (const [name, url] of [
	['WVW', WVW],
	['Grondwet', GRONDWET]
] as const)
	test(`the ${name} keten stays put when the wetten that name it come late`, async ({
		page,
		touch
	}) => {
		if (!touch) await page.setViewportSize({ width: 1440, height: 900 });
		// At least LATE, and until what stands is measured, however slow the machine.
		let measured = () => {};
		const held = new Promise<void>((done) => (measured = done));
		await page.route(/\/related-instruments\b/, async (route) => {
			await Promise.all([held, new Promise((done) => setTimeout(done, LATE))]);
			await route.fallback();
		});
		await page.goto(url);
		await expect(page.getByText('AMvB', { exact: false }).first()).toBeAttached();
		const amvb = touch
			? page.locator('.list__head', { hasText: 'AMvB' })
			: page.locator('svg.drawing .layer-label', { hasText: 'AMVB' });
		await expect(amvb).toBeVisible();
		await page.waitForTimeout(500);
		const before = await standing(page);
		measured();
		const noemt = touch
			? page.locator('.list__head', { hasText: 'Noemt' })
			: page.locator('svg.drawing .layer-label', { hasText: 'NOEMT' });
		await expect(noemt).toBeVisible({ timeout: LATE + 5_000 });
		await page.waitForTimeout(250);
		const after = await standing(page);
		for (const [what, place] of Object.entries(before))
			expect(after[what], `${what} stays where it stood`).toEqual(place);
		// Noemt under all the rest.
		const heads = Object.entries(after).filter(([k]) => k.startsWith('kop '));
		const lowest = heads.reduce((a, b) => (a[1][1] > b[1][1] ? a : b));
		expect(lowest[0]).toBe('kop noemt');
		await expect(page.getByRole('button', { name: NAAR_NOEMT })).toBeVisible();
	});

for (const [name, url] of [
	['WVW', WVW],
	['Grondwet', GRONDWET]
] as const)
	test(`Genoemd in of the ${name} keten counts the layer Noemt and takes you there`, async ({
		page,
		touch
	}) => {
		if (!touch) await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(url);
		const naar = page.getByRole('button', { name: NAAR_NOEMT });
		await expect(naar).toBeVisible();
		// What the layer draws, and those under its "N andere".
		const layer = touch ? page.locator('.list__layer[aria-label="Noemt"]') : null;
		const drawn = layer
			? await layer.locator('.list__row').count()
			: await page.locator('g.node[data-layer="named"]').count();
		const other = layer ? layer.locator('.alle') : page.locator('.others[data-layer="named"]');
		const others = (await other.count()) ? parseInt((await other.textContent())!) : 0;
		const shown = parseInt((await naar.innerText()).replace(/\D/g, ''));
		expect(shown).toBe(drawn + others);
		await naar.click();
		const head = touch
			? page.locator('.list__head', { hasText: 'Noemt' })
			: page.locator('svg.drawing .layer-label', { hasText: 'NOEMT' });
		await expect(head).toBeInViewport();
		// The keyboard goes on from its first bron.
		const focused = touch
			? page.locator('.list__layer[aria-label="Noemt"] .list__row').first()
			: page.locator('g.node[data-layer="named"]').first();
		await expect(focused).toBeFocused();
		await expect(focused).toBeInViewport();
		// And Tab to the next of the layer, in view too.
		await page.keyboard.press('Tab');
		const next = touch
			? page.locator('.list__layer[aria-label="Noemt"] .list__row').nth(1)
			: page.locator('g.node[data-layer="named"]').nth(1);
		await expect(next).toBeFocused();
		await expect(next).toBeInViewport();
	});

test('with Noemt off there is no Genoemd in, and nothing above it moved for it', async ({
	page,
	touch
}) => {
	if (!touch) await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(WVW);
	await expect(page.getByRole('button', { name: NAAR_NOEMT })).toBeVisible();
	const amvb = () =>
		(touch
			? page.locator('.list__head', { hasText: 'AMvB' })
			: page.locator('svg.drawing .layer-label', { hasText: 'AMVB' })
		).boundingBox();
	const before = (await amvb())!.y;
	const naarCount = page.getByRole('button', { name: NAAR_NOEMT }).innerText();
	await noemt(page);
	await expect(page.getByRole('button', { name: NAAR_NOEMT })).toHaveCount(0);
	if (touch) expect((await amvb())!.y).toBe(before);
	// Back on: the same count, the layer again, nothing else moved.
	const count = await naarCount;
	await noemt(page);
	await expect(page.getByRole('button', { name: NAAR_NOEMT })).toHaveText(count);
	await expect(
		page
			.locator('.list__head, svg.drawing .layer-label')
			.filter({ hasText: /^noemt$/i })
			.first()
	).toBeAttached();
	expect((await amvb())!.y).toBe(before);
});

test('a law without a wet that names it has no heading Noemt', async ({ page }) => {
	await page.route(/\/related-instruments\b/, (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			headers: { 'access-control-allow-origin': '*' },
			body: JSON.stringify({ bwb_id: 'BWBR0006622', total: 0, items: [] })
		})
	);
	await page.goto(WVW);
	await expect(page.getByText('AMvB', { exact: false }).first()).toBeAttached();
	await page.waitForLoadState('networkidle');
	await expect(
		page.locator('.list__head, svg.drawing .layer-label').filter({ hasText: /^noemt$/i })
	).toHaveCount(0);
	await expect(page.getByRole('button', { name: NAAR_NOEMT })).toHaveCount(0);
});
