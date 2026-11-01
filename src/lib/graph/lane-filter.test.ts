import { describe, expect, it } from 'vitest';
import { stripDate } from '$lib/bron/strook';
import { example } from '$lib/test/lanes';
import type { Collection } from '$lib/vocabulary';
import { laneFiltered } from './lane-filter';
import { buildScene } from './scene';

const g = example('v1');
const dayOf = (id: string) => {
	const n = g.nodes.find((x) => x.id === id)!;
	return stripDate(n.raw?.props, n.collection as Collection, n.id)?.slice(0, 10) ?? null;
};
const period = { from: '2024-01-01', to: '2024-12-31' };

describe('laneFiltered', () => {
	it('draws everything without a bronfilter', () => {
		expect(laneFiltered(g.nodes, { period: null, court: null }, [])).toBe(g.nodes);
	});

	it('leaves out the stukken and uitspraken outside the period, the rest stays', () => {
		const kept = laneFiltered(g.nodes, { period, court: null }, []);
		const gone = g.nodes.filter((n) => !kept.includes(n));
		expect(gone.length).toBeGreaterThan(0);
		for (const n of gone) {
			expect(['documents', 'judgments']).toContain(n.collection);
			const day = dayOf(n.id)!;
			expect(day < period.from || day > period.to, `${n.id} ${day}`).toBe(true);
		}
		for (const n of kept.filter((x) => x.collection === 'documents' && dayOf(x.id)))
			expect(dayOf(n.id)! >= period.from && dayOf(n.id)! <= period.to, n.id).toBe(true);
	});

	it('keeps a chosen bron outside the period', () => {
		const old = g.nodes.find((n) => n.collection === 'documents' && (dayOf(n.id) ?? '9') < '2024')!;
		const kept = laneFiltered(g.nodes, { period, court: null }, [old.id]);
		expect(kept).toContain(old);
	});

	it('leaves out the judgments of another court', () => {
		const kept = laneFiltered(g.nodes, { period: null, court: 'hr' }, []);
		const judgments = kept.filter((n) => n.collection === 'judgments');
		expect(judgments.length).toBeLessThan(
			g.nodes.filter((n) => n.collection === 'judgments').length
		);
		for (const n of judgments) expect(n.id, n.id).toMatch(/_hr_|_phr_/);
	});

	it('gives a scene with fewer lines: those of what left go with it', () => {
		const all = buildScene(g);
		const some = buildScene({ ...g, filter: { period, court: null } });
		expect(some.lines.length).toBeLessThan(all.lines.length);
	});
});
