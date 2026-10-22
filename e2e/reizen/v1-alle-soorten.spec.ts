// Besluit 32 for every kind of bron with a page (A159): it opens in Tekst at its bare address,
// Verbonden is the summary per soort (the count, at most three rows a group), the network is
// drawn on request (Netwerk tonen), and on a phone the text and Verbonden stand under each other.
import { expect, test } from '../support/test';

const SOORTEN: [soort: string, pad: string][] = [
	['wet', '/wetten/BWBR0005289'],
	['artikel', '/wetten/BWBR0005289/artikel/6:162'],
	['bijlage', '/wetten/BWBR0004054/bijlage/I'],
	['verdrag', '/wetten/BWBV0007162'],
	['EU-akte', '/wetten/32016R0679'],
	['publicatie', '/stb/2026/94'],
	['uitspraak', '/uitspraken/ECLI:NL:HR:2019:2006'],
	['dossier', '/dossiers/36496'],
	['Kamerstuk', '/kamerstukken/36799/31'],
	['motie', '/kamerstukken/36764/19'],
	['zaak', '/zaken/2025Z11356'],
	['activiteit', '/activiteiten/2026A01323'],
	['stemming', '/stemmingen/decision_154df5db_64e5_414a_9cd1_3967aab7de58'],
	['toezegging', '/toezeggingen/TZ202603-117'],
	['Kamerlid', '/leden/rob-jetten'],
	['bewindspersoon', '/leden/marielle-paul'],
	['fractie', '/fracties/d66'],
	['commissie', '/commissies/szw'],
	['kabinet', '/kabinetten/rutte_iv']
];

for (const [soort, pad] of SOORTEN) {
	test(`${soort}: Tekst, Verbonden as the summary, the network on request`, async ({
		page,
		touch
	}) => {
		await page.goto(pad);
		const kop = page.getByRole('heading', { level: 1 }).first();
		await expect(kop).toBeVisible();
		const verbonden = page.getByRole('complementary', { name: 'Verbonden' });
		await expect(verbonden).toBeVisible();

		// Not the network by default: no canvas, no drawing, the address bare.
		await expect(page.locator('canvas')).toHaveCount(0);
		await expect(page.getByTestId('network-sketch')).toHaveCount(0);
		expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(pad);

		// On a phone Verbonden loads once it comes into view (laad lui).
		await verbonden.scrollIntoViewIfNeeded();
		// The summary: a count, and no group shows more than three rows.
		await expect(verbonden.locator('.head__count')).toHaveText(/verbinding/);
		const groepen = verbonden.locator('section.kind');
		expect(await groepen.count()).toBeGreaterThan(0);
		const rijen = await groepen.evaluateAll((els) =>
			els.map((el) => el.querySelectorAll('a.kind__title').length)
		);
		expect(Math.max(...rijen)).toBeLessThanOrEqual(3);

		// A phone stacks the text and Verbonden in one scroll; wide, they stand side by side.
		const [titel, paneel] = await Promise.all([kop.boundingBox(), verbonden.boundingBox()]);
		if (touch) expect(paneel!.y, 'Verbonden under the text').toBeGreaterThan(titel!.y);
		else expect(paneel!.x, 'Verbonden beside the text').toBeGreaterThan(titel!.x);

		// On request: Netwerk tonen draws it in Verbonden, one step.
		await verbonden.getByRole('button', { name: 'Netwerk tonen' }).click();
		await expect(page).toHaveURL(/toon=netwerk/);
		await expect(page.getByTestId('network-sketch')).toBeVisible();
		await expect(page.locator('canvas')).toHaveCount(0);
	});
}
