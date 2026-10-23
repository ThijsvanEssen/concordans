// An article's address painted before the app (besluit 31, src/lib/first-paint): its title
// and text stand where the app's reader sets them, and the app takes them over without a
// line moving, nothing shifting under the reader (CLS 0).
import { articlePaint, serveFirstPaint, positions } from '../support/first-paint';
import { expect, test } from '../support/test';

// An article of leden (Boek 6 BW) and one of an act of the EU, with onderdelen `a)`.
const ARTICLES = [
	{
		path: '/wetten/BWBR0005289/artikel/6:162',
		law: 'BWBR0005289',
		number: '162',
		title: 'Artikel 6:162 BW',
		words: 'Hij die jegens een ander een onrechtmatige daad'
	},
	{
		path: '/wetten/32016R0679/artikel/6',
		law: '32016R0679',
		number: '6',
		title: 'Artikel 6 AVG. Rechtmatigheid van de verwerking',
		words: 'De verwerking is alleen rechtmatig'
	}
];

for (const a of ARTICLES) {
	const key = `${a.law.toLowerCase()}_${a.number}`;
	test.describe(a.title, () => {
		test.beforeEach(async ({ page }) => {
			await serveFirstPaint(page, a.path, `articles/${key}`, articlePaint(a.law, a.number, key));
		});
		test('the article stands before the app has come', async ({ page, guard }) => {
			// The app's scripts held back: what shows is the paint alone.
			guard.allow(/net::ERR_FAILED|Failed to fetch dynamically imported module|Failed to load/);
			await page.route(/\/_app\/.*\.js$/, (route) => route.abort());
			await page.goto(a.path);
			const paint = page.locator('#first-paint');
			await expect(paint).toHaveClass(/ev--ready/);
			await expect(paint.getByRole('heading', { level: 1 })).toHaveText(a.title);
			await expect(paint.getByText(a.words)).toBeVisible();
			// What the app adds when it has come takes its room, unseen.
			await expect(paint.getByText('Geldend recht')).toBeHidden();
		});

		test('the app takes the article over where it stands', async ({ page }) => {
			await page.addInitScript((measure: string) => {
				const at = new Function(`return ${measure}`)() as (paint: boolean) => number[][] | null;
				const w = window as unknown as Record<string, unknown>;
				// The shifts the reader sees in its text: of the paint while it stands, of the app's
				// column once the paint has gone. What the app does under the paint is not seen, and
				// Verbonden and the network move on their own while their rows come in.
				const shifts: { t: number; v: number; paint: boolean; reader: boolean }[] = [];
				w.__shifts = shifts;
				new PerformanceObserver((list) => {
					for (const e of list.getEntries() as (PerformanceEntry & {
						value: number;
						sources: { node: Node | null }[];
					})[]) {
						const inside = (selector: string) =>
							e.sources.some((s) => s.node instanceof Element && !!s.node.closest(selector));
						shifts.push({
							t: e.startTime,
							v: e.value,
							paint: inside('#first-paint'),
							reader: inside('.col--reader')
						});
					}
				}).observe({ type: 'layout-shift', buffered: true });
				new MutationObserver(() => {
					const ev = document.getElementById('first-paint');
					if (ev?.classList.contains('ev--ready')) w.__paint = at(true);
					else if (!ev && w.__paint && !w.__app) {
						w.__app = at(false);
						// A shift of the frame the paint goes in is not seen: the paint stood where the
						// app now stands. From the next frame on, the app's text is what the reader sees.
						requestAnimationFrame(() => (w.__gone = performance.now()));
					}
				}).observe(document, { subtree: true, childList: true, attributes: true });
			}, positions.toString());
			await page.goto(a.path);
			await expect(page.locator('#first-paint')).toHaveCount(0);
			// It went because the app's text stood where its own did, not at a time out.
			await expect(page.locator('html')).toHaveAttribute('data-takeover', 'text');
			await expect(page.getByRole('heading', { level: 1 })).toHaveText(a.title);
			await page.waitForTimeout(1000);
			const { painted, app, cls } = await page.evaluate(() => {
				const w = window as unknown as Record<string, unknown>;
				const gone = w.__gone as number;
				const shifts = w.__shifts as { t: number; v: number; paint: boolean; reader: boolean }[];
				return {
					painted: w.__paint,
					app: w.__app,
					cls: shifts
						.filter((s) => s.paint || (s.reader && s.t > gone))
						.reduce((sum, s) => sum + s.v, 0)
				};
			});
			expect(painted).toBeTruthy();
			expect(app).toEqual(painted);
			expect(cls).toBe(0);
		});
	});
}
