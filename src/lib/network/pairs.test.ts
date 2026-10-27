import { describe, expect, it } from 'vitest';
import { verbandModel } from './shared';
import {
	ALL,
	drawing,
	drawingLabel,
	isMenu,
	oneStepBlock,
	options,
	pairOf,
	resolveChoice,
	type PairEnd
} from './pairs';

const end = (id: string, name: string, short: string): PairEnd => ({
	id,
	name,
	short,
	collection: 'instruments'
});
const G = end('instruments/g', 'Gemeentewet', 'Gemw');
const B = end('instruments/b', 'Burgerlijk Wetboek Boek 6', 'Boek 6 BW');
const A = end('instruments/a', 'Algemene wet bestuursrecht', 'Awb');
const ENDS = [A, B, G];

const link = (source: string, id: string) => ({
	source,
	edge_id: `${source}-${id}`,
	relation: 'REFERS_TO',
	direction: 'inbound',
	status: null,
	confidence: null
});
const stuk = (n: number, at: string[]) => ({
	id: `documents/${n}`,
	key: String(n),
	collection: 'documents',
	type: 'document',
	display_name: `Kamerstuk ${n}`,
	labels: [],
	props: { dossier_number: String(n), sequence: 3, kind: 'Memorie van toelichting' },
	links: at.map((s) => link(s, `documents/${n}`))
});
const answer = (ids: string[], items: ReturnType<typeof stuk>[], total = items.length) =>
	({
		ids,
		total,
		buckets: [{ collection: 'documents', type: 'document', total, next_offset: null, items }],
		facets: { collection: [], tier: [], subject_area: [] }
	}) as never;
const names = (id: string) => ({ name: id, collection: 'instruments' as const });

// One stuk names all three; Awb and Gemw share 670 in all, 2 of them drawn.
const model = verbandModel(
	[
		answer([A.id, B.id], [stuk(1, [A.id, B.id]), stuk(2, [A.id, B.id])]),
		answer([A.id, G.id], [stuk(1, [A.id, G.id]), stuk(3, [A.id, G.id])], 670),
		answer([B.id, G.id], [stuk(1, [B.id, G.id]), stuk(4, [B.id, G.id])])
	],
	[],
	names
);
const keep = () => true;
const base = { ends: ENDS, model, keep, narrowed: false };
const AG = `${A.id},${G.id}`;

describe('the Keuze of three to six bronnen', () => {
	it('holds Alle drie and each pair with what it shares in all', () => {
		expect(options(ENDS, model).map((o) => [o.label, o.count])).toEqual([
			['Alle drie', 1],
			['Awb en Boek 6 BW', 2],
			['Awb en Gemw', 670],
			['Boek 6 BW en Gemw', 2]
		]);
		expect(options([A, B], model)).toEqual([]);
	});
	it('is a list where the buttons do not fit', () => {
		const six = [A, B, G, end('x', 'X', 'X'), end('y', 'Y', 'Y')];
		expect(isMenu(options(six, model))).toBe(true);
		expect(isMenu(options(ENDS, model))).toBe(false);
	});
	it('starts at Alle when those rows exist, else at the first pair; the address wins', () => {
		expect(resolveChoice(null, ENDS, model)).toBe(ALL);
		expect(resolveChoice(`${G.id},${A.id}`, ENDS, model)).toBe(AG);
		expect(resolveChoice('nonsense', ENDS, model)).toBe(ALL);
		const none = verbandModel([answer([A.id, B.id], [stuk(2, [A.id, B.id])])], [], names);
		expect(resolveChoice(null, ENDS, none)).toBe(`${A.id},${B.id}`);
		expect(resolveChoice(null, [A, B], null)).toBe(`${A.id},${B.id}`);
	});
	it('names the pair of a choice, none for Alle', () => {
		expect(pairOf(ALL)).toBeNull();
		expect(pairOf(AG)).toEqual([A.id, G.id]);
	});
});

describe('one step as a row', () => {
	it('is a chain from one chosen bron to the other with what both name between', () => {
		const block = oneStepBlock({ ...base, choice: AG });
		expect(block.title).toBe('Eén stap');
		expect(block.rows.map((r) => r.id)).toEqual(['documents/1', 'documents/3']);
		const [row] = block.rows;
		expect(row.bronnen.map((b) => b.id)).toEqual([A.id, G.id]);
		expect(row.steps[0].via?.name).toBe('1, nr. 3 Memorie van toelichting');
		expect(row.steps[0].text).toMatch(/beide/);
		// The API's total of the pair is the count: 2 of 670.
		expect(block.count).toBe('2 van 670 ketens');
	});
	it('at Alle drie draws the third as a second end with its own line', () => {
		const block = oneStepBlock({ ...base, choice: ALL });
		expect(block.rows.map((r) => r.id)).toEqual(['documents/1']);
		expect(block.rows[0].also?.map((e) => e.bron.id)).toEqual([G.id]);
		expect(block.rows[0].steps[0].text).toMatch(/alle drie/);
	});
	it('puts a direct step first, a line without a kenmerk', () => {
		const m = verbandModel(
			[answer([A.id, G.id], [stuk(3, [A.id, G.id])])],
			[{ from: A.id, to: G.id, relation: 'PART_OF' }],
			names
		);
		const block = oneStepBlock({ ...base, model: m, choice: AG });
		expect(block.rows[0].steps[0].via).toBeNull();
		expect(block.rows[1].steps[0].via).not.toBeNull();
	});
	it('names the drawing with the first rows in words, and says what is still coming', () => {
		const d = drawing({ ...base, choice: AG, steps: 1, chains: null });
		expect(drawingLabel(d)).toContain(
			'Ketens tussen Algemene wet bestuursrecht en Gemeentewet: één stap, 1, nr. 3 Memorie van toelichting'
		);
		expect(d.pending).toEqual([]);
		const wait = drawing({ ...base, choice: AG, steps: 3, chains: { status: 'loading' } });
		expect(wait.pending).toEqual([2, 3]);
	});
});
