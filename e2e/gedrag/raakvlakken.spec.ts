// A finger's target on a phone, for the links as well as the buttons (WCAG 2.5.8; tikvlak.spec.ts
// has the buttons of every kind of bron): the visible links and buttons of the pages a reader
// meets first are 44 px to the finger, measured as it meets them. Running text is out of the
// rule (2.5.8 "inline"): a link in a sentence of the law, a voetnoot mark.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { ARTICLE } from '../support/bundels';
import { naarVerbonden } from '../support/navigation';

/** Links that stand in a sentence (WCAG 2.5.8, inline) or are not for a finger at all. */
const INLINE = [
	// The law's own sentences: a reference or a defined term inside a lid (WCAG 2.5.8, inline).
	'[data-plaats] a',
	// The skip link shows for a keyboard only, never under a finger.
	'a.skip-link'
];

type Small = { naam: string; hoogte: number; plek: string };

/** The visible links and buttons of the page whose touch height is under 44 px. */
async function kleine(page: Page): Promise<Small[]> {
	return page.evaluate((inline) => {
		const found: Small[] = [];
		const seen = new Set<Element>();
		const els = [...document.querySelectorAll<HTMLElement>('a[href], button')];
		for (const el of els) {
			if (seen.has(el)) continue;
			seen.add(el);
			if (inline.some((s) => el.closest(s))) continue;
			if (!el.checkVisibility({ visibilityProperty: true })) continue;
			el.scrollIntoView({ block: 'center' });
			const q = el.getBoundingClientRect();
			if (q.width === 0 || q.height === 0) continue;
			const x = q.left + Math.min(q.width / 2, window.innerWidth - q.left - 1);
			// A link that opens its row in place (the title of a Verbonden row, the headline of
			// a line in Actueel) has the whole row for a target: a tap on the row's words opens
			// it too (actions/klik.ts), as in the rules of e2e/support/rules.ts.
			const row = el.matches('a[aria-expanded], .tekst > a.zin') ? el.closest('[data-rij]') : null;
			const probe = (y: number) => {
				const top = document.elementFromPoint(x, y);
				if (!top) return false;
				if (el.contains(top)) return true;
				return (
					!!row &&
					top.closest('[data-rij]') === row &&
					(!top.closest('button, a') || top.matches('.regel-toggle'))
				);
			};
			const mid = q.top + q.height / 2;
			let up = 0;
			while (up < 40 && probe(mid - q.height / 2 - up - 0.5)) up++;
			let down = 0;
			while (down < 40 && probe(mid + q.height / 2 + down + 0.5)) down++;
			const hoogte = q.height + up + down;
			if (hoogte < 43.5)
				found.push({
					naam: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
					hoogte: Math.round(hoogte),
					plek: el.className.toString().slice(0, 40)
				});
		}
		return found;
	}, INLINE);
}

test.describe('on a phone', () => {
	test.beforeEach(({ touch }) => test.skip(!touch, 'a phone'));

	for (const [naam, pad, wacht] of [
		['the start', '/', 'Alles in Actueel'],
		['an article', ARTICLE, null],
		['a Kamerlid', '/leden/rob-jetten', 'toezeggingen'],
		['a Kamerstuk', '/kamerstukken/36799/31', null],
		['Actueel', '/actueel', 'Eerdere']
	] as const) {
		test(`the links and buttons of ${naam} are 44 px to a finger`, async ({ page }) => {
			test.setTimeout(120_000);
			await page.goto(pad);
			await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
			if (wacht) await expect(page.locator('main').getByText(wacht).first()).toBeVisible();
			await page.waitForLoadState('networkidle');
			expect.soft(await kleine(page)).toEqual([]);
			// The article again with Verbonden to the front: its row open, its places and its
			// Lees verder.
			if (naam === 'an article') {
				await naarVerbonden(page);
				await page.locator('a.kind__title[aria-expanded]').first().click();
				await expect(page.getByRole('link', { name: 'Lees verder' })).toBeVisible();
				expect.soft(await kleine(page)).toEqual([]);
			}
		});
	}

	// A Keuze is whole on a phone: no option cut off at the frame's edge, none out of the
	// screen (the start page's Alle bronnen to Regering was 7 px too wide, UX-toets A265 B3).
	for (const pad of ['/', '/actueel', ARTICLE, '/leden/rob-jetten', '/dossiers/36496']) {
		test(`the choices of ${pad} are whole`, async ({ page }) => {
			await page.goto(pad);
			await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
			await page.waitForLoadState('networkidle');
			const cut = await page.evaluate(() =>
				[...document.querySelectorAll<HTMLElement>('[role="group"]')]
					.filter((g) => g.querySelector(':scope > button[aria-pressed]') && g.checkVisibility())
					.filter(
						(g) => g.scrollWidth > g.clientWidth || g.getBoundingClientRect().right > innerWidth
					)
					.map((g) => `${g.getAttribute('aria-label')}: ${g.scrollWidth} in ${g.clientWidth}`)
			);
			expect(cut).toEqual([]);
		});
	}
});

// An open row of Verbonden shows its passage once: the text the glance loads takes the place of
// the passage the row came with (RowGlance), and the title stays where the finger tapped it.
test('an open row of Verbonden shows its passage once and keeps its title in place', async ({
	page
}) => {
	await page.goto(ARTICLE);
	await naarVerbonden(page);
	const title = page.locator('a.kind__title[aria-expanded]').first();
	await expect(title).toBeVisible();
	await page.waitForLoadState('networkidle');
	const before = await title.boundingBox();
	await title.click();
	await expect(page.getByRole('link', { name: 'Lees verder' })).toBeVisible();
	await expect(page.locator('.row__citaat')).toHaveCount(0);
	const row = page.locator('li.kind__open');
	const text = await row.innerText();
	expect(text.split('condicio-sine-qua-non-verband').length - 1).toBe(1);
	const after = await page.locator('a.row__title').first().boundingBox();
	expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
});
