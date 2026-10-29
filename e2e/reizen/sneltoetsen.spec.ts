// Every key of the register (src/lib/keys/register.ts), pressed where it works: what it does is
// the test. A key that is added to the register without a case here fails the last test; a
// key that stops working fails its own. The keys of `pagina` are always Alt or Ctrl/⌘ with a
// key (WCAG 2.1.4), and one that is pressed without Alt does nothing.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { TOETSEN } from '../../src/lib/keys/register';

const LEZER = '/wetten/BWBR0005289/artikel/6:162';
const NETWERK = `${LEZER}?mode=netwerk`;
const canvas = (page: Page) => page.getByRole('application', { name: /^Netwerk\./ });
const lijst = (page: Page) => page.locator('.canvas-node-list a');
const regel = (page: Page) => page.locator('.canvas-node-list + p[aria-live="polite"]');
const melding = (page: Page) => page.locator('.bevestiging');
/** Writes down what the status line says, as it lives two seconds and a busy page may be late. */
const bijhouden = (page: Page) =>
	page.evaluate(() => {
		const w = window as unknown as { __gezegd: string[] };
		w.__gezegd = [];
		new MutationObserver(() => {
			const t = document.querySelector('[role=status]')?.textContent?.trim();
			if (t && w.__gezegd.at(-1) !== t) w.__gezegd.push(t);
		}).observe(document.body, { subtree: true, childList: true, characterData: true });
	});
const gezegd = (page: Page) =>
	page.evaluate(() => (window as unknown as { __gezegd: string[] }).__gezegd.join('\n'));
const naamVanFocus = (page: Page) => page.evaluate(() => document.activeElement?.tagName ?? 'BODY');

type Geval = {
	/** Only on a phone: the keys that stand for a tab. */
	telefoon?: boolean;
	run: (page: Page) => Promise<void>;
};

async function zoekveld(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	const field = page.getByRole('combobox', { name: 'Zoeken' });
	await field.fill('onrechtmatige daad');
	const results = page.getByRole('listbox', { name: 'Resultaten' });
	await expect(results.getByRole('option').first()).toBeVisible({ timeout: 30_000 });
	await expect(results.getByRole('group', { name: /laden…$/ })).toHaveCount(0, { timeout: 30_000 });
	return { field, results };
}

