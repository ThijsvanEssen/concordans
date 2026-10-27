// The keten as the Design System draws it: a Kamerlid's fracties and commissies each in an
// omhulling with its name in a pill, and the lines of a judgment's keten counted as Aanhaling.
import { expect, test } from '../support/test';

// The drawing is for a wide screen; on a phone the keten is a list.
test.skip(({ isMobile }) => isMobile, 'a list on a phone');

test('the keten of a Kamerlid holds its fracties and commissies in an omhulling', async ({
	page
}) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	await expect(page.locator('.hull').first()).toBeVisible();
	await expect(page.locator('.pil').first()).toBeVisible();
});

test('the keten of a judgment counts the lines it draws as Aanhaling', async ({ page }) => {
	await page.goto('/uitspraken/ECLI:NL:HR:2019:2006?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	await expect(page.locator('.line')).toHaveCount(3);
	await expect(page.getByText('Aanhaling').first()).toBeVisible();
});

test('no name of the keten leaves the drawing or is cut', async ({ page }) => {
	await page.goto('/uitspraken/ECLI:NL:HR:2019:2006?mode=netwerk&weergave=keten');
	const chain = page.getByRole('group', { name: 'Keten' });
	await expect(chain).toBeVisible();
	const { frame, names } = await chain.evaluate((svg) => {
		const f = svg.getBoundingClientRect();
		return {
			frame: { x: f.x, right: f.right },
			names: [...svg.querySelectorAll('.name')].map((n) => {
				const r = n.getBoundingClientRect();
				return { x: r.x, right: r.right, text: n.textContent ?? '' };
			})
		};
	});
	expect(names.length).toBeGreaterThan(0);
	for (const n of names) {
		expect(n.x).toBeGreaterThanOrEqual(frame.x - 1);
		expect(n.right).toBeLessThanOrEqual(frame.right + 1);
		expect(n.text).not.toContain('…');
	}
});

test('the keten of a Kamerlid names each layer once: Ministerie is no Kamerlid', async ({
	page
}) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	const labels = (await page.locator('.chain .layer-label').allTextContents()).map((t) =>
		t.trim().toLowerCase()
	);
	expect(new Set(labels).size).toBe(labels.length);
});
