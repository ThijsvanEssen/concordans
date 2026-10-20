// The menus of the readers and the bundels behave alike: Escape closes a menu and gives the
// focus back to what opened it; on touch a tap outside closes it, and the tap does nothing
// else (actions/menu.ts).
import type { Page } from '@playwright/test';
import { keepArticle } from '../support/bundels';
import { expect, test } from '../support/test';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162?lezen=1';

type Case = {
	name: string;
	url: string;
	opener: string | RegExp;
	menu: RegExp;
	prepare?: (page: Page) => Promise<void>;
};

const MENUS: Case[] = [
	{
		name: 'a lid',
		url: ARTICLE,
		opener: 'art. 6:162 lid 2 BW: citeren, bewaren',
		menu: /^art\. 6:162 lid 2 BW$/
	},
	{ name: 'Citeer', url: ARTICLE, opener: 'Citeer', menu: /^Citeer art\. 6:162 BW/ },
	{
		name: 'Bewaar in bundel',
		url: ARTICLE,
		opener: 'Bewaar art. 6:162 BW in bundel',
		menu: /^Bewaar art\. 6:162 BW in bundel$/
	},
	{
		name: 'a rechtsoverweging',
		url: '/uitspraken/ECLI:NL:HR:2019:2006?lezen=1',
		opener: 'Overweging 5.3.2: citeren, bewaren',
		menu: /r\.o\. 5\.3\.2$/
	},
	{
		name: 'the versions of an article',
		url: '/wetten/BWBR0001840/artikel/23?lezen=1',
		opener: '3 tekstversies',
		menu: /^Tekstversies$/
	},
	{
		name: 'Meer of a bundel',
		url: '/bundels/losse-markeringen',
		opener: 'Meer bij Losse markeringen',
		menu: /^Meer bij Losse markeringen$/,
		prepare: keepArticle
	}
];

for (const c of MENUS) {
	test(`the menu of ${c.name}: Escape closes it and gives the focus back`, async ({
		page,
		touch
	}) => {
		test.skip(touch, 'a key');
		await c.prepare?.(page);
		await page.goto(c.url);
		const opener = page.getByRole('button', {
			name: c.opener,
			exact: typeof c.opener === 'string'
		});
		await opener.focus();
		await page.keyboard.press('Enter');
		const menu = page.getByRole('menu', { name: c.menu });
		await expect(menu).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(menu).toBeHidden();
		await expect(opener).toBeFocused();
	});

	test(`the menu of ${c.name}: a tap outside closes it`, async ({ page, touch }) => {
		test.skip(!touch, 'a tap');
		await c.prepare?.(page);
		await page.goto(c.url);
		const opener = page.getByRole('button', {
			name: c.opener,
			exact: typeof c.opener === 'string'
		});
		await opener.tap();
		const menu = page.getByRole('menu', { name: c.menu });
		await expect(menu).toBeVisible();
		const url = page.url();
		// The heading of the page: outside the menu, and nothing that a tap would follow.
		await page.getByRole('heading', { level: 1 }).tap();
		await expect(menu).toBeHidden();
		expect(page.url()).toBe(url);
	});
}
