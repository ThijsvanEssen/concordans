// The frame of every kind of bron alike (E8, C1): a kind gives data and words to the frame, never
// a line of its own above the title, an empty state or a form of ordering. One list, one loop:
// a new kind of bron goes into SOORTEN (support/soorten.ts) and its weak places are a failing
// test here, not a finding of an expert. At 1440 and at 375 with touch.
import type { Page } from '@playwright/test';
import { SOORTEN } from '../support/soorten';
import { expect, test } from '../support/test';

/** The kinds whose status line always says something. */
const STATUS = new Set([
	'wet',
	'artikel',
	'bijlage',
	'uitspraak',
	'Kamerstuk',
	'motie',
	'publicatie',
	'kabinet',
	'activiteit'
]);

/** The kinds Bladeren has no list of: their kind is a word beside the glyph, not a link. */
const GEEN_LIJST = new Set(['bijlage', 'zaak', 'activiteit']);

/** The kinds without a head line of the kind: the article's is its place. */
const PLAATSREGEL = new Set(['artikel']);

async function open(page: Page, pad: string) {
	await page.goto(pad);
	await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
	await page.waitForLoadState('networkidle');
}

for (const [soort, pad] of SOORTEN) {
	test(`${soort}: the frame is the one of every kind`, async ({ page, touch }) => {
		await open(page, pad);
		const verbonden = page.getByRole('complementary', { name: 'Verbonden' });
		await verbonden.scrollIntoViewIfNeeded();
		await expect(verbonden.locator('.head__count')).toHaveText(/verbinding|Geen/);

		// 1. The line of the kind: its glyph and its kind as a link to the list.
		if (!PLAATSREGEL.has(soort)) {
			await expect(page.locator('.reader-kind .kind-glyph').first(), 'glyph').toBeAttached();
			if (!GEEN_LIJST.has(soort))
				await expect(
					page.locator('.reader-kind a.soort').first(),
					'link to the list'
				).toBeAttached();
		}

		// The glyph stands in the head line of every kind, an article's with its place too, and
		// the kind is said once: no word twice in a row ("Dossier, Dossier 36496").
		await expect(
			page.locator('.reader-line .kind-glyph').first(),
			'glyph in the head line'
		).toBeAttached();
		const regel = await page
			.locator('.reader-kind')
			.evaluateAll((els) => els[0]?.textContent ?? '');
		const woorden: string[] = regel.toLowerCase().match(/[a-zà-ÿ]+/g) ?? [];
		expect(
			woorden.filter((w, i) => w.length > 3 && woorden.indexOf(w) !== i),
			`a word twice in the head line "${regel.trim()}"`
		).toEqual([]);

		// 2. No bare rule: the row of the band has something in it, or it is not drawn.
		const rij = await page
			.locator('.kop-rij:not([hidden])')
			.evaluateAll((els) =>
				els.map((el) => (el.textContent ?? '').trim().length + el.querySelectorAll('button').length)
			);
		expect(
			rij.every((n) => n > 0),
			'a band row without anything in it'
		).toBe(true);
		const band = await page
			.locator('.kop-rij__band:not([hidden])')
			.evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim().length));
		expect(
			band.every((n) => n > 0),
			'a band without lines'
		).toBe(true);

		// 3. The status line says something where the kind has one to say.
		if (STATUS.has(soort))
			await expect(page.locator('.reader-status__woorden').first(), 'status line').not.toBeEmpty();

		// 4. Inhoud has two entries at least, or there is none: no column, no tab, no button.
		const leeg = (await page.locator('.toc-column[hidden]').count()) > 0;
		if (leeg) {
			await expect(page.locator('.mobile-tab--toc'), 'a tab Inhoud without entries').toHaveCount(0);
			await expect(page.getByRole('button', { name: 'Inhoud', exact: true })).toHaveCount(0);
		} else {
			const inhoud = await page
				.locator('nav[aria-label="Inhoud"]')
				.evaluateAll((els) => els.map((el) => el.querySelectorAll('a').length));
			expect(
				inhoud.every((n) => n >= 2),
				'Inhoud with fewer than two entries'
			).toBe(true);
		}
		await expect(page.getByText('Geen indeling.')).toHaveCount(0);

		// 5. The count of a soort is a number, no unit.
		const tellers = await verbonden.locator('.kind__count').allTextContents();
		for (const t of tellers) expect(t.trim()).toMatch(/^[\d.]+$/);

		// 6. Alle N only where there is more than the rows shown.
		const groepen = await verbonden.locator('section.kind').evaluateAll((els) =>
			els.map((el) => ({
				telt: Number((el.querySelector('.kind__count')?.textContent ?? '0').replace(/\./g, '')),
				alle: el.querySelectorAll('.alle-n').length
			}))
		);
		for (const g of groepen) if (g.alle > 0) expect(g.telt).toBeGreaterThan(3);

		// 7. Bewaar is the first of the actions.
		const eerste = page.locator('.kop-acties').locator('button, a.btn').first();
		await expect(eerste).toContainText('Bewaar');

		// 8. On a phone the title is the first thing, within the first 360 px.
		if (touch) {
			const kop = await page.getByRole('heading', { level: 1 }).first().boundingBox();
			expect(kop!.y, 'h1 within the first 360 px').toBeLessThanOrEqual(360);
		}

		// 9. No contradiction: a band that names a relation and Verbonden saying there is none.
		const band9 = await page.locator('nav.behoort a').count();
		if (band9 > 0) await expect(verbonden.getByText('Geen verbindingen.')).toHaveCount(0);
	});
}
