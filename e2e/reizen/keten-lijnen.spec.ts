// The keten (besluit 39, A306): no omhulling, the layer is the group; the lines a stamboom of
// beziers that cross neither a name nor each other; a judgment's lines counted as Aanhaling.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

// The drawing is for a wide screen; on a phone the keten is a list.
test.skip(({ isMobile }) => isMobile, 'a list on a phone');

test('the keten has no omhulling and no pill: the layer is the group', async ({ page }) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	await expect(page.locator('.chain .name').first()).toBeVisible();
	await expect(page.locator('.chain .hull')).toHaveCount(0);
	await expect(page.locator('.chain .pil')).toHaveCount(0);
});

/** Each line of the drawing as points along it, with its parent, in the drawing's own units. */
const drawn = (page: Page) =>
	page.locator('svg.drawing').evaluate((svg) => ({
		lines: [...svg.querySelectorAll<SVGPathElement>('path.line')].map((p) => {
			const n = Math.ceil(p.getTotalLength() / 3);
			return {
				parent: p.dataset.parent ?? '',
				d: p.getAttribute('d') ?? '',
				pts: Array.from({ length: n + 1 }, (_, i) => {
					const q = p.getPointAtLength((p.getTotalLength() * i) / n);
					return { x: q.x, y: q.y };
				})
			};
		}),
		names: [...svg.querySelectorAll<SVGTextElement>('.name, .subhead')].map((t) => {
			const b = t.getBBox();
			return { x0: b.x + 1, x1: b.x + b.width - 1, y0: b.y + 1, y1: b.y + b.height - 1 };
		})
	}));

const KETENS = [
	'/leden/rob-jetten?mode=netwerk&weergave=keten',
	'/uitspraken/ECLI:NL:HR:2019:2006?mode=netwerk&weergave=keten'
];

for (const url of KETENS) {
	test(`the lines of ${url.split('?')[0]} are beziers that cross neither a name nor each other`, async ({
		page
	}) => {
		await page.goto(url);
		await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
		const { lines, names } = await drawn(page);
		expect(lines.length).toBeGreaterThan(0);
		// No corner: every line is eased by curves.
		for (const l of lines) expect(l.d).toMatch(/^M[\d. -]+(?:[LQC][\d. -]+)+$/);
		// No line through a name.
		const through = lines.flatMap((l) =>
			l.pts.filter((q) => names.some((n) => q.x > n.x0 && q.x < n.x1 && q.y > n.y0 && q.y < n.y1))
		);
		expect(through).toHaveLength(0);
		// No crossing between lines of different parents.
		const ccw = (p: { x: number; y: number }, q: typeof p, r: typeof p) =>
			(q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
		let crossings = 0;
		for (let i = 0; i < lines.length; i++)
			for (let j = i + 1; j < lines.length; j++) {
				if (lines[i].parent === lines[j].parent) continue;
				const [a, b] = [lines[i].pts, lines[j].pts];
				for (let x = 1; x < a.length; x++)
					for (let y = 1; y < b.length; y++)
						if (
							ccw(a[x - 1], a[x], b[y - 1]) * ccw(a[x - 1], a[x], b[y]) < -1e-6 &&
							ccw(b[y - 1], b[y], a[x - 1]) * ccw(b[y - 1], b[y], a[x]) < -1e-6
						)
							crossings++;
			}
		expect(crossings).toBe(0);
	});
}

test('the layers of a Kamerlid stand in the order of their rubriek: Parlement, then Regering', async ({
	page
}) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	const labels = (await page.locator('.chain .layer-label').allTextContents()).map((t) =>
		t.trim().toLowerCase()
	);
	const order = ['kamerlid', 'bewindspersoon', 'fractie', 'commissie', 'kabinet', 'ministerie'];
	expect(labels).toEqual(order.filter((l) => labels.includes(l)));
});

