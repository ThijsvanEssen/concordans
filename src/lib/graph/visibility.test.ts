// Guard per filter of Tonen and Relatie (B51): what one filter hides leaves no trace in the scene,
// on every example canvas, in no layer (a line, a hull, a tile, a group, the kinds the legend reads).
import { describe, expect, it } from 'vitest';
import { EXAMPLES, example } from '$lib/test/lanes';
import { SORTS, STUKSOORTEN, sortOf, stuksoortOf } from '$lib/bron/rubrieken';
import type { HiddenKind } from '$lib/verbonden/filter';
import { LINE_KINDS } from './line-kind';
import { buildScene, type Scene } from './scene';
import type { GraphEdge, GraphNode } from './types';
import { SHOW_ALL, visibleGraph, type Visibility } from './visibility';

const build = (name: (typeof EXAMPLES)[number], v: Partial<Visibility>) =>
	buildScene({ ...example(name), visibility: { ...SHOW_ALL, ...v } });
const idsOf = (s: Scene) => new Set(s.units.flatMap((u) => [u.id, ...u.members]));
const off = (...kinds: HiddenKind[]) => new Set<HiddenKind>(kinds);

describe.each(EXAMPLES)('Relatie on %s', (name) => {
	it('all lijnsoorten off: no line', () => {
		const s = build(name, { hiddenLines: new Set(LINE_KINDS) });
		expect(s.lines).toEqual([]);
	});

	it.each(LINE_KINDS)('%s off: no line of it', (kind) => {
		const s = build(name, { hiddenLines: new Set([kind]) });
		expect(s.lines.filter((l) => l.kind === kind)).toEqual([]);
	});
});

describe.each(EXAMPLES)('Tonen on %s', (name) => {
	const nodes = example(name).nodes;
	const soortOf = (n: GraphNode) => sortOf(n.collection, n.key, n.raw?.props);

	it.each(SORTS)('%s off: no bron of that soort stays, no hull of it', (sort) => {
		const s = build(name, { hiddenKinds: off(sort) });
		const ids = idsOf(s);
		expect(nodes.filter((n) => soortOf(n) === sort && ids.has(n.id))).toEqual([]);
		// A person is placed by their role in Wie maakt, which may differ from their soort.
		expect(s.units.filter((u) => u.sort === sort && u.column !== 'makers')).toEqual([]);
	});

	it.each(STUKSOORTEN)('stuksoort %s off: no stuk of it', (soort) => {
		const ids = idsOf(build(name, { hiddenKinds: off(`stuksoort:${soort}`) }));
		const stukken = nodes.filter(
			(n) => n.collection === 'documents' && stuksoortOf(n.raw?.props) === soort
		);
		expect(stukken.filter((n) => ids.has(n.id))).toEqual([]);
	});
});

describe('Wetten and Uitspraken (B51)', () => {
	const wet = {
		id: 'instruments/bwbr1',
		key: 'bwbr1',
		collection: 'instruments',
		drawClass: 'instrument',
		label: 'Wet'
	};
	const hof = (key: string, source: string) => ({
		id: `judgments/${key}`,
		key,
		collection: 'judgments',
		drawClass: 'judgment',
		label: key,
		raw: { props: { source } }
	});
	const nodes = [
		wet,
		hof('ecli_eu_c_2014_238', 'cjeu'),
		hof('ecli_ce_echr_2019_0101', 'echr')
	] as unknown as GraphNode[];
	const edges = nodes
		.slice(1)
		.map(
			(n) => ({ id: `${n.id}-w`, source: n.id, target: wet.id, relation: 'REFERS_TO' }) as GraphEdge
		);

	it('a judgment of the Hof van Justitie or the EHRM stays with Wetten off', () => {
		const v = visibleGraph(nodes, edges, { ...SHOW_ALL, hiddenKinds: off('wetten') });
		expect(v.nodes.map((n) => n.id)).toEqual([
			'judgments/ecli_eu_c_2014_238',
			'judgments/ecli_ce_echr_2019_0101'
		]);
	});

	it('and goes with Uitspraken off, with its lines', () => {
		const v = visibleGraph(nodes, edges, { ...SHOW_ALL, hiddenKinds: off('uitspraken') });
		expect(v.nodes.map((n) => n.id)).toEqual([wet.id]);
		expect(v.edges).toEqual([]);
	});
});
