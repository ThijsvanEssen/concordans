// Filling the bundels the way a reader does: from the readers, with Bewaar and the menu of a
// lid or a rechtsoverweging. The bundels live in the browser (localStorage), so each test
// starts empty.
import type { BrowserContext, Page } from '@playwright/test';
import { expect } from './test';

export const ARTICLE = '/wetten/BWBR0005289/artikel/6:162';
export const JUDGMENT = '/uitspraken/ECLI:NL:HR:2019:2006';

/** Bewaar on the article 6:162 BW: into Losse markeringen. */
export async function keepArticle(page: Page) {
	await page.goto(ARTICLE);
	await page.getByRole('button', { name: 'Bewaar', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Bewaard', exact: true })).toBeVisible();
}

/** Lid 2 of 6:162 BW and r.o. 5.3.2 of Urgenda, each through its own menu. */
export async function keepPlaces(page: Page) {
	await page.goto(ARTICLE);
	await page.getByRole('button', { name: 'art. 6:162 lid 2 BW: citeren, bewaren' }).click();
	await page.getByRole('menuitem', { name: 'Bewaar in Losse markeringen' }).click();
	await page.goto(JUDGMENT);
	await page.getByRole('button', { name: 'Overweging 5.3.2: citeren, bewaren' }).click();
	await page.getByRole('menuitem', { name: 'Bewaar in Losse markeringen' }).click();
}

/** What the page puts on the clipboard, read back by the test (headless has no clipboard). */
export async function catchClipboard(context: BrowserContext) {
	await context.addInitScript(() => {
		const copied: string[] = [];
		Object.defineProperty(window, '__copied', { value: copied });
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: async (text: string) => void copied.push(text) }
		});
	});
	return (page: Page) =>
		page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.at(-1));
}

/**
 * Selects `words` in a place of the text as a reader does: a drag with the mouse; on touch
 * the selection a long press leaves (made in the page: a browser under test cannot
 * long-press), the finger still down: `letGo` lifts it, after which the menu opens once the
 * selection rests.
 */
export async function selectWords(page: Page, place: string, words: string, touch: boolean) {
	const box = await page.evaluate(
		({ place, words, touch }) => {
			const el = document.querySelector(`[data-plaats="${place}"]`)!;
			const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				const i = (n as Text).data.indexOf(words);
				if (i < 0) continue;
				const range = document.createRange();
				range.setStart(n, i);
				range.setEnd(n, i + words.length);
				const r = range.getBoundingClientRect();
				if (touch) {
					n.parentElement!.dispatchEvent(
						new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })
					);
					n.parentElement!.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
					getSelection()!.removeAllRanges();
					getSelection()!.addRange(range);
				}
				return { x: r.x, y: r.y + r.height / 2, w: r.width };
			}
			throw new Error(`${words} not in ${place}`);
		},
		{ place, words, touch }
	);
	if (touch) return;
	await page.mouse.move(box.x + 1, box.y);
	await page.mouse.down();
	await page.mouse.move(box.x + box.w - 1, box.y, { steps: 6 });
	await page.mouse.up();
}

/** The finger that selected words lifted from the glass. */
export const letGo = (page: Page) =>
	page.evaluate(() => document.dispatchEvent(new TouchEvent('touchend', { bubbles: true })));
