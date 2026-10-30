// The keten of a ministeriële regeling (B71): the wetten it names stand in the row Wet, above
// the AMvB it is issued under, with a dashed line to it; the AMvB keeps its own row.
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

test('the wetten a regulation names stand in the row Wet, its AMvB in the row AMvB', async ({
	page,
	isMobile
}) => {
	await page.goto(IENW);
	if (isMobile) {
		const layer = (name: string) => page.locator(`.chain .list__layer[aria-label="${name}"]`);
		for (const wet of WETTEN) await expect(layer('Wet')).toContainText(wet);
		await expect(layer('AMvB')).toHaveText(/Cyberbeveiligingsbesluit/);
		await expect(layer('AMvB')).not.toContainText('Omgevingswet');
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
	expect(rows.map((r) => r.label)).toEqual(['WET', 'AMVB', 'MINISTERIËLE REGELING']);
	expect(rows[0].names.sort()).toEqual(WETTEN.map(bare).sort());
	expect(rows[1].names).toEqual([bare('Cyberbeveiligingsbesluit')]);
	// Each wet a dashed line down to the regulation; the Cbb its grondslag, drawn whole.
	expect(await svg.locator('path.line[stroke-dasharray]').count()).toBe(WETTEN.length);
	expect(await svg.locator('path.line:not([stroke-dasharray])').count()).toBe(1);
});