const GEVALLEN: Record<string, Geval> = {
	zoeken: {
		run: async (page) => {
			await page.goto('/docs');
			await expect(page.getByRole('button', { name: /Zoek een wet/ })).toBeVisible();
			for (const toets of ['ControlOrMeta+k', 'Alt+Slash']) {
				await page.keyboard.press(toets);
				await expect(page.getByRole('dialog').getByRole('combobox')).toBeFocused();
				await page.keyboard.press('Escape');
				await expect(page.getByRole('dialog')).toHaveCount(0);
			}
		}
	},
	hulp: {
		run: async (page) => {
			await page.goto('/docs');
			await expect(page.getByRole('button', { name: /Zoek een wet/ })).toBeVisible();
			const knop = page.getByRole('link', { name: 'Documentatie' }).first();
			await knop.focus();
			await page.keyboard.press('ControlOrMeta+Slash');
			const venster = page.getByRole('dialog', { name: 'Sneltoetsen' });
			await expect(venster).toBeVisible();
			await expect(venster).toHaveAttribute('aria-modal', 'true');
			// Every key of the register is in it, once.
			for (const t of TOETSEN.filter((x) => x.soort !== 'gereserveerd'))
				await expect(venster.locator(`[data-toets="${t.id}"]`)).toHaveCount(1);
			// The focus stays in it, and Escape gives it back.
			for (let i = 0; i < 6; i++) {
				await page.keyboard.press('Tab');
				expect(await venster.evaluate((v) => v.contains(document.activeElement))).toBe(true);
			}
			await page.keyboard.press('Escape');
			await expect(venster).toHaveCount(0);
			await expect(knop).toBeFocused();
			// The same key opens it and closes it.
			await page.keyboard.press('ControlOrMeta+Slash');
			await expect(venster).toBeVisible();
			await page.keyboard.press('ControlOrMeta+Slash');
			await expect(venster).toHaveCount(0);
		}
	},
	sluit: {
		run: async (page) => {
			await page.goto('/docs');
			await expect(page.getByRole('button', { name: /Zoek een wet/ })).toBeVisible();
			await page.keyboard.press('ControlOrMeta+Slash');
			await expect(page.getByRole('dialog', { name: 'Sneltoetsen' })).toBeVisible();
			await page.keyboard.press('Escape');
			await expect(page.getByRole('dialog')).toHaveCount(0);
		}
	},
	'zoek-resultaten': {
		run: async (page) => {
			const { field, results } = await zoekveld(page);
			await field.focus();
			// ↓ walks the rows; Enter opens the one it stands on.
			const gekozen = results.getByRole('option', { selected: true });
			for (let i = 0; i < 40 && !(await gekozen.filter({ hasText: '6:162' }).count()); i++)
				await page.keyboard.press('ArrowDown');
			await expect(gekozen).toContainText('6:162');
			await page.keyboard.press('Enter');
			await expect(page).toHaveURL(/\/wetten\/BWBR0005289\/artikel\/6:162/);
		}
	},
	'zoek-wis': {
		run: async (page) => {
			const { field } = await zoekveld(page);
			await field.focus();
			await page.keyboard.press('Escape');
			await expect(field).toHaveValue('');
		}
	},
	wissel: {
		run: async (page) => {
			await page.goto(LEZER);
			await expect(page.getByRole('heading', { level: 1 })).toContainText('6:162');
			// A place in the text, to come back to.
			const scroller = page.locator('.col--reader .reader');
			await expect(scroller).toBeAttached();
			await scroller.evaluate((el) => {
				let p: HTMLElement | null = el.parentElement;
				while (
					p &&
					!(p.scrollHeight > p.clientHeight && /auto|scroll/.test(getComputedStyle(p).overflowY))
				)
					p = p.parentElement;
				p?.scrollBy(0, 400);
			});
			await bijhouden(page);
			await page.keyboard.press('Alt+KeyL');
			await expect(page).toHaveURL(/mode=netwerk/);
			await expect.poll(() => gezegd(page)).toMatch(/Naar netwerk: .*6:162/);
			await expect(page.getByRole('button', { name: /^Netwerk/ })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await expect.poll(() => naamVanFocus(page)).not.toBe('BODY');
			await page.keyboard.press('Alt+KeyL');
			await expect(page).not.toHaveURL(/mode=netwerk/);
			await expect.poll(() => gezegd(page)).toMatch(/Naar lezer: .*6:162/);
			await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
			// Without Alt the key is a letter and nothing else.
			await page.keyboard.press('l');
			await expect(page).not.toHaveURL(/mode=netwerk/);
		}
	},
	'tab-tekst': {
		telefoon: true,
		run: async (page) => {
			await page.goto(LEZER);
			await expect(page.getByRole('heading', { level: 1 })).toContainText('6:162');
			await page.keyboard.press('Alt+Digit2');
			const panelen = page.getByRole('navigation', { name: 'Panelen' });
			await expect(panelen.getByRole('button', { name: 'Verbonden' })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await page.keyboard.press('Alt+Digit1');
			await expect(panelen.getByRole('button', { name: 'Tekst' })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
		}
	},
	'artikel-vorig': {
		run: async (page) => {
			await page.goto('/wetten/BWBR0005289/artikel/6:163');
			await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:163 BW');
			await page.keyboard.press('Alt+BracketLeft');
			await expect(page).toHaveURL(/\/artikel\/6:162/);
			await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
		}
	},
	'artikel-volgend': {
		run: async (page) => {
			await page.goto(LEZER);
			await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
			await page.keyboard.press('Alt+BracketRight');
			await expect(page).toHaveURL(/\/artikel\/6:163/);
			await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:163 BW');
			// The new article stands at its top, its heading holds the focus.
			await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
			expect(new URL(page.url()).hash).toBe('');
		}
	},
	'rij-focus': {
		run: async (page) => {
			await page.goto(LEZER);
			const titels = page.locator('.verbonden a.kind__title');
			await expect(titels.nth(1)).toBeVisible({ timeout: 30_000 });
			// A letter alone does nothing from the body, and goes through the list from within.
			await page.locator('body').click({ position: { x: 1, y: 1 } });
			await page.keyboard.press('j');
			await expect(titels.first()).not.toBeFocused();
			await titels.first().focus();
			await page.keyboard.press('j');
			await expect(titels.nth(1)).toBeFocused();
			await page.keyboard.press('k');
			await expect(titels.first()).toBeFocused();
		}
	},
	'rij-pagina': {
		run: async (page) => {
			await page.goto(LEZER);
			const titels = page.locator('.verbonden a.kind__title');
			await expect(titels.nth(1)).toBeVisible({ timeout: 30_000 });
			await page.locator('body').click({ position: { x: 1, y: 1 } });
			await page.keyboard.press('Alt+KeyJ');
			await expect(titels.first()).toBeFocused();
			await page.keyboard.press('Alt+KeyJ');
			await expect(titels.nth(1)).toBeFocused();
			await page.keyboard.press('Alt+KeyK');
			await expect(titels.first()).toBeFocused();
		}
	},
	'netwerk-aanwijzen': {
		run: async (page) => {
			await page.goto(NETWERK);
			await expect(lijst(page).nth(1)).toBeAttached();
			const [eerste, tweede] = await lijst(page).allTextContents();
			await canvas(page).focus();
			await page.keyboard.press('ArrowRight');
			await expect(regel(page)).toHaveText(eerste);
			await page.keyboard.press('ArrowRight');
			await expect(regel(page)).toHaveText(tweede);
			await page.keyboard.press('ArrowLeft');
			await expect(regel(page)).toHaveText(eerste);
		}
	},
	'netwerk-lijst': {
		run: async (page) => {
			await page.goto(NETWERK);
			await expect(lijst(page).nth(1)).toBeAttached();
			await lijst(page).first().focus();
			await page.keyboard.press('ArrowDown');
			await expect(lijst(page).nth(1)).toBeFocused();
			await page.keyboard.press('End');
			await expect(lijst(page).last()).toBeFocused();
			await page.keyboard.press('Home');
			await expect(lijst(page).first()).toBeFocused();
			await page.keyboard.press('ArrowUp');
			await expect(lijst(page).first()).toBeFocused();
		}
	},
	'netwerk-n': {
		run: async (page) => {
			await page.goto(NETWERK);
			await expect(lijst(page).nth(1)).toBeAttached();
			// A bron, not a group: a group is not added by a key.
			const bron = lijst(page).and(page.locator('a:not([aria-haspopup])')).first();
			await bron.focus();
			await page.keyboard.press('n');
			await expect(regel(page)).toHaveText(/(toegevoegd aan|uit) het netwerk/);
		}
	},
	vergelijken: {
		run: async (page) => {
			await page.goto('/wetten/BWBR0001840/artikel/23');
			await page.getByRole('link', { name: 'Vergelijken', exact: true }).click();
			await expect(page).toHaveURL(/versies=/);
			const eerst = page.url();
			await page.keyboard.press('ArrowLeft');
			await expect(page).not.toHaveURL(eerst);
			await page.keyboard.press('ArrowRight');
			await expect(page).toHaveURL(eerst);
		}
	}
};

const TE_TESTEN = TOETSEN.filter((t) => t.soort !== 'gereserveerd');

for (const t of TE_TESTEN) {
	test(`${t.id}: ${t.omschrijving}`, async ({ page, touch }) => {
		const geval = GEVALLEN[t.id];
		test.skip(!geval, 'no case: see the last test');
		test.skip(!!geval?.telefoon !== touch, geval?.telefoon ? 'a phone key' : 'a keyboard key');
		await geval!.run(page);
	});
}

test('every key of the register has its case, and the reserved Alt W is bound to nothing', async ({
	page,
	touch
}) => {
	test.skip(touch, 'once is enough');
	expect(Object.keys(GEVALLEN).sort()).toEqual(TE_TESTEN.map((t) => t.id).sort());
	await page.goto(LEZER);
	await expect(page.getByRole('heading', { level: 1 })).toContainText('6:162');
	const url = page.url();
	await page.keyboard.press('Alt+KeyW');
	expect(page.url()).toBe(url);
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

// The pictures for the review (SNELTOETSEN_PNG=<directory>): the window on Ctrl / and the line
// that says where Alt L went, at 1440 and at 375.
test('pictures of the window and the line of Alt L', async ({ page, isMobile }) => {
	const map = process.env.SNELTOETSEN_PNG;
	test.skip(!map, 'only for the review');
	const breed = isMobile ? '375' : '1440';
	await page.goto(LEZER);
	await expect(page.getByRole('heading', { level: 1 })).toContainText('6:162');
	await page.keyboard.press('ControlOrMeta+Slash');
	await expect(page.getByRole('dialog', { name: 'Sneltoetsen' })).toBeVisible();
	await page.screenshot({ path: `${map}/hulpvenster-${breed}.png` });
	await page.keyboard.press('Escape');
	await page.keyboard.press('Alt+KeyL');
	await expect(melding(page)).toContainText('Naar netwerk');
	await page.screenshot({ path: `${map}/wissel-naar-netwerk-${breed}.png` });
	await expect(melding(page)).toHaveCount(0);
	await page.keyboard.press('Alt+KeyL');
	await expect(melding(page)).toContainText('Naar lezer');
	await page.screenshot({ path: `${map}/wissel-naar-lezer-${breed}.png` });
});
