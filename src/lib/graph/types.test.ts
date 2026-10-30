import { describe, expect, it } from 'vitest';
import { NODE_TYPES, RELATION_NAMES, type Collection } from '$lib/vocabulary';
import {
	EDGE_WEIGHT,
	buildNodeLabel,
	kort,
	edgeCategory,
	drawClassOf,
	instrumentLawId,
	nodeToGraphNode,
	relationOf,
	type BaseNode
} from './types';

const node = (collection: Collection, key: string, props: BaseNode['props'] = {}): BaseNode => ({
	id: `${collection}/${key}`,
	key,
	path: null,
	collection,
	type: 'x',
	display_name: null,
	labels: [],
	props
});

describe('relations', () => {
	it('gives every relation a weight', () => {
		expect(Object.keys(EDGE_WEIGHT).sort()).toEqual([...RELATION_NAMES].sort());
	});

	it('reads REFERS_TO by the kind of its source', () => {
		expect(edgeCategory('REFERS_TO', 'article')).toBe('structural');
		expect(edgeCategory('REFERS_TO', 'judgment')).toBe('semantic');
		expect(edgeCategory('REFERS_TO', 'document')).toBe('semantic');
	});

	it('counts proposed and enacted changes as mutations', () => {
		for (const relation of ['AMENDS', 'INTRODUCES', 'REPEALS'] as const) {
			expect(edgeCategory(relation, 'document')).toBe('mutation');
		}
	});

	it('refuses a relation of the old API', () => {
		expect(relationOf('REFERS_TO_ARTICLE')).toBeNull();
		expect(relationOf('PART_OF')).toBe('PART_OF');
	});
});

describe('node kinds', () => {
	it('gives every collection a kind', () => {
		for (const collection of Object.keys(NODE_TYPES) as Collection[]) {
			expect(drawClassOf(collection)).toBeTruthy();
		}
	});

	it('drops a node of an unknown collection', () => {
		expect(nodeToGraphNode(node('commissies' as Collection, 'x'))).toBeNull();
		expect(nodeToGraphNode(node('committees', 'x'))?.drawClass).toBe('committee');
	});
});

describe('node labels', () => {
	it('names a dossier by the short title its props carry, not by its title', () => {
		const title = 'Wijziging van de Wet X (Wet verbetering aanpak Y)';
		const label = (short_title: string | null) =>
			buildNodeLabel(node('dossiers', '36600', { number: '36600', title, short_title }), 'dossier');
		expect(label('Wet verbetering aanpak Y')).toBe('36600, Wet verbetering aanpak Y');
		expect(label(null)).toBe(`36600, ${title}`);
	});

	it('labels an article and a judgment', () => {
		expect(buildNodeLabel(node('articles', 'a', { article_number: '287' }), 'article')).toBe(
			'Art. 287'
		);
		const cite = {
			short: 'HR 3\u00a0maart\u00a02023',
			full: 'HR 3\u00a0maart\u00a02023, ECLI:NL:HR:2023:456'
		};
		expect(
			buildNodeLabel(
				{ ...node('judgments', 'j', { ecli: 'ECLI:NL:HR:2023:456' }), cite },
				'judgment'
			)
		).toBe('HR 3\u00a0maart\u00a02023');
	});

	it('names a motion after its lead signatory', () => {
		const label = buildNodeLabel(
			node('documents', 'd', {
				kind: 'Motie',
				date: '2026-01-02',
				actors: [
					{ name: 'A. Jansen', faction: 'VVD', role: 'Medeindiener' },
					{ name: 'B. de Vries', faction: 'D66', role: 'Eerste indiener' }
				]
			}),
			'document'
		);
		expect(label).toBe('Motie de Vries (D66), jan.\u00a02026');
	});

	it('takes the eerste ondertekenaar of a motie, wherever the source lists it', () => {
		const label = buildNodeLabel(
			node('documents', 'd', {
				kind: 'Motie (gewijzigd/nader)',
				number: '45',
				actors: [
					{ name: 'M. Schenk', faction: 'FVD', role: 'Mede ondertekenaar' },
					{ name: 'A.J. Flach', faction: 'SGP', role: 'Mede ondertekenaar' },
					{ name: 'D.G.M. Ceder', faction: 'ChristenUnie', role: 'Eerste ondertekenaar' }
				]
			}),
			'document'
		);
		expect(label).toBe('Motie Ceder (ChristenUnie), nr. 45');
	});

	it('names a Kamerstuk by its kind and number, an EK paper by its letter', () => {
		const doc = (props: Record<string, unknown>) =>
			buildNodeLabel(node('documents', 'd', props), 'document');
		expect(
			doc({
				kind: 'Voorstel van wet',
				number: '2',
				title: 'Wijziging van het Wetboek van Strafrecht'
			})
		).toBe('Voorstel van wet, nr. 2');
		expect(doc({ kind: 'Memorie van antwoord', number: 'C', title: 'Memorie van antwoord' })).toBe(
			'Memorie van antwoord, C'
		);
		expect(
			doc({
				kind: 'Amendement',
				number: '20',
				actors: [{ name: 'H.M. Verkuijlen', faction: 'VVD', role: 'Eerste indiener' }]
			})
		).toBe('Amendement Verkuijlen (VVD), nr. 20');
		expect(
			doc({
				kind: 'Brief regering',
				number: '41',
				title: 'Stand van zaken van de aanpak van mensenhandel in Caribisch Nederland'
			})
		).toBe('Stand van zaken van de aanpak van…, nr. 41');
		expect(doc({ kind: 'Brief', sequence: 12, title: 'Brief' })).toBe('Brief, nr. 12');
	});

	it('cuts a long name at a word', () => {
		expect(kort('Wet modernisering en uitbreiding strafbaarstelling mensenhandel')).toBe(
			'Wet modernisering en uitbreiding…'
		);
		expect(kort('Art. 3:4 Awb')).toBe('Art. 3:4 Awb');
	});

	it('labels a member with the party', () => {
		expect(
			buildNodeLabel(node('members', 'm', { name: 'Jan Jansen', party: 'VVD' }), 'member')
		).toBe('Jan Jansen (VVD)');
	});
});

describe('the law of an instrument', () => {
	it('is its BWB id, CELEX number or the publication that enacted it', () => {
		expect(instrumentLawId({ bwb_id: 'BWBR0005537' }, 'bwbr0005537')).toBe('BWBR0005537');
		expect(instrumentLawId({ official_id: 'stb-2026-56' }, 'wet_stb_2026_56')).toBe('STB-2026-56');
	});

	it('is read from the key of a law of the Staatsblad, never the key in capitals', () => {
		expect(instrumentLawId({}, 'wet_stb_2026_56')).toBe('STB-2026-56');
		expect(instrumentLawId(undefined, 'bwbr0001840')).toBe('BWBR0001840');
	});
});
