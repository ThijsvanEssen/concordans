// A judgment: its heading and course of proceedings, the overview of its parts, the menu of a
// rechtsoverweging, and an article it cites.
import { expect, test } from '../support/test';
import { smallTargets, withoutSize } from '../support/rules';

const URGENDA = '/uitspraken/ECLI:NL:HR:2019:2006';

test('a judgment shows its court, its course and its parts', async ({ page, touch }) => {
	await page.goto(URGENDA);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'HR 20 december 2019, ECLI:NL:HR:2019:2006 (Urgenda)'
	);
	await expect(
		page.getByRole('navigation', { name: 'Behoort bij' }).getByRole('link', {
			name: /Rb\. Den Haag 24 juni 2015/
		})
	).toBeVisible();
	await expect(page.getByRole('rowheader', { name: 'Eiser' })).toBeVisible();
	await expect(
		page.getByRole('button', { name: /^Overweging [\d.]+: citeren, bewaren$/ })
	).not.toHaveCount(0);

	if (touch) return; // the overview of parts stands beside the text from 1440
	await page
		.getByRole('navigation', { name: 'Inhoud' })
		.getByRole('link', { name: '9. Beslissing' })
		.click();
	await expect(page.getByRole('heading', { level: 3, name: '9. Beslissing' })).toBeInViewport();
});

test('a rechtsoverweging cites short, in full and as a link to its place', async ({ page }) => {
	await page.goto(URGENDA);
	await page.getByRole('button', { name: 'Overweging 5.3.2: citeren, bewaren' }).click();
	const menu = page.getByRole('menu', { name: 'HR 20 december 2019, r.o. 5.3.2' });
	await expect(menu.getByRole('menuitem', { name: /kort$/ })).toHaveText(/r\.o\. 5\.3\.2/);
	await expect(menu.getByRole('menuitem', { name: /voluit$/ })).toContainText(
		'ECLI:NL:HR:2019:2006'
	);
	await expect(menu.getByRole('menuitem', { name: /link$/ })).toContainText('#rov-5.3.2');
	await expect(menu.getByRole('menuitem', { name: 'Bewaar in Losse markeringen' })).toBeVisible();
});

test('a cited article opens at the lid the judgment names', async ({ page }) => {
	await page.goto(URGENDA);
	await page.getByRole('link', { name: 'art. 6:162 BW', exact: true }).first().click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289\/artikel\/6:162/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
});

test('the lines of Behoort bij stand a finger’s target apart', async ({ page, touch }) => {
	test.skip(!touch, 'a finger’s target');
	await page.goto(URGENDA);
	const band = page.getByRole('navigation', { name: 'Behoort bij' });
	// Three layers stand whole, as the kruimelpad of the mockups V1.
	await expect(band.getByRole('link', { name: /^Hof Den Haag 9 oktober 2018/ })).toBeVisible();
	expect(await smallTargets(page), 'tap targets under 44 px').toEqual([]);
});

test('the items of a menu are a finger’s 44 px high', async ({ page, touch }) => {
	test.skip(!touch, 'a finger’s target');
	await page.goto(URGENDA);
	const menus = [
		// A place's menu (PlaatsMenu) and a menu of the head (TekstMenu): one item, one row.
		['Overweging 5.3.2: citeren, bewaren', 'HR 20 december 2019, r.o. 5.3.2'],
		['Citeer', undefined]
	] as const;
	for (const [knop, naam] of menus) {
		await page.getByRole('button', { name: knop, exact: true }).first().click();
		const items = page.getByRole('menu', { name: naam }).getByRole('menuitem');
		await expect(items.first()).toBeVisible();
		const labels = await items.evaluateAll((els) =>
			els.map((e) => e.getAttribute('aria-label') ?? e.textContent ?? '')
		);
		for (const h of await items.evaluateAll((els) =>
			els.map((e) => e.getBoundingClientRect().height)
		))
			expect(h, `${knop}: an item's height`).toBeGreaterThanOrEqual(44);
		const small = (await smallTargets(page)).map(withoutSize);
		expect(
			small.filter((s) => labels.includes(s)),
			'items under 44 px'
		).toEqual([]);
		await page.keyboard.press('Escape');
		await expect(items).toHaveCount(0);
	}
});

test('a date in running text and in a footnote never breaks over two lines', async ({ page }) => {
	await page.goto('/uitspraken/ECLI:NL:HR:2019:793');
	await expect(page.locator('.reader-para').first()).toBeVisible();
	const broken = await page.evaluate(() => {
		const months =
			'januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december';
		const date = new RegExp(`\\b\\d{1,2}[ \\u00a0](?:${months})(?:[ \\u00a0]\\d{4})?\\b`, 'gi');
		let seen = 0;
		const bad: string[] = [];
		for (const el of document.querySelectorAll(
			'.voetnoot__tekst, .reader-para:not(:has(.reader-para))'
		)) {
			const spans = el.querySelectorAll('.date');
			const inText = (el.textContent ?? '').match(date)?.length ?? 0;
			seen += inText;
			if (spans.length !== inText) bad.push(`not held: ${el.textContent?.slice(0, 40)}`);
			for (const d of spans) if (d.getClientRects().length > 1) bad.push(d.textContent ?? '');
		}
		return { seen, bad };
	});
	expect(broken.seen, 'dates in the text').toBeGreaterThan(0);
	expect(broken.bad).toEqual([]);
});
