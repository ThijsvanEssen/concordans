// The aanhef of a regulation folds in its head (studie-aanhef, variant B): closed the line of
// its grondslag says what it rests on; open, the aanhef takes the place of that line, its
// Gelet op links as in the text. A regulation without one shows no fold (renormalize-bwb
// fills them, 29 Oct: none yet on prod, so the answer is patched here).
import { expect, test } from '../support/test';
import { patchApi } from '../support/api';

const REGELING = '/wetten/BWBR0052884';
const WIE =
	'De Staatssecretaris van Economische Zaken en Klimaat, na overleg met de Minister van Justitie en Veiligheid,';
const GELET = 'Gelet op artikel 19 van het Cyberbeveiligingsbesluit;';
const BESLUIT = 'Besluit:';
const TEXT = [WIE, GELET, BESLUIT].join('\n');
const at = (s: string) => TEXT.indexOf(s);

const PREAMBLE = {
	text: TEXT,
	parts: [
		{ kind: 'wie', start: 0, end: WIE.length },
		{ kind: 'considerans', start: at(GELET), end: at(GELET) + GELET.length },
		{ kind: 'gelet_op', start: at(GELET), end: at(GELET) + GELET.length },
		{ kind: 'afkondiging', start: at(BESLUIT), end: TEXT.length }
	],
	references: [
		{
			leden: [],
			onderdelen: [],
			aanhef: false,
			kind: 'extref',
			bwb_id: 'BWBR0052875',
			article: '19',
			celex: null,
			doc: '1.0:c:BWBR0052875&artikel=19',
			text: 'artikel 19',
			start: at('artikel 19'),
			end: at('artikel 19') + 'artikel 19'.length,
			footnote: null,
			target: {
				collection: 'articles',
				key: 'bwbr0052875_19',
				id: 'articles/bwbr0052875_19',
				exists: true
			}
		}
	]
};

test('the aanhef opens in the head in place of the line of its grondslag', async ({ page }) => {
	await patchApi(page, /^\/api\/instruments\/BWBR0052884$/, (body) => ({
		...body,
		preamble: PREAMBLE
	}));
	await page.goto(REGELING);
	const grondslag = page.locator('.whole-count', { hasText: /^Op grond van/ }).first();
	await expect(grondslag).toBeVisible();
	const toggle = page.locator('summary', { hasText: /^Aanhef$/ });
	await toggle.click();
	const aanhef = page.locator('#kop-aanhef');
	await expect(aanhef).toContainText('De Staatssecretaris van Economische Zaken en Klimaat');
	await expect(aanhef.locator('.besluit')).toHaveText(BESLUIT);
	await expect(aanhef.getByRole('link', { name: 'artikel 19' })).toHaveAttribute(
		'href',
		/bwbr0052875_19|BWBR0052875\/artikel\/19/
	);
	// Nothing stands twice: the line of the grondslag gives way.
	await expect(page.locator('.whole-count', { hasText: /^Op grond van/ })).toHaveCount(0);
	await toggle.click();
	await expect(grondslag).toBeVisible();
});

test('a regulation without an aanhef has no fold for it', async ({ page }) => {
	await page.goto(REGELING);
	await expect(page.locator('.whole-count', { hasText: /^Op grond van/ }).first()).toBeVisible();
	await expect(page.locator('summary', { hasText: /^Aanhef/ })).toHaveCount(0);
});
