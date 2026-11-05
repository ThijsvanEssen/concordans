// The heading of a layer of the keten is pinned: as the drawing pans it passes over every label
// of its row. Labels stacked over one regulation keep clear of it, wherever the drawing stands.
// The links above the keten keep clear of each other: on a phone each has a finger's 44 px.
import { expect, test } from '../support/test';

for (const [name, bwb] of [
	['WVW', 'bwbr0006622'],
	['Grondwet', 'bwbr0001840'],
	['Awb', 'bwbr0005537']
] as const)
	test(`the labels of the ${name} keten touch no heading of a layer`, async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'a list on a phone');
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(`/explore?netwerk=instruments/${bwb}&weergave=keten`);
		await expect(page.locator('svg.drawing .cite .frame').first()).toBeAttached();
		await page.waitForLoadState('networkidle');
		const touching = await page.evaluate(async () => {
			const pan = document.querySelector<HTMLElement>('.chain .pan')!;
			const hits = new Set<string>();
			const heads = [...document.querySelectorAll('svg.drawing .layer-label')];
			const frames = [...document.querySelectorAll('svg.drawing .cite')];
			for (let x = 0; x <= pan.scrollWidth; x += 48) {
				pan.scrollLeft = x;
				await new Promise(requestAnimationFrame);
				for (const head of heads) {
					const h = head.getBoundingClientRect();
					for (const c of frames) {
						const f = c.querySelector('.frame')!.getBoundingClientRect();
						if (f.x < h.right && f.right > h.x && f.y < h.bottom && f.bottom > h.y)
							hits.add(`${c.textContent?.trim()} on ${head.textContent}`);
					}
				}
			}
			return [...hits];
		});
		expect(touching).toEqual([]);
	});

test('on a phone each link above the keten has a target of 44 px of its own', async ({
	page,
	touch
}) => {
	test.skip(!touch, 'a finger');
	await page.goto('/explore?netwerk=instruments/bwbr0006622&weergave=keten');
	const links = [
		page.getByRole('button', { name: /^Ook \d+ vervallen/ }),
		page.getByRole('button', { name: /^Genoemd in/ })
	];
	for (const link of links) {
		await expect(link).toBeVisible();
		const taken = await link.evaluate((el) => {
			const r = el.getBoundingClientRect();
			const x = r.x + r.width / 2;
			const middle = r.y + r.height / 2;
			const others: number[] = [];
			for (let dy = -21; dy <= 21; dy++)
				if (!el.contains(document.elementFromPoint(x, middle + dy))) others.push(dy);
			return others;
		});
		expect(taken, await link.innerText()).toEqual([]);
	}
});
