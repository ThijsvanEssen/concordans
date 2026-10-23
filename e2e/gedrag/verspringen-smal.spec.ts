// Below 1280 the columns of a reader stand from the first paint (UX-toets T9, A190): the text,
// the contents and Verbonden do not move while the bron, its list and Verbonden come in. The
// layout shift of the whole load stays at nothing to speak of, at 1024 and on a phone.
import { expect, test } from '../support/test';

const PAGES = [
	{ what: 'a dossier', path: '/dossiers/36764' },
	{ what: 'a law', path: '/wetten/BWBR0052872' },
	{ what: 'an article', path: '/wetten/BWBR0005289/artikel/6:162' }
];

for (const p of PAGES) {
	test(`${p.what} comes in below 1280 without a shift`, async ({ page, touch }) => {
		if (!touch) await page.setViewportSize({ width: 1024, height: 800 });
		await page.addInitScript(() => {
			const w = window as unknown as { __cls: number };
			w.__cls = 0;
			new PerformanceObserver((list) => {
				for (const e of list.getEntries() as (PerformanceEntry & {
					value: number;
					hadRecentInput: boolean;
				})[])
					if (!e.hadRecentInput) w.__cls += e.value;
			}).observe({ type: 'layout-shift', buffered: true });
		});
		await page.goto(p.path);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: 'Verbonden' })).toBeAttached();
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);
		const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
		expect(cls, 'layout shift of the load').toBeLessThanOrEqual(0.05);
	});
}
