import { describe, expect, it, vi } from 'vitest';

// A link to a bron reads the page it is on; the procedure is tested without one.
vi.mock('$lib/bron/href', () => ({ bronHref: (id: string) => `/${id}` }));
import { nrOf, procedure, uitslagVan } from './procedure';

describe('uitslagVan', () => {
	it('follows the source: passed, or the result of the Eerste Kamer', () => {
		expect(uitslagVan({ passed: true })).toBe(true);
		expect(uitslagVan({ passed: false })).toBe(false);
		expect(uitslagVan({ passed: null, result: 'Aangenomen' })).toBe(true);
		expect(uitslagVan({ passed: null, result: 'Verworpen' })).toBe(false);
	});

	it('gives no outcome for a postponed vote (36799, 22 september 2026)', () => {
		expect(uitslagVan({ passed: null, result: null })).toBeNull();
		expect(uitslagVan({})).toBeNull();
	});
});

describe('nrOf', () => {
	it('takes the letter of the Eerste Kamer and the number of the Tweede Kamer', () => {
		expect(nrOf({ title: 'Verslag', body: { chamber: 'EK', number: 'AB' } })).toBe('AB');
		expect(nrOf({ title: 'Kamerstuk 36799, nr. 31: Motie', body: {} })).toBe('31');
		expect(nrOf({ title: 'Motie', body: { sequence: 31 } })).toBe('31');
		expect(nrOf({ title: 'Nader rapport', body: {} })).toBeNull();
	});
});

describe('procedure: the Eerste Kamer as eerstekamer.nl shows it', () => {
	type Detail = Parameters<typeof procedure>[0];
	type Entry = Parameters<typeof procedure>[1][number];
	const paper = (kind: string, date: string, number: string | null, url = 'https://ek/x.pdf') => ({
		kind,
		date,
		number,
		url
	});
	const base = {
		number: '36799',
		kind: 'Wetgeving',
		closed: false,
		current_phase: 'Stemmingen',
		tk_decision: { date: '2026-09-29', kind: 'Aangenomen' },
		phases: []
	};
	const senate = (progress: unknown[]) => ({ document_count: 0, progress });
	const ekGroup = (d: unknown, entries: Entry[] = []) =>
		procedure(d as Detail, entries, false).groepen.find((g) => g.id === 'ek');

	it('lists its papers per step and says where the bill is', () => {
		const d = {
			...base,
			senate: senate([
				{
					phase: null,
					house: 'Tweede Kamer',
					state: 'vol',
					papers: [paper('voorstel van wet', '2025-09-02', 'TK, 2')]
				},
				{
					phase: 'Schriftelijke voorbereiding',
					house: 'Eerste Kamer',
					state: 'geblokt',
					papers: [paper('gewijzigd voorstel van wet', '2026-09-29', 'EK, A')]
				},
				{ phase: 'Plenair', house: null, state: 'leeg', papers: [] },
				{ phase: 'Afkondiging', house: 'Staatsblad(en)', state: 'leeg', papers: [] }
			])
		};
		const g = ekGroup(d)!;
		expect(g.regels.map((r) => [r.datum, r.zin, r.meta ?? null, r.href ?? null])).toEqual([
			['2026-09-29', 'Gewijzigd voorstel van wet', 'Kamerstuk I 36799, A', 'https://ek/x.pdf'],
			[
				null,
				'Nu: schriftelijke voorbereiding. Kan nog volgen: plenaire behandeling en afkondiging.',
				null,
				null
			]
		]);
	});

	it('names a paper or a vote the data already holds once', () => {
		const d = {
			...base,
			closed: false,
			ek_outcome: { outcome: 'Aangenomen', date: '2026-09-22', method: 'Hamerstuk' },
			senate: senate([
				{
					phase: 'Schriftelijke voorbereiding',
					state: 'vol',
					papers: [paper('blanco verslag', '2026-09-08', 'EK, A')]
				},
				{
					phase: 'Plenair',
					state: 'vol',
					papers: [paper('stemming (hamerstuk)', '2026-09-22', null)]
				},
				{ phase: 'Afkondiging', state: 'geblokt', papers: [] }
			])
		};
		const entries = [
			{
				node_id: 'documents/a',
				node_type: 'document',
				date: '2026-09-08',
				kind: 'Verslag',
				title: 'Blanco verslag',
				body: { chamber: 'EK', number: 'A' }
			}
		] as unknown as Entry[];
		const g = ekGroup(d, entries)!;
		expect(g.regels.map((r) => r.zin)).toEqual(['Verslag', 'Nu: afkondiging.']);
	});

	it('puts the papers of its page between the others by their day (36496: a verslag of 2025 stood before the papers of 2024)', () => {
		const d = {
			...base,
			number: '36496',
			closed: true,
			ek_outcome: { outcome: 'Aangenomen', date: '2024-06-25', method: 'Stemming bij zitten' },
			senate: senate([
				{
					phase: 'Schriftelijke voorbereiding',
					state: 'vol',
					papers: [
						paper('gewijzigd voorstel van wet', '2024-04-25', 'EK, D'),
						paper('verslag', '2024-05-31', 'EK, E'),
						paper('tweede verslag', '2024-06-14', 'EK, H')
					]
				},
				{
					phase: 'Plenair',
					state: 'vol',
					papers: [paper('behandeling', '2024-06-18', null)]
				}
			])
		};
		const entries = [
			{
				node_id: 'decisions/w',
				node_type: 'decision',
				date: '2024-06-25',
				kind: 'Wetgeving',
				title: 'Wet betaalbare huur',
				body: { chamber: 'EK', result: 'Aangenomen' }
			},
			{
				node_id: 'documents/x',
				node_type: 'document',
				date: '2025-12-12',
				kind: 'Verslag',
				title: 'Kamerstuk I 36496, X: Verslag van een schriftelijk overleg over de huurmarkt',
				body: { chamber: 'EK', number: 'X' }
			}
		] as unknown as Entry[];
		const datums = ekGroup(d, entries)!.regels.map((r) => r.datum);
		expect(datums).toEqual([
			'2024-04-25',
			'2024-05-31',
			'2024-06-14',
			'2024-06-18',
			'2024-06-25',
			'2025-12-12'
		]);
	});

	it('names the year once, in the heading, where all its lines fall in it', () => {
		const d = { ...base, senate: senate([]) };
		const entries = [
			{
				node_id: 'documents/v',
				node_type: 'document',
				date: '2026-09-08',
				kind: 'Verslag',
				title: 'Verslag',
				body: { chamber: 'EK', number: 'A' }
			}
		] as unknown as Entry[];
		const g = ekGroup(d, entries)!;
		expect(g.sub).toBe('2026');
		expect(g.jaar).toBe('2026');
	});

	it('keeps the general line without a page', () => {
		const g = ekGroup({ ...base, senate: senate([]) })!;
		expect(g.regels.map((r) => r.zin)).toEqual([
			'Kan nog volgen: verslag of plenaire behandeling, en stemming.'
		]);
	});
});

