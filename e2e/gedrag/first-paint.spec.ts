// A reader's address painted before the app (besluit 31, src/lib/first-paint): its title and
// text stand where the app's reader sets them, and the app takes them over without a line
// moving, nothing shifting under the reader (CLS 0).
import {
	articlePaint,
	judgmentPaint,
	lawPaint,
	paperPaint,
	serveFirstPaint,
	positions
} from '../support/first-paint';
import { expect, test, TODAY } from '../support/test';

// An article of leden (Boek 6 BW), one of an act of the EU with onderdelen `a)`, an arrest with
// its summary, parties, procesgang and numbered overwegingen, a law with its divisions, and a
// motie with its indiener.
const READERS = [
	{
		path: '/wetten/BWBR0005289/artikel/6:162',
		focus: 'articles/bwbr0005289_162',
		paint: () => articlePaint('BWBR0005289', '162', 'bwbr0005289_162'),
		title: 'Artikel 6:162 BW',
		words: 'Hij die jegens een ander een onrechtmatige daad',
		later: 'Geldend recht'
	},
	{
		path: '/wetten/32016R0679/artikel/6',
		focus: 'articles/32016r0679_6',
		paint: () => articlePaint('32016R0679', '6', '32016r0679_6'),
		title: 'Artikel 6 AVG. Rechtmatigheid van de verwerking',
		words: 'De verwerking is alleen rechtmatig',
		later: 'Geldend recht'
	},
	{
		path: '/uitspraken/ECLI:NL:HR:2019:2006',
		focus: 'judgments/ecli_nl_hr_2019_2006',
		paint: () => judgmentPaint('ECLI:NL:HR:2019:2006', 'ecli_nl_hr_2019_2006'),
		title: 'HR 20 december 2019, ECLI:NL:HR:2019:2006 (Urgenda)',
		words: 'Klimaatzaak Urgenda',
		later: 'Arrest, 20 december 2019'
	},
	{
		path: '/wetten/BWBR0005289',
		focus: 'instruments/bwbr0005289',
		paint: () =>
			lawPaint(
				'BWBR0005289',
				'bwbr0005289',
				TODAY.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
			),
		title: 'Burgerlijk Wetboek Boek 6',
		words: 'Verbintenissen in het algemeen',
		later: 'artikelen.'
	},
	{
		path: '/kamerstukken/37020-XVI/60',
		focus: 'documents/fced0aee_2383_4aac_a95d_b616b1dc7d0a',
		paint: () => paperPaint('fced0aee_2383_4aac_a95d_b616b1dc7d0a'),
		title:
			'Motie van het lid Diederik van Dijk over afkeuring uitspreken over het beleid van de regering inzake de pilot die abortussen vanaf 22 weken zwangerschap bij gezonde kindjes toegankelijker maakt',
		words: 'Ingediend door',
		later: 'Kamerstukken II'
	}
];

for (const a of READERS) {
	test.describe(a.title, () => {
		test.beforeEach(async ({ page }) => {
			await serveFirstPaint(page, a.path, a.focus, a.paint());
		});
		test('the bron stands before the app has come', async ({ page, guard }) => {
			// The app's scripts held back: what shows is the paint alone.
			guard.allow(/net::ERR_FAILED|Failed to fetch dynamically imported module|Failed to load/);
			await page.route(/\/_app\/.*\.js$/, (route) => route.abort());
			await page.goto(a.path);
			const paint = page.locator('#first-paint');
			await expect(paint).toHaveClass(/ev--ready/);
			await expect(paint.getByRole('heading', { level: 1 })).toHaveText(a.title);
			await expect(paint.getByText(a.words).first()).toBeVisible();
			// What the app adds when it has come takes its room, unseen.
			await expect(paint.getByText(a.later)).toBeHidden();
		});

		test('the app takes the bron over where it stands', async ({ page }) => {
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
			// The paint sets a judgment's first part; the app the whole of it.
			expect((app as number[][]).slice(0, (painted as number[][]).length)).toEqual(painted);
			expect(cls).toBe(0);
		});
	});
}
