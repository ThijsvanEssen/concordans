// Besluit 32 for every kind of bron with a page (A159): it opens in Tekst at its bare address,
// Verbonden is the summary per soort (the count, at most three rows a group), the network is
// drawn on request (Netwerk tonen), and on a phone the text and Verbonden are two tabs.
import { SOORTEN } from '../support/soorten';
import { expect, test } from '../support/test';
import { naarVerbonden } from '../support/navigation';

for (const [soort, pad] of SOORTEN) {
	test(`${soort}: Tekst, Verbonden as the summary, the network on request`, async ({
		page,
		touch
	}) => {
		await page.goto(pad);
		const kop = page.getByRole('heading', { level: 1 }).first();
		await expect(kop).toBeVisible();
		const verbonden = page.getByRole('complementary', { name: 'Verbonden' });
		// On a phone Verbonden is a tab of its own, one tap from the text (A197-a).
		await naarVerbonden(page);
		await expect(verbonden).toBeVisible();

		// Not the network by default: no canvas, no drawing, the address bare.
		await expect(page.locator('canvas')).toHaveCount(0);
		await expect(page.getByTestId('network-sketch')).toHaveCount(0);
		expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(pad);

		await verbonden.scrollIntoViewIfNeeded();
		// The summary: a count, and no group shows more than three rows.
		await expect(verbonden.locator('.head__count')).toHaveText(/verbinding/);
		// The soorten come once their set is in (UX-toets T9b): wait for them.
		const groepen = verbonden.locator('section.kind');
		await expect(groepen.first()).toBeVisible();
		const rijen = await groepen.evaluateAll((els) =>
			els.map((el) => el.querySelectorAll('a.kind__title').length)
		);
		expect(Math.max(...rijen)).toBeLessThanOrEqual(3);

		// A phone shows the text or Verbonden, a tab each; wide, they stand side by side.
		if (touch) await expect(kop).toBeHidden();
		else {
			const [titel, paneel] = await Promise.all([kop.boundingBox(), verbonden.boundingBox()]);
			expect(paneel!.x, 'Verbonden beside the text').toBeGreaterThan(titel!.x);
		}

		// On request: Netwerk tonen draws it in Verbonden, one step.
		await verbonden.getByRole('button', { name: 'Netwerk tonen' }).click();
		await expect(page).toHaveURL(/toon=netwerk/);
		await expect(page.getByTestId('network-sketch')).toBeVisible();
		await expect(page.locator('canvas')).toHaveCount(0);
	});
}
