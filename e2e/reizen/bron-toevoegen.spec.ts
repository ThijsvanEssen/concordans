// Bron toevoegen (NetwerkPaneel): the button opens the one search in a dialog; Enter adds the
// bron and leaves the dialog open, a bron already chosen says so, Esc closes it and gives the
// focus back to the button.
import { apiPath, CORS } from '../support/api';
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';

const CHOSEN = 'instruments/bwbr0005537';
const NEW = 'instruments/bwbr0010346';

const hit = (id: string, name: string) => ({
	id,
	key: id.split('/')[1],
	collection: 'instruments',
	type: 'instrument',
	display_name: name,
	snippet: `${name}, met een huurverhoging`,
	score: 0.5,
	extra: { bwb_id: id.split('/')[1].toUpperCase(), citation_title: name, kind: 'wet' },
	path: `/wetten/${id.split('/')[1].toUpperCase()}`
});

test('Bron toevoegen: search, Enter adds, a chosen bron says so, Esc gives the focus back', async ({
	page
}) => {
	await page.route(apiPath(/\/api\/search/), (route) => {
		const types = new URL(route.request().url()).searchParams.getAll('types');
		const instruments = types.includes('instruments')
			? [hit(NEW, 'Wet op de huurverhoging'), hit(CHOSEN, 'Algemene wet bestuursrecht')]
			: [];
		return route.fulfill({
			status: 200,
			headers: { ...CORS, 'content-type': 'application/json' },
			body: JSON.stringify({
				q: 'huurverhoging',
				types,
				total: instruments.length,
				words: [],
				left_out: [],
				matched: 'all',
				best: null,
				partial: {},
				searched: {},
				results: { instruments }
			})
		});
	});
	await page.goto(`/explore?netwerk=${CHOSEN}`);
	await openSheet(page);
	const panel = page.getByRole('region', { name: 'Netwerk' });
	const open = panel.getByRole('button', { name: 'Bron toevoegen' });
	await open.click();

	const dialog = page.getByRole('dialog', { name: 'Bron toevoegen' });
	const field = dialog.getByRole('combobox', { name: 'Zoeken' });
	await expect(field).toBeFocused();
	await expect(dialog.getByRole('group', { name: 'Soort bron' })).toBeVisible();
	await field.fill('huurverhoging');

	const results = dialog.getByRole('listbox', { name: 'Resultaten' });
	await expect(results.getByRole('option', { name: /Wet op de huurverhoging/ })).toBeVisible();
	// A bron already chosen says so.
	await expect(results.getByRole('option', { name: /Algemene wet bestuursrecht/ })).toContainText(
		'al in het netwerk'
	);

	// The arrow chooses the first row, Enter adds it and the dialog stays open.
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(new RegExp(`netwerk=[^&]*${NEW.split('/')[1]}`));
	await expect(dialog).toBeVisible();
	// Said as a status line with the way back: Bevestiging on a wide screen, the melding on a phone.
	await expect(
		page.getByRole('status').filter({ hasText: 'toegevoegd aan het netwerk' })
	).toBeVisible();
	await expect(
		page.getByRole('status').getByRole('button', { name: 'Ongedaan maken' })
	).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
	await expect(open).toBeFocused();
});