test('the keten of a judgment counts the lines it draws as Aanhaling', async ({ page }) => {
	await page.goto('/uitspraken/ECLI:NL:HR:2019:2006?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	await expect(page.locator('path.line')).toHaveCount(3);
	await expect(page.getByText('Aanhaling').first()).toBeVisible();
});

test('no name of the keten leaves the drawing or is cut', async ({ page }) => {
	await page.goto('/uitspraken/ECLI:NL:HR:2019:2006?mode=netwerk&weergave=keten');
	const chain = page.getByRole('group', { name: 'Keten' });
	await expect(chain).toBeVisible();
	const { frame, names } = await chain.evaluate((svg) => {
		const f = svg.getBoundingClientRect();
		return {
			frame: { x: f.x, right: f.right },
			names: [...svg.querySelectorAll('.name')].map((n) => {
				const r = n.getBoundingClientRect();
				return { x: r.x, right: r.right, text: n.textContent ?? '' };
			})
		};
	});
	expect(names.length).toBeGreaterThan(0);
	for (const n of names) {
		expect(n.x).toBeGreaterThanOrEqual(frame.x - 1);
		expect(n.right).toBeLessThanOrEqual(frame.right + 1);
		expect(n.text).not.toContain('…');
	}
});

test('the keten of a Kamerlid names each layer once: Ministerie is no Kamerlid', async ({
	page
}) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	const labels = (await page.locator('.chain .layer-label').allTextContents()).map((t) =>
		t.trim().toLowerCase()
	);
	expect(new Set(labels).size).toBe(labels.length);
});

test('a ministerie of a bewindspersoon hangs under its kabinet, not under the person', async ({
	page
}) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	const { lines } = await drawn(page);
	const ministry = lines.filter((l) => l.parent.startsWith('cabinets/'));
	expect(ministry).toHaveLength(3);
	const labels = await page.locator('.chain .layer-label').allTextContents();
	expect(labels.map((t) => t.trim().toLowerCase())).toContain('ministerie');
});

test('Tonen counts what the layer says: the bronnen drawn and "N andere" are one number', async ({
	page
}) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	const alle = page
		.getByRole('group', { name: 'Keten' })
		.getByRole('button', { name: /^\d+ andere / });
	const others = Number((await alle.first().textContent())!.replace(/\D/g, ''));
	// The bronnen drawn in the layer of that card.
	const drawn = await page.locator('svg.drawing').evaluate((svg) => {
		const cy = svg.querySelector('.others circle.hit')!.getAttribute('cy');
		return [...svg.querySelectorAll('.node circle.hit')].filter((c) => c.getAttribute('cy') === cy)
			.length;
	});
	await expect(
		page.locator('.legend .optie', { hasText: 'Commissies' }).locator('.aantal')
	).toHaveText(String(others + drawn));
});

test('the keyboard goes layer by layer: a layer’s card of the others comes after its bronnen', async ({
	page
}) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	const chain = page.getByRole('group', { name: 'Keten' });
	await expect(chain).toBeVisible();
	const stops = await chain.evaluate((svg) =>
		[...svg.querySelectorAll('[tabindex="0"]')].map((e) =>
			e.classList.contains('others') ? 'alle' : 'bron'
		)
	);
	expect(stops[0]).toBe('bron');
	for (const [i, s] of stops.entries()) if (s === 'alle') expect(stops[i - 1]).toBe('bron');
});

test('the label of a layer and its card of the others stand clear of the Deel button', async ({
	page
}) => {
	await page.goto('/leden/rob-jetten?mode=netwerk&weergave=keten');
	const chain = page.getByRole('group', { name: 'Keten' });
	await expect(chain).toBeVisible();
	const deel = await page.getByRole('button', { name: 'Deel', exact: true }).first().boundingBox();
	const hits = await chain
		.locator('.others .hit')
		.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
	for (const top of hits) expect(top).toBeGreaterThanOrEqual(deel!.y + deel!.height);
});

