// The top bar fits at every width (B87): at its widest, on a bron with a netwerk and the sign at
// Mijn, nothing passes the edge of the bar or of the page, and every control stays whole.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const OP_BRON = '/wetten/BWBR0005289/artikel/6:162?mode=netwerk&netwerk=instruments/bwbr0005289';
const ELDERS = '/docs';

async function past(page: Page, width: number) {
	await page.setViewportSize({ width, height: 800 });
	const maat = await page.evaluate(() => {
		const balk = document.querySelector<HTMLElement>('.topbar')!;
		const rechts = document.querySelector('.topbar-right')?.getBoundingClientRect().right ?? 0;
		return {
			balk: balk.scrollWidth - balk.clientWidth,
			pagina: document.documentElement.scrollWidth - innerWidth,
			rechts: rechts - innerWidth,
			knop: document.querySelector<HTMLElement>('.search-trigger')?.offsetWidth ?? 0
		};
	});
	expect(maat.balk, `balk op ${width}`).toBeLessThanOrEqual(0);
	expect(maat.pagina, `pagina op ${width}`).toBeLessThanOrEqual(0);
	expect(maat.rechts, `rechterrand op ${width}`).toBeLessThanOrEqual(0);
	// The search field never folds below its icon: 13 px, its padding and the border.
	if (width > 768) expect(maat.knop, `zoekknop op ${width}`).toBeGreaterThanOrEqual(39);
}

for (const [naam, url] of [
	['on a bron with a netwerk', OP_BRON],
	['elsewhere', ELDERS]
])
	test(`the top bar fits at every width, ${naam}`, async ({ page, touch }) => {
		test.skip(touch, 'the widths are set here');
		await page.goto(url);
		await expect(page.locator('.topbar')).toBeVisible();
		if (url === OP_BRON) {
			await expect(page.locator('.lees-keuze')).toBeVisible();
			// The sign at Mijn takes room of its own, and the longest name stops at its measure.
			await page.evaluate(() => {
				const mijn = document.querySelector('.mine-slot button');
				mijn?.insertAdjacentHTML('beforeend', '<span style="margin-left:4px">•</span>');
				const naam = document.querySelector('.lees-keuze__naam');
				if (naam) naam.textContent = ': Algemene wet bestuursrecht en meer';
			});
		}
		for (let width = 320; width <= 1480; width += 20) await past(page, width);
		for (const width of [768, 769, 840, 841, 1040, 1041, 1139, 1140, 1240, 1241, 1439, 1440])
			await past(page, width);
	});
