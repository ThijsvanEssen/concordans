// Saying what the text is (Coverage): Dutch law in force says so with its date; an EU act is
// the text as adopted, dated by its adoption, with EUR-Lex as the source; a regeling whose
// text is not read in points to wetten.overheid.nl; a bron without verbindingen says so; a
// law of the Staatsblad says what of it is not read yet; a group of search results says what
// its search reads; a source the runs no longer fetch says so on Bronnen and in its list; a
// text says how many of its references are not linked, a Kamerstuk without text why, and an
// open bill that no end is recorded.
import { expect, test } from '../support/test';
import { patchApi } from '../support/api';

test('Dutch law says it is the law in force, since when', async ({ page }) => {
	await page.goto('/wetten/BWBR0005289/artikel/6:162?lezen=1');
	await expect(page.getByText('Geldend recht, tekst sinds 1 januari 1992')).toBeVisible();
});

test('an EU article is the text as adopted, dated so, and sourced to EUR-Lex', async ({ page }) => {
	await page.goto('/wetten/32016R0679/artikel/6?lezen=1');
	await expect(
		page.getByText(/^Tekst zoals vastgesteld op 27 april 2016, latere wijzigingen niet verwerkt/)
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'EUR-Lex ↗' })).toHaveAttribute(
		'href',
		/eur-lex\.europa\.eu\/.*CELEX:32016R0679/
	);
	await expect(page.getByText(/^Geldend recht/)).toHaveCount(0);

	await page.getByRole('button', { name: 'Citeer', exact: true }).click();
	const cite = page.getByRole('menu', { name: /^Citeer art\. 6 / });
	await expect(cite.getByRole('menuitem', { name: /voluit$/ })).toContainText(
		'Verordening (EU) 2016/679'
	);
	// Dated as adopted, never as in force on a day.
	await expect(cite.getByRole('menuitem', { name: /met datum$/ })).toContainText(
		'tekst zoals vastgesteld op 27 april 2016'
	);
	await expect(cite).not.toContainText('geldend');
	await expect(cite.getByRole('menuitem', { name: 'eur-lex.europa.eu ↗' })).toBeVisible();
});

test('a regeling without its text read in points to wetten.overheid.nl', async ({ page }) => {
	await page.goto('/wetten/BWBR0038996?lezen=1');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Aanwijzing afpakken');
	const note = page.getByRole('paragraph').filter({ hasText: 'Tekst niet in de gegevens' });
	await expect(note).toBeVisible();
	await expect(note.getByRole('link', { name: 'wetten.overheid.nl ↗' })).toHaveAttribute(
		'href',
		/wetten\.overheid\.nl\/.*BWBR0038996/
	);
});

test('a bron without verbindingen says so', async ({ page, touch }) => {
	test.skip(touch, 'Verbonden stands beside the text from 1440');
	await page.goto('/wetten/BWBR0038996');
	await expect(
		page.getByRole('complementary', { name: 'Verbonden' }).getByText('Geen verbindingen.')
	).toBeVisible();
});

test('each group of results says what its search reads', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('combobox', { name: 'Zoeken' }).fill('onrechtmatige daad');
	const results = page.getByRole('listbox', { name: 'Resultaten' });
	await expect(results.getByRole('group', { name: 'Wetten' })).toBeVisible();
	await expect(results.getByRole('group', { name: /laden…$/ })).toHaveCount(0, { timeout: 30_000 });
	await expect(results.getByText('Gezocht in titels en nummers, niet in de tekst')).toBeVisible();
	await expect(results.getByText('Gezocht in titels, nummers en de tekst')).toBeVisible();
});

test('a law of the Staatsblad says what of it is not read yet, and so do its articles', async ({
	page
}) => {
	await page.goto('/wetten/STB-2026-56?lezen=1');
	await expect(page.getByText('Verwijzingen en begrippen nog niet verwerkt')).toBeVisible();
	await page.goto('/wetten/STB-2026-56/artikel/2.8.6?lezen=1');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('2.8.6');
	await expect(page.getByText(/nog niet verwerkt$/)).toBeVisible();
});

