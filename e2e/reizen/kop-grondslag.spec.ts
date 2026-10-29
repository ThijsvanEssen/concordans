// The head of a regulation says what it rests on ("Op grond van art. 19, 23 lid 1 en 28 van het
// Cyberbeveiligingsbesluit"): each article is the reference of the running text, with its
// glance and the lid it names marked where it opens, and a finger's 44 px to hit.
import { expect, test } from '../support/test';

const REGELING = '/wetten/BWBR0052884';

test('an article of the head opens at its lid, marked, and shows a glance on hover', async ({
	page,
	touch
}) => {
	await page.goto(REGELING);
	const kop = page.locator('.whole-count', { hasText: /^Op grond van/ }).first();
	const lid = kop.getByRole('link', { name: '23 lid 1', exact: true });
	await expect(lid).toHaveAttribute('href', /#lid-1$/);
	// An article the head names whole has no lid to mark.
	await expect(kop.getByRole('link', { name: '19', exact: true })).not.toHaveAttribute(
		'href',
		/#lid-/
	);
	if (touch) {
		// A finger's 44 px, in the line of the sentence.
		const box = (await lid.evaluate((e) => {
			const r = getComputedStyle(e, '::after');
			return { h: parseFloat(r.height) };
		}))!;
		expect(box.h).toBeGreaterThanOrEqual(44);
	} else {
		await lid.hover();
		await expect(page.getByRole('tooltip')).toBeVisible();
	}
	await lid.click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0052875\/artikel\/23#lid-1$/);
	// The text of the regulation holds more articles with a lid 1: one is marked.
	await expect(page.locator('#lid-1.is-landed')).toHaveCount(1);
});
