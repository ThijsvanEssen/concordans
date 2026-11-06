// The role of a person in Wie maakt and in Tonen: that on the day of their first stuk on the canvas,
// and who signed the advies of the Raad van State is never a bewindspersoon (B122, Thijs 5 nov.).
import { describe, expect, it } from 'vitest';
import { sortOf } from '$lib/bron/rubrieken';
import { kindOfBron } from '$lib/verbonden/summary';
import { makerSorts } from './roles';
import { buildScene } from './scene';
import { SHOW_ALL } from './visibility';
import type { GraphEdge, GraphNode } from './types';

const post = (from: string, to: string) => ({ from_date: from, to_date: to, post: 'minister' });
const seat = (from: string, to: string) => ({ from_date: from, to_date: to, faction_key: 'd66' });

// Minister 2003-2005, Kamerlid before; vice-president of the Raad van State since 2018, which
// the data does not hold as a function.
const graaf = {
	id: 'members/graaf',
	key: 'graaf',
	collection: 'members',
	drawClass: 'member',
	label: 'Thom de Graaf',
	raw: {
		props: {
			government_functions: [post('2003-05-27', '2005-03-23')],
			faction_memberships: [seat('1994-05-17', '2003-05-26')]
		}
	}
} as unknown as GraphNode;

const stuk = (key: string, date: string, kind: string) =>
	({
		id: `documents/${key}`,
		key,
		collection: 'documents',
		drawClass: 'document',
		label: kind,
		raw: { props: { date, kind, dossier_number: '36496' } }
	}) as unknown as GraphNode;

const signed = (to: GraphNode): GraphEdge =>
	({ id: `graaf-${to.key}`, source: graaf.id, target: to.id, relation: 'AUTHORED' }) as GraphEdge;

const advies = stuk('advies', '2023-11-15', 'Advies Afdeling advisering Raad van State');
const naderRapport = stuk(
	'nr4',
	'2024-02-05',
	'Advies Afdeling advisering Raad van State en Nader rapport'
);
const brief2004 = stuk('brief', '2004-06-01', 'Brief regering');

const sortOn = (nodes: GraphNode[], edges: GraphEdge[]) => makerSorts(nodes, edges).get(graaf.id);

describe('the soort of a person on the canvas (B122)', () => {
	it('by their posts alone a former minister is a bewindspersoon (the rule without a stuk)', () => {
		expect(sortOf('members', graaf.key, graaf.raw?.props)).toBe('bewindspersonen');
		expect(sortOn([graaf], [])).toBe('bewindspersonen');
	});

	it('who signed the advies of the Raad van State is no bewindspersoon', () => {
		expect(sortOn([graaf, advies], [signed(advies)])).toBe('kamerleden');
	});

	it('a post that ended before the stuk makes no bewindspersoon (advies en nader rapport)', () => {
		expect(sortOn([graaf, naderRapport], [signed(naderRapport)])).toBe('kamerleden');
	});

	it('a post on the day of the stuk does', () => {
		expect(sortOn([graaf, brief2004], [signed(brief2004)])).toBe('bewindspersonen');
	});

	it('Bewindspersonen off in Tonen leaves the vice-president of the Raad van State standing', () => {
		const s = buildScene({
			nodes: [graaf, naderRapport, advies],
			edges: [signed(naderRapport), signed(advies)],
			chosen: [naderRapport.id],
			visibility: { ...SHOW_ALL, hiddenKinds: new Set(['bewindspersonen']) }
		});
		const unit = s.units.find((u) => u.members.includes(graaf.id));
		expect(unit).toMatchObject({ lane: 'council', sort: 'kamerleden' });
	});

	it('Tonen names him one step further by that soort too (kind-rows)', () => {
		expect(kindOfBron('members', graaf.key, graaf.raw?.props ?? undefined, 'kamerleden')).toBe(
			'members'
		);
		expect(kindOfBron('members', graaf.key, graaf.raw?.props ?? undefined)).toBe('ministers');
	});
});
