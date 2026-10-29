// The room of a netwerk of several wetten (B37): Cbb, Cbw and Sr, the last with thousands of
// neighbours, each keep their own articles in their hull; none is left a bare square.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const NETWERK =
	'/explore?mode=netwerk&netwerk=instruments/bwbr0052875,instruments/bwbr0052872,instruments/bwbr0001854';
const lijst = (page: Page) => page.locator('.canvas-node-list a');

test('three chosen wetten, one of them very large, each stand with their articles', async ({
	page
}) => {
	await page.goto(NETWERK);
	// Each wet's articles stand in a group of their own (Cbb was left a bare square when it came
	// first and the large Sr took the room).
	await expect(lijst(page).filter({ hasText: /^\d+ artikelen, groep$/ })).toHaveCount(3);
});

// Aantal stappen stays open for a large wet: Cbw at two steps is drawn with its most important
// bronnen, and the panel says in a line that this is not all of it.
test('Cbw at two steps is drawn, no step greyed out, and the panel says it is not complete', async ({
	page,
	touch
}) => {
	await page.goto('/explore?mode=netwerk&netwerk=instruments/bwbr0052872&diepte=2');
	if (touch) await page.getByRole('button', { name: 'Weergave', exact: true }).click();
	const stappen = page.getByRole('group', { name: 'Aantal stappen' });
	await expect(stappen.getByRole('button', { name: '2 stappen' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	for (const naam of ['1 stap', '2 stappen', '3 stappen'])
		await expect(stappen.getByRole('button', { name: naam })).toBeEnabled();
	await expect(
		page.getByRole('note').filter({ hasText: /^2 stappen: de belangrijkste 400/ })
	).toBeVisible();
	await expect(page.getByText(/Maximaal \d+ bronnen getoond/)).toHaveCount(0);
	await expect(lijst(page).filter({ hasText: /^\d+ artikelen, groep$/ })).toHaveCount(1);
});

// A dossier is an island with its stukken only: however many, its disc never holds the wet
// that its stukken also cite (the Cbw stood in the disc of dossier 36764 at two steps).
for (const diepte of [1, 2]) {
	test(`Cbw at ${diepte} step(s): no dossier disc holds the wet`, async ({ page, touch }) => {
		test.skip(touch, 'the discs are measured at one width');
		await page.goto(`/explore?mode=netwerk&netwerk=instruments/bwbr0052872&diepte=${diepte}`);
		await expect(
			lijst(page)
				.filter({ hasText: /^\d+ artikelen, groep$/ })
				.or(page.locator('.hull-label').filter({ hasText: /^Cbw$/ }))
				.first()
		).toBeAttached();
		await page.waitForLoadState('networkidle');
		const discs = await page.evaluate(() =>
			[...document.querySelectorAll('.hull-overlay path.hull')].map((e) => {
				const m = /M ([-\d.e]+) ([-\d.e]+) A ([-\d.e]+)/.exec(e.getAttribute('d') ?? '');
				return m ? { x: +m[1] + +m[3], y: +m[2], r: +m[3] } : null;
			})
		);
		// The smallest disc is the wet's (its articles); no other holds its middle.
		const all = discs.filter((d): d is { x: number; y: number; r: number } => !!d);
		const wet = all.reduce((a, b) => (b.r < a.r ? b : a));
		for (const d of all.filter((d) => d !== wet))
			expect(Math.hypot(d.x - wet.x, d.y - wet.y), 'a disc holds the wet').toBeGreaterThan(d.r);
	});
}