/** The stats with the EHRM's source paused on 8 October 2026: the runs no longer fetch it. */
const echrPaused = (stats: Record<string, unknown>) => {
	const asOf = stats.data_as_of as Record<string, Record<string, unknown>>;
	return {
		...stats,
		data_as_of: {
			...asOf,
			echr: {
				...asOf.echr,
				completeness: { source: { state: 'paused', as_of: '2026-10-08T20:53:06Z', missing: null } }
			}
		}
	};
};

test('Bronnen says of a paused source that it is, and the day it reached', async ({ page }) => {
	await patchApi(page, /^\/api\/stats$/, echrPaused);
	await page.goto('/bronnen');
	await expect(page.getByText('Gepauzeerd, bijgewerkt tot 8 oktober 2026')).toBeVisible();
	// A source the runs still fetch says how far it goes.
	await expect(page.getByText(/opgehaald op/).first()).toBeVisible();
});

test('the list of the EHRM says its source is paused', async ({ page }) => {
	await patchApi(page, /^\/api\/stats$/, echrPaused);
	await page.goto('/explore?mode=index&kind=judgments&source=echr');
	await expect(page.getByText('HUDOC gepauzeerd, bijgewerkt tot 8 oktober 2026')).toBeVisible();
});

// The parts the API gives from 0.79.68 (#840, #842, #846), patched in until it is live.
const DOCUMENT = /^\/api\/documents\/be1567ec_1ee5_42ce_a886_13d46d19c6b2$/;
const part = (state: string, as_of: string | null = null, missing: number | null = null) => ({
	state,
	as_of,
	missing
});

test('an article, a judgment and a Kamerstuk say how many references are not linked', async ({
	page
}) => {
	const partial = (body: Record<string, unknown>) => ({
		...body,
		completeness: { references: part('partial', null, 3) }
	});
	await patchApi(page, /^\/api\/articles\/BWBR0005289\/162$/, partial);
	await patchApi(page, /^\/api\/judgments\/ECLI(:|%3A)NL(:|%3A)HR(:|%3A)2019(:|%3A)2006$/, partial);
	await patchApi(page, DOCUMENT, partial);
	await page.goto('/wetten/BWBR0005289/artikel/6:162?lezen=1');
	await expect(page.getByText('3 verwijzingen niet gelegd')).toBeVisible();
	await page.goto('/uitspraken/ECLI:NL:HR:2019:2006?lezen=1');
	await expect(page.getByText('3 verwijzingen niet gelegd')).toBeVisible();
	await page.goto('/kamerstukken/32467/14?lezen=1');
	await expect(page.getByText('3 verwijzingen niet gelegd')).toBeVisible();
});

test('a Kamerstuk without its text says why, and points to the original file', async ({ page }) => {
	const pending = part('pending', '2026-10-20T03:12:00Z');
	await patchApi(page, DOCUMENT, (body) => ({
		...body,
		text: null,
		sections: [],
		paragraphs: [],
		tables: [],
		footnotes: [],
		completeness: { text: pending, paragraphs: pending, tables: pending }
	}));
	await page.goto('/kamerstukken/32467/14?lezen=1');
	await expect(page.getByText('Tekst nog niet beschikbaar', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Origineel bestand ↗' })).toBeVisible();
	await expect(page.getByText(/alinea's/i)).toHaveCount(0);
});

test('an open bill says no end is recorded, with its last activity', async ({ page }) => {
	await patchApi(page, /^\/api\/dossiers\/36496$/, (body) => ({
		...body,
		closed: false,
		closed_on: null,
		outcome: null,
		completeness: { outcome: part('pending', '2026-09-15') }
	}));
	await page.goto('/dossiers/36496');
	await expect(
		page.getByText('Geen einde vastgelegd, laatste activiteit 15 september 2026')
	).toBeVisible();
});