describe('procedure: a paper that is not one of the bill’s', () => {
	type Detail = Parameters<typeof procedure>[0];
	type Entry = Parameters<typeof procedure>[1][number];
	const d = {
		number: '36547',
		kind: 'Wetgeving',
		closed: false,
		current_phase: 'Verslag',
		phases: []
	} as unknown as Detail;
	const doc = (id: string, kind: string, title: string, sequence: number | null = null) =>
		({
			node_type: 'document',
			node_id: `documents/${id}`,
			date: '2024-04-25',
			kind,
			title,
			body: { chamber: 'TK', sequence }
		}) as unknown as Entry;
	const tk = (entries: Entry[]) =>
		procedure(d, entries, true)
			.groepen.find((g) => g.id === 'tk')!
			.regels.filter((r) => r.soort === 'documents');

	it('stands on a line of its own by its title, its kind above it, beside the bill’s papers of that day', () => {
		const regels = tk([
			doc(
				'vw',
				'Voorstel van wet',
				'Kamerstuk 36547, nr. 2. Voorstel van wet: Wijziging van het Wetboek van Strafrecht',
				2
			),
			doc('mvt', 'Memorie van toelichting', 'Wijziging van het Wetboek van Strafrecht', 3),
			doc(
				'brief',
				'Brief regering',
				'Kamerstuk 36547, nr. 4: Aanbieding van het onderzoek naar uitbuiting',
				4
			)
		]);
		expect(regels.map((r) => [r.label, r.zin, r.meta])).toEqual([
			[null, 'Voorstel van wet en memorie van toelichting', 'Kamerstuk 36547, nrs. 2–3'],
			['Brief regering', 'Aanbieding van het onderzoek naar uitbuiting', 'Kamerstuk 36547, nr. 4']
		]);
	});

	it('is named by its kind where its title only names the kind', () => {
		const [regel] = tk([doc('m', 'Motie', 'Motie', 12)]);
		expect([regel.label, regel.zin, regel.meta]).toEqual([
			null,
			'Motie',
			'Kamerstuk 36547, nr. 12'
		]);
	});
});

describe('procedure: a dossier without a bill', () => {
	type Detail = Parameters<typeof procedure>[0];
	// 27926 Huurbeleid: no kind from its zaak, no phases, no decision on a bill.
	const huurbeleid = {
		number: '27926',
		kind: null,
		closed: false,
		current_phase: null,
		tk_decision: null,
		ek_outcome: null,
		phases: null
	} as unknown as Detail;

	it('shows no steps of a bill to come: no advice, no Eerste Kamer', () => {
		const { groepen } = procedure(huurbeleid, [], false);
		expect(groepen.map((g) => g.id)).toEqual(['tk']);
		const zinnen = groepen.flatMap((g) => g.regels.map((r) => r.zin));
		expect(zinnen.join(' ')).not.toMatch(/Kan nog volgen|Geen advies|Aan de orde na/);
	});

	it('keeps them for a bill without a phase yet', () => {
		const wet = { ...huurbeleid, kind: 'Wetgeving' } as unknown as Detail;
		const ids = procedure(wet, [], false).groepen.map((g) => g.id);
		expect(ids).toEqual(['rvs', 'tk', 'ek']);
	});
});

describe('procedure: the votes of a day', () => {
	type Detail = Parameters<typeof procedure>[0];
	type Entry = Parameters<typeof procedure>[1][number];
	const besluit = (id: string, kind: string, passed: boolean) =>
		({
			node_id: `decisions/${id}`,
			node_type: 'decision',
			date: '2024-04-25',
			kind,
			title: kind,
			body: { chamber: 'TK', passed }
		}) as unknown as Entry;
	const wet = { number: '36496', kind: 'Wetgeving', phases: [] } as unknown as Detail;

	it('counts the amendementen and moties of one day on one line, the bill on its own', () => {
		const entries = [
			besluit('a1', 'Amendement', false),
			besluit('a2', 'Amendement', true),
			besluit('m1', 'Motie', true),
			besluit('w', 'Wetgeving', true)
		];
		const tk = procedure(wet, entries, true).groepen.find((g) => g.id === 'tk')!;
		const zinnen = tk.regels.filter((r) => r.datum === '2024-04-25').map((r) => r.zin);
		expect(zinnen).toEqual(['Aangenomen', 'Stemmingen: 3 besluiten']);
		expect(tk.regels.find((r) => r.zin.startsWith('Stemmingen'))?.actie).toBeTypeOf('function');
	});
});