test('BW 7: a line to a layer further down runs no long U through the layer between', async ({
	page
}) => {
	await page.goto('/wetten/BWBR0005290?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	await expect(page.locator('.chain .name').first()).toBeVisible();
	const { lines, names } = await drawn(page);
	expect(lines.length).toBeGreaterThan(0);
	// No line through a name.
	const through = lines.flatMap((l) =>
		l.pts.filter((q) => names.some((n) => q.x > n.x0 && q.x < n.x1 && q.y > n.y0 && q.y < n.y1))
	);
	expect(through).toHaveLength(0);
	// No "U": a line goes across no further than its parent and its child are apart (a stem that
	// runs out beside the layer and back adds to its sideways travel).
	for (const l of lines) {
		const dx = l.pts.slice(1).reduce((sum, q, i) => sum + Math.abs(q.x - l.pts[i].x), 0);
		const net = Math.abs(l.pts.at(-1)!.x - l.pts[0].x);
		// A layer packed with names between forces a stem beside it (no line through a name comes
		// first), the wider the more the drawing shows: up to 220.
		expect(dx - net, l.d).toBeLessThan(220);
	}
});

test('Cbw: a regeling stands in the row of its kind, its line labelled with the articles and the law; the row pans sideways', async ({
	page
}) => {
	await page.goto('/wetten/BWBR0052872?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	await expect(page.locator('.chain .name').first()).toBeVisible();
	// No layer of articles: the layers are the kinds of document.
	await expect(page.locator('.chain .layer-label')).toHaveText([
		'RICHTLIJN',
		'WET',
		'AMVB',
		'MINISTERIËLE REGELING'
	]);
	// A line says which articles of which law it rests on.
	await expect(
		page.locator('.chain .cite text', { hasText: 'art. 68 Cbw' }).first()
	).toBeAttached();
	await expect(
		page.locator('.chain .cite text', { hasText: 'art. 19, 23 lid 1, 28 Cbb' }).first()
	).toBeAttached();
	// The row is wider than the screen and pans in itself.
	const pan = page.locator('.pan[data-zijscroll]');
	expect(await pan.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
	// The grondslag on hover, with the abbreviation.
	await page
		.locator('.chain .node', { hasText: /EZK/, hasNotText: /aanwijzing/ })
		.first()
		.hover({ force: true });
	await expect(page.getByRole('tooltip')).toContainText('Grondslag art. 19, 23 lid 1, 28 Cbb');
});

test('Cbb: the laws it rests on stand above it, each line labelled, no Richtlijn above an AMvB', async ({
	page
}) => {
	await page.goto('/wetten/BWBR0052875?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	await expect(page.locator('.chain .name').first()).toBeVisible();
	await expect(page.locator('.chain .layer-label')).toHaveText([
		'WET',
		'AMVB',
		'MINISTERIËLE REGELING'
	]);
	await expect(page.locator('.chain .cite text', { hasText: '11 art. Cbw' })).toBeAttached();
});

test('Cbw: the label on a line is a link; Tab reaches it, hover shows the articles, Enter opens the first at its lid', async ({
	page
}) => {
	await page.goto('/wetten/BWBR0052872?mode=netwerk&weergave=keten');
	await expect(page.getByRole('group', { name: 'Keten' })).toBeVisible();
	await expect(page.locator('.chain .name').first()).toBeVisible();
	const label = page.locator('.chain a.cite', { hasText: 'art. 19, 23 lid 1, 28 Cbb' }).first();
	await expect(label).toHaveAttribute('href', /focus=articles\/bwbr0052875_19$/);
	// The glance names every article it holds, on hover.
	await label.hover({ force: true });
	const tip = page.getByRole('tooltip');
	await expect(tip).toContainText('art. 19 Cbb');
	await expect(tip).toContainText('art. 23 lid 1 Cbb');
	await expect(tip).toContainText('art. 28 Cbb');
	// A link of its own, with a ring on the keyboard's focus.
	await label.focus();
	await page.keyboard.press('Shift+Tab');
	await page.keyboard.press('Tab');
	await expect(label).toBeFocused();
	await expect(label.locator('.frame')).toHaveCSS('outline-style', 'solid');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/wetten\/BWBR0052875\/artikel\/19$/);
});

test('Cbw: a label that names one lid opens its article at that lid, marked', async ({ page }) => {
	await page.goto('/wetten/BWBR0052872?mode=netwerk&weergave=keten');
	await expect(page.locator('.chain .name').first()).toBeVisible();
	const lid = page.locator('.chain a.cite[href*="#lid-"]').first();
	await expect(lid).toBeAttached();
	await lid.focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/artikel\/[^/]+#lid-\d+$/);
	await expect(page.locator('.is-landed')).toHaveCount(1);
});
