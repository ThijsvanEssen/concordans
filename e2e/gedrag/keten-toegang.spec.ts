// The keten for the keyboard and the eye: Tab reaches the law first, bron by bron from the top
// (B121); a layer's label never has a line through it, two labels never read alike (B111, B116);
// on a phone a weergave chosen in the sheet closes it (B111).
import { expect, test } from '../support/test';

const GRONDWET = '/explore?netwerk=instruments/bwbr0001840&weergave=keten';
const WVW = '/explore?mode=netwerk&netwerk=instruments/bwbr0006622';

test.describe('the drawing', () => {
	test.skip(({ isMobile }) => isMobile, 'a list on a phone');

	test('Tab reaches the law of the keten first, not after every label and stump (B121)', async ({
		page
	}) => {
		await page.goto(GRONDWET);
		const drawing = page.getByRole('group', { name: 'Keten' });
		await expect(drawing.locator('.node').first()).toBeVisible();
		// In the drawing the keyboard meets the law before anything else.
		const first = drawing.locator('[tabindex="0"], a[href]').first();
		await expect(first).toHaveAttribute('data-layer', 'law');
		// From the weergave's own choice it is a few steps: the links over the drawing, then the law.
		await page.getByRole('button', { name: 'Keten', exact: true }).focus();
		let steps = 0;
		while (steps < 12) {
			await page.keyboard.press('Tab');
			steps++;
			if (await page.evaluate(() => document.activeElement?.classList.contains('node'))) break;
		}
		await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Grondwet');
		expect(steps).toBeLessThan(12);
	});

	test('no line runs through the label of a layer (B111)', async ({ page }) => {
		await page.goto(GRONDWET);
		await expect(page.locator('svg.drawing .node').first()).toBeVisible();
		const through = await page.locator('svg.drawing').evaluate((svg) =>
			[...svg.querySelectorAll('text.layer-label')].flatMap((t) => {
				const b = t.getBoundingClientRect();
				const hits: string[] = [];
				for (let x = b.left + 1; x < b.right; x += 2)
					if (document.elementFromPoint(x, (b.top + b.bottom) / 2)?.matches('path.line'))
						hits.push(t.textContent ?? '');
				return hits;
			})
		);
		expect(through).toEqual([]);
	});

	test('two labels that name different articles never read alike (B116)', async ({ page }) => {
		await page.goto(GRONDWET);
		await expect(page.locator('svg.drawing a.cite').first()).toBeAttached();
		const cites = await page
			.locator('svg.drawing a.cite')
			.evaluateAll((as) =>
				as.map((a) => ({ text: a.textContent?.trim(), full: a.getAttribute('aria-label') }))
			);
		const alike = cites.filter((c) => cites.some((d) => d.text === c.text && d.full !== c.full));
		expect(alike).toEqual([]);
	});
});

test('on a phone the sheet closes on the weergave chosen, the keten in sight (B111)', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'the sheet is for a phone');
	await page.goto(WVW);
	const weergave = page.getByRole('button', { name: 'Weergave', exact: true });
	await weergave.click();
	await page.getByRole('button', { name: 'Keten', exact: true }).click();
	await expect(page).toHaveURL(/weergave=keten/);
	await expect(page.locator('.sheet')).toHaveCount(0);
	await expect(page.locator('.chain .list__row').first()).toBeVisible();
	await expect(weergave).toBeFocused();
});

test('on a phone the links over the keten are 44 px to a finger (B111, B116)', async ({
	page,
	touch
}) => {
	test.skip(!touch, 'a phone');
	await page.goto(`${WVW}&weergave=keten`);
	await expect(page.locator('.chain .list__row').first()).toBeVisible();
	const links = page.locator('.chain .kop').getByRole('button');
	await expect(links.first()).toBeVisible();
	const hoogtes = await links.evaluateAll((els) =>
		els.map((el) => {
			// The target as a finger meets it: the link and the shared target around it (.raakvlak).
			const q = el.getBoundingClientRect();
			const x = q.left + q.width / 2;
			const in_ = (y: number) => el.contains(document.elementFromPoint(x, y));
			let up = 0;
			while (up < 40 && in_(q.top - up - 0.5)) up++;
			let down = 0;
			while (down < 40 && in_(q.bottom + down + 0.5)) down++;
			return { naam: el.textContent?.trim(), hoogte: q.height + up + down };
		})
	);
	for (const h of hoogtes) expect.soft(h.hoogte, h.naam).toBeGreaterThanOrEqual(43.5);
});
