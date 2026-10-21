// The parliamentary record: a dossier with its stand and procedure, a stuk opened in place, a
// Kamerstuk with its indiener and its vote at rest, a vote with its outcome per fractie, a
// passed bill with its law, and a memorie van toelichting beside the article it explains.
import { patchApi } from '../support/api';
import { expect, test } from '../support/test';

test('a dossier shows where it stands and opens a stuk of its procedure in place', async ({
	page
}) => {
	await page.goto('/dossiers/36496');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wet betaalbare huur');
	await expect(page.getByRole('region', { name: 'Stand van zaken' })).toContainText(
		'Aangenomen door de Eerste Kamer'
	);
	await page.getByRole('button', { name: 'Procedure' }).click();
	// One click on the line opens the stuk in place; its source is one step further.
	await page.getByRole('link', { name: 'Advies en nader rapport', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Inhoud van Advies en nader rapport' })
	).toHaveAttribute('aria-expanded', 'true');
	await expect(page).toHaveURL(/\/dossiers\/36496$/);

	await page.getByRole('button', { name: /^Amendementen( \d+)?$/ }).click();
	await expect(page.getByRole('button', { name: /^Amendementen( \d+)?$/ })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
});

test('a Kamerstuk names its indiener and its dossier, and folds out its vote', async ({ page }) => {
	await page.goto('/kamerstukken/36799/31?lezen=1');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Motie van het lid De Beer');
	await expect(page.getByText('Kamerstukken II 2025/26, 36799, nr. 31.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'M.E.E. de Beer' })).toBeVisible();
	await expect(
		page.getByRole('navigation', { name: 'Behoort bij' }).getByRole('link', { name: /36799/ })
	).toHaveAttribute('href', /\/dossiers\/36799/);
	const vote = page.getByRole('button', { name: 'Stemming', exact: true });
	await vote.click();
	await expect(vote).toHaveAttribute('aria-expanded', 'true');
	// The vote the head already says is not said again: the section has the earlier one.
	const sectie = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Stemming', exact: true }) });
	await expect(sectie).toContainText('Uitstellen op 22 september 2026');
	await expect(sectie).not.toContainText('Aangenomen');
});

test('a motie says at rest how the Kamer voted on it, and which fracties', async ({ page }) => {
	await page.goto('/kamerstukken/36799/31?lezen=1');
	await expect(page.getByText('Aangenomen op 29 september 2026, 120 voor, 30 tegen')).toBeVisible();
	await expect(page.getByText(/^D66, VVD, PVV/)).toBeVisible();
	await expect(page.getByText('PRO, Groep Markuszower, PvdD')).toBeVisible();
	// The stemming itself is one step further, by its day.
	await expect(page.getByRole('link', { name: '29 september 2026' })).toHaveAttribute(
		'href',
		/\/stemmingen\/decision_1b1d379a_01c9_495c_a25e_108e9b87ab2e/
	);
});

test('a passed bill names the law it made, its Staatsblad and the day it came into force', async ({
	page
}) => {
	await page.goto('/dossiers/36496');
	await expect(
		page.getByText(
			'Vastgesteld als Wet betaalbare huur, Stb. 2024, 193; in werking getreden op 1 juli 2024.'
		)
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Stb. 2024, 193' })).toHaveAttribute(
		'href',
		'/stb/2024/193'
	);
	await expect(
		page.getByRole('link', { name: 'Wet betaalbare huur', exact: true }).first()
	).toHaveAttribute('href', /\/wetten\/BWBR0049889/);
});

test('a withdrawn bill says so in its stand, with the letter that withdrew it', async ({
	page
}) => {
	// The shape of API 0.80.1 (#857) on a dossier the fixtures hold.
	await patchApi(page, /^\/api\/dossiers\/36496(\?|$)/, (d) => ({
		...d,
		outcome: 'ingetrokken',
		closed: true,
		closed_on: '2025-06-02',
		withdrawal_letter: 'documents/brief_intrekking',
		tk_decision: null,
		ek_outcome: null,
		enacted: []
	}));
	await page.goto('/dossiers/36496');
	const stand = page.getByRole('region', { name: 'Stand van zaken' });
	await expect(stand).toContainText('Ingetrokken bij brief van 2 juni 2025.');
	await expect(stand.getByRole('link', { name: 'brief van 2 juni 2025' })).toHaveAttribute(
		'href',
		/brief_intrekking/
	);
	await expect(stand.getByText('Niet aan de orde')).toBeVisible();
	// A bill withdrawn made no law.
	await expect(page.getByText(/^Vastgesteld als/)).toHaveCount(0);
});

test('a motion of censure is named so in its head', async ({ page }) => {
	await page.goto('/kamerstukken/37020-XVI/60?lezen=1');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('afkeuring');
	// The kind as the glossary names it, with its explanation on hover.
	await expect(page.getByRole('button', { name: /^Motie van afkeuring/ })).toBeVisible();
});

test('the Stemmingen narrow to the motions of no confidence and say when the Kamer meets', async ({
	page,
	touch
}) => {
	await page.goto('/explore?mode=index&kind=decisions&motie=wantrouwen');
	await expect(
		page.getByText(
			/^Geen vergaderingen tot 27 oktober 2026; volgende stemmingen dinsdag 27 oktober 2026$/
		)
	).toBeVisible();
	await expect(
		page.getByText('Motie van wantrouwen', { exact: true }).filter({ visible: true }).first()
	).toBeVisible();
	if (touch) await page.getByRole('button', { name: /^Verfijnen/ }).click();
	const kind = page
		.getByRole('region', { name: 'Motie' })
		.getByRole('button', { name: /^Motie van wantrouwen/ });
	await expect(kind).toHaveAttribute('aria-pressed', 'true');
	await kind.click();
	await expect(page).not.toHaveURL(/motie=/);
});

test('a vote gives its outcome and the vote of each fractie', async ({ page }) => {
	await page.goto('/stemmingen/decision_154df5db_64e5_414a_9cd1_3967aab7de58');
	await expect(page.getByRole('heading', { level: 1 })).toContainText(
		'Motie van het lid Van Oosterhout'
	);
	await expect(page.getByText('Aangenomen, Motie')).toBeVisible();
	await expect(page.getByText('105 voor, 45 tegen')).toBeVisible();
	await page.getByRole('button', { name: 'Stemverdeling per fractie' }).click();
	const fracties = page
		.getByRole('listitem')
		.filter({ has: page.getByRole('link', { name: 'D66', exact: true }) });
	await expect(fracties.first()).toContainText(/Voor.*coalitie.*26/);
	await expect(
		page
			.getByRole('listitem')
			.filter({ has: page.getByRole('link', { name: 'PVV', exact: true }) })
			.first()
	).toContainText(/Tegen/);
});

test('a memorie van toelichting opens beside its article and closes again', async ({ page }) => {
	await page.goto('/wetten/BWBR0001840/artikel/23?lezen=1');
	await page.getByRole('link', { name: 'Memorie van toelichting', exact: true }).first().click();
	await expect(page).toHaveURL(/naast=documents\//);
	await expect(page.getByText('Kamerstukken II 2016/17, 34702, nr. 3.')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1, name: 'Artikel 23' })).toBeAttached();
	await page.getByRole('link', { name: 'Sluiten' }).click();
	await expect(page).not.toHaveURL(/naast=/);
	await expect(page.getByText('Kamerstukken II 2016/17, 34702, nr. 3.')).toHaveCount(0);
});

/** The shape of #888: why a toezegging is about a dossier, on the record and on its edge. */
const TZ_NAKOMING = '02bd9062_c94a_429d_a6c9_0ff2218640f4'; // TZ202603-117, kept by 29389 nr. 186
const TZ_AGENDA = 'b354a773_4df6_4f02_bc4e_5d24e784b458'; // TZ202603-106, open
const TZ_ROW_NAKOMING = '293d314e_184d_4f69_b698_3d233772d590'; // TZ202603-121
type Rec = Record<string, unknown>;
/** Every `ABOUT` edge of a toezegging or a dossier with its basis, by the key at its far end. */
const metBasis = (v: unknown, basis: (key: string) => string): unknown => {
	if (Array.isArray(v)) return v.map((x) => metBasis(x, basis));
	if (!v || typeof v !== 'object') return v;
	const o = v as Rec;
	const rand =
		o.relation === 'ABOUT' && typeof o.key === 'string'
			? { ...o, meta: { ...(o.meta as Rec), basis: basis(o.key) } }
			: o;
	return Object.fromEntries(Object.entries(rand).map(([k, x]) => [k, metBasis(x, basis)]));
};

test('a toezegging names its dossier by the letter that fulfils it, else the debate it was discussed in', async ({
	page
}) => {
	await patchApi(page, /^\/api\/commitments\/[0-9a-f_]+$/, (t) => ({
		...t,
		dossiers:
			t.key === TZ_NAKOMING
				? [
						{
							key: '29389',
							number: '29389',
							title: 'Vergrijzing en het integrale ouderenbeleid',
							short_title: null,
							basis: 'nakoming',
							path: '/dossiers/29389'
						}
					]
				: (t.dossiers as Rec[]).map((d) => ({ ...d, basis: 'agenda' }))
	}));
	await patchApi(
		page,
		new RegExp(`^/api/nodes/commitments/${TZ_AGENDA}`),
		(n) => metBasis(n, () => 'agenda') as Rec
	);

	await page.goto('/toezeggingen/TZ202603-117');
	const feiten = page.locator('dl');
	await expect(feiten.getByRole('link', { name: /^29389 Vergrijzing/ })).toBeVisible();
	await expect(feiten.getByText('Besproken', { exact: true })).toHaveCount(0);

	await page.goto('/toezeggingen/TZ202603-106');
	await expect(feiten.getByText('Besproken', { exact: true })).toBeVisible();
	await expect(feiten.getByRole('link', { name: 'Staat van de Volkshuisvesting' })).toHaveAttribute(
		'href',
		/\/activiteiten\/2025A04175/
	);
	await expect(feiten.getByRole('link', { name: /^27926 Huurbeleid/ })).toBeVisible();
	// The agenda of its debate is not its dossier: not as a field, not in the band above.
	await expect(feiten.getByText(/^Dossiers?$/)).toHaveCount(0);
	await expect(page.getByText('Over', { exact: true })).toHaveCount(0);
});

test('a dossier marks a toezegging it only had on the agenda of the debate', async ({
	page,
	touch
}) => {
	await patchApi(
		page,
		/^\/api\/nodes\/dossiers\/36512/,
		(n) => metBasis(n, (key) => (key === TZ_ROW_NAKOMING ? 'nakoming' : 'agenda')) as Rec
	);
	await page.goto('/dossiers/36512');
	if (touch)
		await page
			.getByRole('navigation', { name: 'Panelen' })
			.getByRole('button', { name: 'Verbonden' })
			.click();
	const groep = page.locator('section[data-group="commitments"]');
	const rij = (begin: RegExp) =>
		groep.getByRole('listitem').filter({ has: page.getByRole('link', { name: begin }) });
	await expect(rij(/^Voor de zomer ontvangt de Kamer een brief van de minister/)).toContainText(
		'Besproken in het debat'
	);
	await expect(rij(/^Voor de zomer ontvangt de Kamer de inzet/)).not.toContainText('Besproken');
});

test('a toezegging in the list names the debate its agenda came from, opened in place too', async ({
	page
}) => {
	await patchApi(page, /^\/api\/commitments\?/, (l) => ({
		...l,
		items: (l.items as Rec[]).map((t) => ({
			...t,
			dossiers: (t.dossiers as Rec[]).map((d) => ({ ...d, basis: 'agenda' }))
		}))
	}));
	await page.goto('/explore?mode=index');
	await page
		.getByRole('main')
		.getByRole('link', { name: /^Toezeggingen [\d.]+$/ })
		.click();
	const rij = page
		.getByRole('main')
		.getByRole('listitem')
		.filter({ hasText: 'De staatssecretaris informeert de Kamer in de voor' })
		.first();
	await expect(rij).toContainText(
		'besproken in het debat over Arbitrage, mediation en herstelrecht'
	);
	await expect(rij).not.toContainText('Kamerstuk');
	await rij.getByRole('link').first().click();
	await expect(rij.getByText(/^Besproken in het debat over/)).toBeVisible();
	await expect(
		rij.getByRole('link', { name: 'Arbitrage, mediation en herstelrecht' })
	).toBeVisible();
});
