// A link to a place in a text opens at that place and marks it: a lid of an article (#lid-),
// a rechtsoverweging (#rov-), a section of a toelichting beside an article (#s-) and an
// alinea of a Kamerstuk (#p-). The links the menus give out carry the same anchors.
import type { Page } from '@playwright/test';
import paragraphs from '../../src/lib/fixtures/paper-paragraphs-api.json' with { type: 'json' };
import { patchApi } from '../support/api';
import { expect, test } from '../support/test';
import { catchClipboard } from '../support/bundels';

/** The place `id` is on screen and marked as the one landed on. */
async function landed(page: Page, id: string) {
	const place = page.locator(`[id="${id}"]`);
	await expect(place).toBeInViewport();
	await expect(place).toHaveClass(/is-landed/);
}

test('#lid-2 opens the article at its second lid', async ({ page }) => {
	await page.goto('/wetten/BWBR0005289/artikel/6:162#lid-2');
	await landed(page, 'lid-2');
});

test('#rov-5.3.2 opens the judgment at that rechtsoverweging', async ({ page }) => {
	await page.goto('/uitspraken/ECLI:NL:HR:2019:2006#rov-5.3.2');
	await landed(page, 'rov-5.3.2');
});

test('#s-24 opens the memorie van toelichting beside the article at its section', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a toelichting stands beside the article from 1440');
	await page.goto(
		'/wetten/BWBR0005537/artikel/3:4?naast=documents/6c33ccba_751d_4877_9b10_d38154461203#s-24'
	);
	// The anchor of a section is a point in the text: its top within the screen.
	await expect
		.poll(() =>
			page.locator('[id="s-24"]').evaluate((el) => {
				const top = el.getBoundingClientRect().top;
				return top >= 0 && top < innerHeight;
			})
		)
		.toBe(true);
});

test('#p- opens a Kamerstuk at the alinea, by the number the API gives it', async ({ page }) => {
	// The API numbers the alinea's of a stuk (`paragraphs`); live they are still being filled,
	// so this stuk gets them from the fixture of the unit tests.
	const paper = paragraphs.kst_32467_14;
	await patchApi(page, /^\/api\/documents\/be1567ec_1ee5_42ce_a886_13d46d19c6b2$/, (body) => ({
		...body,
		text: paper.text,
		sections: paper.sections,
		paragraphs: paper.paragraphs
	}));
	await page.goto('/kamerstukken/32467/14#p-094a828f');
	await landed(page, 'p-094a828f');
	await expect(
		page.getByRole('button', { name: /^Alinea \d+: citeren, bewaren$/ }).first()
	).toBeVisible();
});

test('the link a lid menu gives out opens at that lid', async ({ page, context }) => {
	const copied = await catchClipboard(context);
	await page.goto('/wetten/BWBR0005289/artikel/6:162');
	await page.getByRole('button', { name: 'art. 6:162 lid 3 BW: citeren, bewaren' }).click();
	await page.getByRole('menu').getByRole('menuitem', { name: 'Link naar dit lid' }).click();
	const href = (await copied(page))!;
	expect(href).toMatch(/#lid-3$/);
	await page.goto(new URL(href).pathname + new URL(href).search + new URL(href).hash);
	await landed(page, 'lid-3');
});
