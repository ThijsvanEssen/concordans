// One vote bar and one outcome, wherever a vote is read (besluit 33, T5 E5): Actueel draws
// the bar of its stemmingen, and the head of a stemming says its outcome as the motie does,
// the word with its box, in the colour of the outcome.
import { expect, test } from '../support/test';

test('Actueel draws the bar of a vote, not a sentence of its counts', async ({ page }) => {
	await page.goto('/actueel?soort=stemming&kamer=TK');
	const feed = page.locator('.feed');
	await expect(feed.getByRole('figure', { name: 'Stemuitslag' }).first()).toBeVisible();
	await expect(feed.getByText(/^\d+ voor, \d+ tegen$/)).toHaveCount(0);
});

test('the head of a stemming says its outcome in word and box, like the motie', async ({
	page
}) => {
	await page.goto('/stemmingen/decision_154df5db_64e5_414a_9cd1_3967aab7de58');
	const uitkomst = page.locator('.r-decision .uk').first();
	await expect(uitkomst).toBeVisible();
	await expect(uitkomst).toHaveText(/^(Aangenomen|Verworpen)/);
	// The tone of the outcome, the one the motie's line has: aangenomen ja, verworpen nee.
	await expect(uitkomst).toHaveClass(/uk--(ja|nee)\b/);
});
