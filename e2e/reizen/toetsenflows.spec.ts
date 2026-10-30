// The flows of the keyboard that ⌘K promises (docs/claude/ux-review/toetsenbordflows-20261030.md):
// each with the keys alone, from where it starts to what the address and the focus say after.
// A command of the register (COMMANDS) without a flow here fails the last test.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { COMMANDS } from '../../src/lib/keys/register';

const GRONDWET = '/explore?netwerk=instruments/bwbr0001840';
const canvas = (page: Page) => page.getByRole('application', { name: /^Netwerk\./ });
const focusIn = (page: Page, selector: string) =>
	page.evaluate((s) => !!document.activeElement?.closest(s), selector);
const params = (page: Page) => new URL(page.url()).searchParams;

/** ⌘K with `line` typed: the rows Doen (Hier before anything is typed), the first chosen. */
async function palette(page: Page, line: string, group = line ? 'Doen' : 'Hier') {
	await page.keyboard.press('ControlOrMeta+k');
	const field = page.getByRole('dialog').getByRole('combobox');
	await expect(field).toBeFocused();
	await field.fill(line);
	const rows = page.getByRole('group', { name: group }).getByRole('option');
	await expect(rows.first()).toBeVisible();
	return { rows, chosen: page.getByRole('dialog').getByRole('option', { selected: true }) };
}

/** `line` in ⌘K, the chosen row checked, and Enter. */
async function doe(page: Page, line: string, row: RegExp | string) {
	const { chosen } = await palette(page, line);
	await expect(chosen).toContainText(row);
	await page.keyboard.press('Enter');
	await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function inNetwerk(page: Page, url = GRONDWET) {
	await page.goto(url);
	await expect(canvas(page)).toBeVisible();
}

const FLOWS: Record<string, (page: Page) => Promise<void>> = {
	// Wisselen in het netwerk: Keten and back, Verband with one bron says what it needs.
	F2: async (page) => {
		await inNetwerk(page);
		const { chosen } = await palette(page, 'vb');
		await expect(chosen).toContainText('vraagt een tweede bron');
		await page.keyboard.press('Enter');
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.keyboard.press('Escape');
		await doe(page, 'kt', 'Weergave Keten');
		await expect(page).toHaveURL(/weergave=keten/);
		await expect.poll(() => focusIn(page, 'svg.drawing')).toBe(true);
		await doe(page, 'om', 'Weergave Omgeving');
		await expect(page).not.toHaveURL(/weergave=/);
		await expect(canvas(page)).toBeFocused();
	},
	// Nothing typed: what can be done here, the first that changes something chosen; and Recent.
	Hier: async (page) => {
		await inNetwerk(page);
		const { rows, chosen } = await palette(page, '');
		await expect(rows.filter({ hasText: 'Weergave Omgeving' })).toContainText('nu');
		await expect(chosen).toContainText('Weergave Keten');
		await page.keyboard.press('ArrowDown');
		await expect(chosen).toContainText('Aantal stappen');
		await page.keyboard.press('ArrowUp');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/weergave=keten/);
		await doe(page, 'netwerk awb', 'Netwerk van');
		await expect(page).toHaveURL(/\/wetten\/BWBR0005537\?mode=netwerk/);
		const recent = await palette(page, '', 'Recent');
		await expect(recent.rows.first()).toContainText('Netwerk');
	},
	// Aantal stappen by its word; 0 only with chosen bronnen.
	F3: async (page) => {
		await inNetwerk(page);
		await doe(page, 's2', '2 stappen');
		await expect.poll(() => params(page).get('diepte')).toBe('2');
		await doe(page, 's0', 'Alleen gekozen');
		await expect.poll(() => params(page).get('diepte')).toBe('0');
		const { rows } = await palette(page, 'stappen');
		await expect(rows).toHaveCount(4);
		await page.keyboard.press('Escape');
	},
	// A soort of Tonen off and on by its word, and all back.
	F4: async (page) => {
		await inNetwerk(page);
		await doe(page, '-stukken', 'Stukken verbergen');
		await expect.poll(() => params(page).get('bronnen')).not.toContain('stukken');
		await doe(page, '+stukken', 'Stukken tonen');
		await expect.poll(() => params(page).get('bronnen')).toBeNull();
		await doe(page, 'alleen wetten', 'Alleen wetten');
		await expect.poll(() => params(page).get('bronnen')).toBe('wetten');
		await doe(page, 'alles', 'Alle soorten en relaties');
		await expect.poll(() => params(page).get('bronnen')).toBeNull();
	},
	// A relatie of Relatie, alone.
	F14: async (page) => {
		await inNetwerk(page);
		await doe(page, 'alleen aanhaling', 'Alleen aanhaling');
		await expect.poll(() => params(page).get('uit')).toBeTruthy();
		await doe(page, 'alles', 'Alle soorten en relaties');
		await expect.poll(() => params(page).get('uit')).toBeNull();
	},
	// Enter on a label of the keten reads its article in the Leespaneel, not on a page of its own.
	W7: async (page) => {
		await page.goto(`${GRONDWET}&weergave=keten`);
		const label = page.locator('svg.drawing a.cite').first();
		await expect(label).toBeAttached();
		await label.focus();
		await page.keyboard.press('Enter');
		await expect.poll(() => params(page).get('lees')).toBeTruthy();
		await expect(page).toHaveURL(/^[^?]*\/explore\?/);
	}
};

for (const [flow, run] of Object.entries(FLOWS))
	test(`flow ${flow}`, async ({ page, touch }) => {
		test.skip(touch, 'a phone has no keyboard');
		await run(page);
	});

test('every command of the register has its flow here', () => {
	for (const c of COMMANDS) expect(Object.keys(FLOWS), c.id).toContain(c.flow);
});
