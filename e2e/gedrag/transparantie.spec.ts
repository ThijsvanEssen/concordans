// Saying what the text is (Coverage): Dutch law in force says so with its date; an EU act is
// the text as adopted, dated by its adoption, with EUR-Lex as the source; a regeling whose
// text is not read in points to wetten.overheid.nl; a bron without verbindingen says so; a
// law of the Staatsblad says what of it is not read yet; a group of search results says what
// its search reads; a source the runs no longer fetch says so on Bronnen and in its list; a
// text says how many of its references are not linked, a Kamerstuk without text why, a paper
// of the Eerste Kamer and a publication that their text is at the source, and an open bill
// that no end is recorded.
import { expect, test } from '../support/test';
import { patchApi } from '../support/api';

test('Dutch law says it is the law in force, since when', async ({ page }) => {
	await page.goto('/wetten/BWBR0005289/artikel/6:162');
	await expect(page.getByText('Geldend recht, tekst sinds 1 januari 1992')).toBeVisible();
});

test('an EU article is the text as adopted, dated so, and sourced to EUR-Lex', async ({ page }) => {
	await page.goto('/wetten/32016R0679/artikel/6');
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
	await page.goto('/wetten/BWBR0038996');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Aanwijzing afpakken');
	const note = page.getByRole('paragraph').filter({ hasText: 'Tekst niet in de gegevens' });
	await expect(note).toBeVisible();
	await expect(note.getByRole('link', { name: 'wetten.overheid.nl ↗' })).toHaveAttribute(
		'href',
		/wetten\.overheid\.nl\/.*BWBR0038996/
	);
});

test('a bron without verbindingen says so, and offers no count, table or export', async ({
	page,
	touch
}) => {
	test.skip(touch, 'Verbonden stands beside the text from 1440');
	await page.goto('/wetten/BWBR0038996');
	const verbonden = page.getByRole('complementary', { name: 'Verbonden' });
	await expect(verbonden.getByText('Geen verbindingen.')).toBeVisible();
	await expect(verbonden.getByText(/\b0 verbindingen|in een tabel|Exporteer/)).toHaveCount(0);
	await expect(verbonden.getByRole('button', { name: 'Filter' })).toHaveCount(0);
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
	await page.goto('/wetten/STB-2026-56');
	await expect(page.getByText('Verwijzingen en begrippen nog niet beschikbaar')).toBeVisible();
	await page.goto('/wetten/STB-2026-56/artikel/2.8.6');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('2.8.6');
	await expect(page.getByText(/nog niet beschikbaar$/)).toBeVisible();
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
	await expect(page.getByText('Wordt niet meer bijgewerkt, stand 8 oktober 2026')).toBeVisible();
	// A source the runs still fetch says how far it goes.
	await expect(page.getByText(/opgehaald op/).first()).toBeVisible();
});

test('the list of the EHRM says its source is paused', async ({ page }) => {
	await patchApi(page, /^\/api\/stats$/, echrPaused);
	await page.goto('/explore?mode=index&kind=judgments&source=echr');
	await expect(
		page.getByText('HUDOC wordt niet meer bijgewerkt, stand 8 oktober 2026')
	).toBeVisible();
});

// The parts the API gives from 0.79.68 (#840, #842, #846, #849), patched in until it is live.
const DOCUMENT = /^\/api\/documents\/be1567ec_1ee5_42ce_a886_13d46d19c6b2$/;
const part = (
	state: string,
	as_of: string | null = null,
	missing: number | null = null,
	reason: string | null = null
) => ({ state, as_of, missing, reason });
/** A Kamerstuk without its text, its three parts in `state`. */
const withoutText = (text: ReturnType<typeof part>) => (body: Record<string, unknown>) => ({
	...body,
	text: null,
	sections: [],
	paragraphs: [],
	tables: [],
	footnotes: [],
	completeness: { text, paragraphs: text, tables: text }
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
	await page.goto('/wetten/BWBR0005289/artikel/6:162');
	await expect(page.getByText('3 verwijzingen nog niet gekoppeld')).toBeVisible();
	await page.goto('/uitspraken/ECLI:NL:HR:2019:2006');
	await expect(page.getByText('3 verwijzingen nog niet gekoppeld')).toBeVisible();
	await page.goto('/kamerstukken/32467/14');
	await expect(page.getByText('3 verwijzingen nog niet gekoppeld')).toBeVisible();
});

test('an article whose missing references point to a text not loaded yet says so', async ({
	page
}) => {
	await patchApi(page, /^\/api\/articles\/BWBR0005289\/162$/, (body) => ({
		...body,
		completeness: { references: part('partial', null, 2, 'target_not_loaded') }
	}));
	await page.goto('/wetten/BWBR0005289/artikel/6:162');
	await expect(
		page.getByText('2 verwijzingen naar tekst die niet in de gegevens staat')
	).toBeVisible();
});

test('a Kamerstuk without its text says why, and points to the original file', async ({ page }) => {
	await patchApi(page, DOCUMENT, withoutText(part('pending', '2026-10-20T03:12:00Z')));
	await page.goto('/kamerstukken/32467/14');
	await expect(page.getByText('Tekst nog niet beschikbaar', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Origineel bestand ↗' })).toBeVisible();
	await expect(page.getByText(/alinea's/i)).toHaveCount(0);
});

test('a Kamerstuk fetched and not read yet says when it was fetched', async ({ page }) => {
	const fetched = part('pending', '2026-10-20T03:12:00Z', null, 'awaiting_normalize');
	await patchApi(page, DOCUMENT, withoutText(fetched));
	await page.goto('/kamerstukken/32467/14');
	await expect(
		page.getByText('Tekst nog niet beschikbaar, ontvangen op 20 oktober 2026', { exact: true })
	).toBeVisible();
});

test('a new Kamerstuk with its PDF only says so, and points to the file', async ({ page }) => {
	await patchApi(
		page,
		DOCUMENT,
		withoutText(part('pending', '2026-10-20T03:12:00Z', null, 'source_pdf_only'))
	);
	await page.goto('/kamerstukken/32467/14');
	await expect(
		page.getByText('Tekst nog niet beschikbaar, de bron heeft alleen de pdf', { exact: true })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Origineel bestand ↗' })).toBeVisible();
});

test('a paper of the Eerste Kamer says its text is at the source, with a link', async ({
	page
}) => {
	await patchApi(page, /^\/api\/documents\/ek_kst_1264285$/, withoutText(part('not_fetched')));
	await page.goto('/kamerstukken/36600-VIII/AB');
	const note = page.getByRole('paragraph').filter({ hasText: 'Tekst alleen bij de bron' });
	await expect(note).toHaveText('Tekst alleen bij de bron, officielebekendmakingen.nl ↗');
	await expect(note.getByRole('link')).toHaveAttribute(
		'href',
		'https://zoek.officielebekendmakingen.nl/kst-1264285.html'
	);
});

test('a publication says its text is at the source, with a link', async ({ page }) => {
	await patchApi(page, /^\/api\/instruments\/stb_2026_94$/i, (body) => ({
		...body,
		completeness: { text: part('not_fetched') }
	}));
	await page.goto('/stb/2026/94');
	await expect(page.getByText(/^Tekst alleen bij de bron, /)).toBeVisible();
	await expect(page.getByRole('link', { name: 'officielebekendmakingen.nl ↗' })).toHaveAttribute(
		'href',
		/zoek\.officielebekendmakingen\.nl\/stb-2026-94/
	);
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
