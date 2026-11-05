// The keten of a ministeriële regeling (B71, B109): the wetten it names stand in Noemt, under it,
// with a dashed line to it; the AMvB it is issued under keeps its own row above it.
import { expect, test } from '../support/test';

const IENW = '/explore?netwerk=instruments/bwbr0052878&weergave=keten';
const WETTEN = [
	'Cyberbeveiligingswet',
	'Drinkwaterwet',
	'Omgevingswet',
	'Wegenverkeerswet 1994',
	'Wet milieubeheer',
	'Wet weerbaarheid kritieke entiteiten'
];
/** A name as the drawing breaks it over lines: without its spaces. */
const bare = (s: string) => s.replace(/\s+/g, '');

test('the wetten a regulation names stand in Noemt, its AMvB in the row AMvB', async ({
	page,
	isMobile
}) => {
	await page.goto(IENW);
	if (isMobile) {
		const layer = (name: string) => page.locator(`.chain .list__layer[aria-label="${name}"]`);
		// A phone's list shows the first four of a layer, the rest under "N andere".
		for (const wet of WETTEN.slice(0, 4)) await expect(layer('Noemt')).toContainText(wet);
		await expect(layer('AMvB')).toHaveText(/Cyberbeveiligingsbesluit/);
		for (const wet of WETTEN) await expect(layer('AMvB')).not.toContainText(wet);
		return;
	}
	const svg = page.locator('svg.drawing');
	await expect(svg.locator('.name', { hasText: 'Cyberbeveiligingsbesluit' })).toBeVisible();
	// The rows of the drawing, top to bottom, each with the names under its label.
	const rows = await svg.evaluate((s) => {
		const heads = [...s.querySelectorAll<SVGTextElement>('.layer-label')].map((t) => ({
			label: t.textContent!.trim(),
			y: t.getBBox().y
		}));
		return heads.map((h, i) => ({
			label: h.label,
			names: [...s.querySelectorAll<SVGTextElement>('.name')]
				.filter((n) => {
					const y = n.getBBox().y;
					return y > h.y && (i === heads.length - 1 || y < heads[i + 1].y);
				})
				.map((n) => n.textContent!.replace(/\s+/g, ''))
		}));
	});
	expect(rows.map((r) => r.label)).toEqual(['AMVB', 'MINISTERIËLE REGELING', 'NOEMT']);
	expect(rows[0].names).toEqual([bare('Cyberbeveiligingsbesluit')]);
	expect(rows[2].names.sort()).toEqual(WETTEN.map(bare).sort());
	// Each wet a dashed line down to the regulation; the Cbb its grondslag, drawn whole.
	expect(await svg.locator('path.line[stroke-dasharray]').count()).toBe(WETTEN.length);
	expect(await svg.locator('path.line:not([stroke-dasharray])').count()).toBe(1);
});
