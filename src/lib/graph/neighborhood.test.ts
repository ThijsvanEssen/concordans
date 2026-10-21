import { describe, expect, it } from 'vitest';
import { withoutDetours } from './neighborhood';

const n = (id: string) => ({ id, collection: id.split('/')[0] });
const e = (source: string, target: string, relation: string) => ({ source, target, relation });

describe('withoutDetours through a law (art. 126ffa Sv)', () => {
	const focal = 'articles/126ffa';
	const nodes = [
		n(focal),
		n('instruments/sv'),
		n('judgments/rbdha'),
		n('articles/126uba'),
		n('articles/126x'), // only a sibling, through the law
		n('articles/126y') // a sibling the sibling refers to
	];
	const edges = [
		e(focal, 'instruments/sv', 'PART_OF'),
		e('articles/126uba', 'instruments/sv', 'PART_OF'),
		e('articles/126x', 'instruments/sv', 'PART_OF'),
		e('articles/126y', 'instruments/sv', 'PART_OF'),
		e('judgments/rbdha', focal, 'REFERS_TO'),
		e(focal, 'articles/126uba', 'REFERS_TO'),
		e('articles/126x', 'articles/126y', 'REFERS_TO')
	];

	it('keeps what the article reaches along its own verbindingen, and its law', () => {
		const { nodes: kept, edges: kept_e } = withoutDetours(nodes, edges, focal, 2);
		expect(kept.map((x) => x.id).sort()).toEqual(
			[focal, 'articles/126uba', 'instruments/sv', 'judgments/rbdha'].sort()
		);
		expect(kept_e.some((x) => x.source === 'articles/126x')).toBe(false);
	});

	it('keeps the articles of a law that is itself the focus', () => {
		const { nodes: kept } = withoutDetours(nodes, edges, 'instruments/sv', 1);
		expect(kept.map((x) => x.id)).toContain('articles/126x');
	});
});

describe('withoutDetours (Omgevingswet)', () => {
	const ow = 'instruments/ow';
	const nodes = [n(ow), n('articles/ow_2_6'), n('articles/wm_1_2'), n('articles/wm_2_42')];
	const edges = [
		e('articles/ow_2_6', ow, 'PART_OF'),
		e('articles/wm_1_2', 'articles/ow_2_6', 'TRANSPOSED_TO'),
		e('articles/wm_2_42', ow, 'TRANSPOSED_TO')
	];

	it('leaves out what became of an old article: no step to the new law', () => {
		const { nodes: kept, edges: kept_e } = withoutDetours(nodes, edges, ow, 2);
		expect(kept.map((x) => x.id).sort()).toEqual([ow, 'articles/ow_2_6', 'articles/wm_1_2'].sort());
		expect(kept_e.some((x) => x.source === 'articles/wm_2_42')).toBe(false);
	});
});

describe('withoutDetours through a person (motie 36799 nr. 31)', () => {
	const focal = 'documents/motie';
	const lid = 'members/de-beer';
	const nodes = [
		n(focal),
		n('dossiers/36799'),
		n(lid),
		n('factions/vvd'),
		n('committees/szw'),
		n('decisions/over-de-motie'),
		n('decisions/asiel-2025'), // a vote the indiener cast, on another matter
		n('documents/andere-motie') // another motie the indiener signed
	];
	const edges = [
		e(focal, 'dossiers/36799', 'PART_OF'),
		e(lid, focal, 'AUTHORED'),
		e(lid, 'factions/vvd', 'MEMBER_OF'),
		e(lid, 'committees/szw', 'MEMBER_OF'),
		e('decisions/over-de-motie', 'dossiers/36799', 'ABOUT'),
		e(lid, 'decisions/asiel-2025', 'VOTED'),
		e(lid, 'documents/andere-motie', 'AUTHORED'),
		e('factions/vvd', 'decisions/over-de-motie', 'VOTED')
	];

	it('draws the indiener and the fractie, not what else the lid signed or voted on', () => {
		const { nodes: kept, edges: kept_e } = withoutDetours(nodes, edges, focal, 3);
		expect(kept.map((x) => x.id).sort()).toEqual(
			[focal, 'dossiers/36799', lid, 'factions/vvd', 'decisions/over-de-motie'].sort()
		);
		// An edge between two bronnen that stay is kept: the fractie's vote on the motie.
		expect(kept_e.some((x) => x.source === 'factions/vvd' && x.relation === 'VOTED')).toBe(true);
	});

	it('reaches all a lid touches when the lid is the focus', () => {
		const { nodes: kept } = withoutDetours(nodes, edges, lid, 1);
		expect(kept.map((x) => x.id)).toEqual(
			expect.arrayContaining(['decisions/asiel-2025', 'documents/andere-motie', 'committees/szw'])
		);
	});
});
