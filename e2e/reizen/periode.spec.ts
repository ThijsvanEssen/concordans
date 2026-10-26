// Periode, the period of a list: one line in words that opens a popover on a wide screen and
// a sheet from below on a phone.
import { openFilter } from '../support/filters';
import { expect, test } from '../support/test';

test('Periode: the line opens a chooser, a typed year narrows the list, Escape gives the focus back', async ({
	page,
	touch
}) => {
	await page.goto('/actueel');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Actueel');
	await openFilter(page, touch, 'Periode');
	const line = page.getByRole('button', { name: 'Alle jaren Wijzig' });
	await expect(line).toHaveAttribute('aria-haspopup', 'dialog');
	await line.click();
	await expect(line).toHaveAttribute('aria-expanded', 'true');
	const dialog = page.getByRole('dialog', { name: 'Periode' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('radiogroup')).toBeVisible();

	if (touch) {
		// A sheet from below: against the foot of the screen, every control a finger high.
		const box = (await dialog.boundingBox())!;
		const view = page.viewportSize()!;
		expect(box.y + box.height).toBeCloseTo(view.height, 0);
		for (const name of ['Afgelopen maand', 'Toepassen']) {
			const target = dialog.getByRole(name === 'Toepassen' ? 'button' : 'radio', { name });
			expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		}
		expect((await dialog.getByLabel('van').boundingBox())!.height).toBeGreaterThanOrEqual(44);
	} else {
		// A popover of 320 px under the line.
		const box = (await dialog.boundingBox())!;
		expect(box.width).toBeCloseTo(320, 0);
		expect(box.y).toBeGreaterThan((await line.boundingBox())!.y);
	}

	// Escape closes without applying, and the focus goes back to the line.
	await dialog.getByLabel('van').fill('2020');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(line).toBeFocused();
	await expect(line).toHaveAttribute('aria-expanded', 'false');

	// Enter in a field applies: a year is the first of January.
	await line.click();
	await dialog.getByLabel('van').fill('2020');
	await page.keyboard.press('Enter');
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('button', { name: 'Sinds 2020 Wijzig' })).toBeVisible();
	await expect(page).toHaveURL(/from=2020-01-01|van=2020-01-01/);
});

test('Periode: a date that does not exist is told, in one line under the field', async ({
	page,
	touch
}) => {
	await page.goto('/actueel');
	await openFilter(page, touch, 'Periode');
	await page.getByRole('button', { name: 'Alle jaren Wijzig' }).click();
	const dialog = page.getByRole('dialog', { name: 'Periode' });
	const van = dialog.getByLabel('van');
	await van.fill('31-2-2024');
	await dialog.getByRole('button', { name: 'Toepassen' }).click();
	await expect(van).toHaveAttribute('aria-invalid', 'true');
	await expect(dialog.getByText('31 februari bestaat niet.')).toBeVisible();
	await expect(dialog).toBeVisible();
	await van.fill('1-3-2024');
	await van.blur();
	await expect(van).toHaveValue('1 mrt 2024');
	await dialog.getByLabel('tot').fill('2020');
	await dialog.getByRole('button', { name: 'Toepassen' }).click();
	await expect(dialog.getByText('Tot ligt voor van.')).toBeVisible();
});
