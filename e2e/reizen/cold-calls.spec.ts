// A cold call is slow, not broken (UX-review 26 Oct, N3, F6): the werkplek of a fractie waits
// out its neighbourhood and its dossiers beyond the old 10 s, says after 3 s that it takes
// longer than usual, and shows no failure while the request is still within its time.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const SLOW = 'Laden duurt langer dan gewoonlijk';

/** Hold every call to `pattern` until `release()`, then answer it as the fixtures do. */
async function hold(page: Page, pattern: RegExp) {
	let release!: () => void;
	const released = new Promise<void>((done) => (release = done));
	await page.route(pattern, async (route) => {
		await released;
		await route.fallback();
	});
	return release;
}

test('the werkplek of a fractie waits out a cold dossiers call and says it takes longer (N3)', async ({
	page,
	isMobile
}) => {
	const release = await hold(page, /\/api\/factions\/d66\/dossiers/);
	await page.goto('/fracties/d66');
	// On a phone Verbonden is a tab beside Tekst.
	if (isMobile) await page.getByRole('tab', { name: 'Verbonden' }).click();
	// The line comes at 3 s; the call is held until it stands, so the old 10 s is not the limit.
	await expect(page.getByText(SLOW).first()).toBeVisible({ timeout: 8_000 });
	await expect(page.getByText(/kon niet (op tijd )?worden geladen/)).toHaveCount(0);
	release();
	await expect(page.getByText(SLOW)).toHaveCount(0);
	await expect(page.getByText(/kon niet (op tijd )?worden geladen/)).toHaveCount(0);
});

test('the start page says Actueel takes longer instead of failing (F6)', async ({ page }) => {
	const release = await hold(page, /\/api\/feed\/summary/);
	await page.goto('/');
	await expect(page.getByText(SLOW)).toBeVisible({ timeout: 8_000 });
	await expect(page.getByText('Actueel kon niet')).toHaveCount(0);
	release();
	await expect(page.getByText(SLOW)).toHaveCount(0);
});

test('typing on the start page leaves no empty place for the law network (F6)', async ({
	page
}) => {
	await hold(page, /\/api\/feed\/summary/);
	await page.goto('/');
	await expect(page.locator('.wetsnetwerk-plek')).toBeVisible();
	await page.getByRole('combobox').or(page.locator('[data-search-field]')).first().fill('huur');
	await expect(page.locator('.wetsnetwerk-plek')).toHaveCount(0);
});
