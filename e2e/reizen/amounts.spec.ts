// The numbers of an article (`/amounts`, API 0.80.45; filled by the nightly run, none on prod
// yet, so the answer is stubbed): marked in the text, the card of one says what it was in the
// previous toestand and from when, and a block under the text gives the course of each. An
// article without numbers (the answer empty or missing) shows neither. Successiewet art. 24:
// a tarief in a table, the amounts and percentages in its cells.
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { expect, test } from '../support/test';
import { fileOf, stubApi } from '../support/api';

const ARTIKEL = '/wetten/BWBR0002226/artikel/24';
const PAD = /^\/api\/articles\/BWBR0002226\/24\/amounts/;

const text: string = JSON.parse(
	gunzipSync(readFileSync(fileOf('/api/articles/BWBR0002226/24'))).toString()
).body.article.text;

const stap = (version_key: string, valid_from: string, value: number, selected: boolean) => ({
	version_key,
	valid_from,
	valid_until: null,
	value,
	date: null,
	selected
});
const span = (woorden: string) => {
	const start = text.indexOf(woorden);
	return { start, end: start + woorden.length };
};
const AMOUNTS = {
	bwb_id: 'BWBR0002226',
	article_number: '24',
	version_key: 'v3',
	valid_from: '2026-01-01',
	valid_until: null,
	amounts: [
		{
			kind: 'bedrag',
			unit: 'EUR',
			text: '€ 158.669',
			part: 'lid-1',
			source: 'text',
			cell: [1, 1],
			...span('€ 158.669'),
			history: [
				stap('v1', '2024-01-01', 152_000, false),
				stap('v2', '2025-01-01', 157_000, false),
				stap('v3', '2026-01-01', 158_669, true)
			]
		},
		{
			kind: 'percentage',
			unit: '%',
			text: '10%',
			part: 'lid-1',
			source: 'text',
			cell: [1, 2],
			...span('10%'),
			history: [stap('v3', '2026-01-01', 10, true)]
		}
	]
};

test('a number is marked, its card gives the previous toestand', async ({ page, touch }) => {
	await stubApi(page, PAD, AMOUNTS);
	await page.goto(ARTIKEL);
	const getal = page.getByRole('button', { name: '€ 158.669' }).first();
	await expect(getal).toBeVisible();
	if (touch) await getal.tap();
	else await getal.hover();
	const kaart = page.getByRole('dialog', { name: 'Bedrag' });
	await expect(kaart).toContainText('€ 157.000');
	await expect(kaart).toContainText('vanaf 1 januari 2025');
	await getal.focus();
	await page.keyboard.press('Escape');
	await expect(kaart).toHaveCount(0);
});

test('the block gives the course of each number, the one on screen marked', async ({ page }) => {
	await stubApi(page, PAD, AMOUNTS);
	await page.goto(ARTIKEL);
	const blok = page.locator('section', {
		has: page.getByRole('heading', { name: 'Getallen in dit artikel' })
	});
	await expect(blok).toBeVisible();
	const verloop = blok.getByRole('list', { name: 'Verloop van € 158.669' });
	await expect(verloop.getByRole('listitem')).toHaveCount(3);
	await expect(verloop.locator('[aria-current="true"]')).toContainText('€ 158.669');
	await expect(blok).toContainText('lid 1');
});

test('an article without numbers shows no mark and no block', async ({ page }) => {
	await page.goto(ARTIKEL);
	await expect(page.getByText('De belasting wordt geheven naar het volgende tarief')).toBeVisible();
	await expect(
		page.locator('section', {
			has: page.getByRole('heading', { name: 'Getallen in dit artikel' })
		})
	).toHaveCount(0);
	await expect(page.getByRole('button', { name: '€ 158.669' })).toHaveCount(0);
});
