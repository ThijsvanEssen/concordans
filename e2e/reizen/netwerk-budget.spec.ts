// The room of a netwerk of several wetten (B37): Cbb, Cbw and Sr, the last with thousands of
// neighbours, each keep their own articles in their hull; none is left a bare square.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const NETWERK =
	'/explore?mode=netwerk&netwerk=instruments/bwbr0052875,instruments/bwbr0052872,instruments/bwbr0001854&doek=sigma';
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
	await page.goto('/explore?mode=netwerk&netwerk=instruments/bwbr0052872&diepte=2&doek=sigma');
	if (touch) await page.getByRole('button', { name: 'Weergave', exact: true }).click();
	const stappen = page.getByRole('group', { name: 'Aantal stappen' });
	await expect(stappen.getByRole('button', { name: '2 stappen' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	for (const naam of ['1 stap', '2 stappen', '3 stappen'])
		await expect(stappen.getByRole('button', { name: naam })).toBeEnabled();
	await expect(page.getByText(/Maximaal \d+ bronnen getoond/)).toHaveCount(0);
	await expect(lijst(page).filter({ hasText: /^\d+ artikelen, groep$/ })).toHaveCount(1);
});

// A dossier is an island with its stukken only: however many, its disc never holds the wet
// that its stukken also cite (the Cbw stood in the disc of dossier 36764 at two steps), nor goes
// round the dossiers it is related to (B130: 29023 round dossiers at either side of the Cbw).
for (const diepte of [1, 2]) {
	test(`Cbw at ${diepte} step(s): no dossier disc holds the wet`, async ({ page, touch }) => {
		test.skip(touch, 'the discs are measured at one width');
		await page.goto(
			`/explore?mode=netwerk&netwerk=instruments/bwbr0052872&diepte=${diepte}&doek=sigma`
		);
		await expect(
			lijst(page)
				.filter({ hasText: /^\d+ artikelen, groep$/ })
				.or(page.locator('.hull-label').filter({ hasText: /^Cbw$/ }))
				.first()
		).toBeAttached();
		await page.waitForLoadState('networkidle');
		const { discs, wet: label } = await page.evaluate(() => {
			const px = (e: Element, v: string) =>
				parseFloat(getComputedStyle(e as HTMLElement).getPropertyValue(v));
			const cbw = [...document.querySelectorAll('.hull-label')].find(
				(e) => e.textContent?.trim() === 'Cbw'
			);
			return {
				discs: [...document.querySelectorAll('.hull-overlay path.hull')].map((e) => {
					const m = /M ([-\d.e]+) ([-\d.e]+) A ([-\d.e]+)/.exec(e.getAttribute('d') ?? '');
					return m ? { x: +m[1] + +m[3], y: +m[2], r: +m[3] } : null;
				}),
				wet: cbw ? { x: px(cbw, '--x'), y: px(cbw, '--y') } : null
			};
		});
		// The wet's disc is the one under its name; no larger disc holds its middle (the small
		// discs of the European articles beside it hold nothing).
		const all = discs.filter((d): d is { x: number; y: number; r: number } => !!d);
		expect(label, 'the wet is named').not.toBeNull();
		const top = (d: { x: number; y: number; r: number }) =>
			Math.hypot(d.x - label!.x, d.y - d.r - label!.y);
		const wet = all.reduce((a, b) => (top(b) < top(a) ? b : a));
		for (const d of all.filter((d) => d !== wet && d.r > wet.r))
			expect(Math.hypot(d.x - wet.x, d.y - wet.y), 'a disc holds the wet').toBeGreaterThan(d.r);
	});
}
