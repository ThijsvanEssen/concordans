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

	it('gives no outcome for a postponed vote (36799, 22\u00a0september\u00a02026)', () => {
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
			[
				'2026-09-29',
				'Gewijzigd voorstel van wet',
				'Kamerstukken I 2026/27, 36799, A',
				'https://ek/x.pdf'
			],
			[
				null,
				'Nu: schriftelijke voorbereiding. Volgende stappen: plenaire behandeling en afkondiging.',
				null,
				null
			]
		]);
	});

	it('after the vote names only what follows it: a hamerstuk leaves the earlier steps empty', () => {
		const steps = [
			{ phase: 'Schriftelijke voorbereiding', state: 'leeg', papers: [] },
			{ phase: 'Plenair', state: 'leeg', papers: [] },
			{ phase: 'Afkondiging', state: 'leeg', papers: [] }
		];
		const decided = (outcome: string) => ({
			...base,
			ek_outcome: { outcome, date: '2026-10-27', method: 'Hamerstuk' },
			senate: senate(steps)
		});
		const last = (d: unknown) => ekGroup(d)?.regels.at(-1)?.zin ?? null;
		expect(last(decided('Aangenomen'))).toBe('Volgende stappen: afkondiging.');
		expect(last(decided('Verworpen'))).toBeNull();
	});

	it('links the publication of the wet to its Staatsblad page, the other to eerstekamer.nl', () => {
		const d = {
			...base,
			closed: true,
			enacted: [{ key: 'stb_2024_193', published_on: '2024-06-28', path: '/stb/2024/193' }],
			senate: senate([
				{
					phase: 'Afkondiging',
					state: 'vol',
					papers: [
						paper('publicatie inwerkingtreding', '2024-06-28', null, 'https://ek/i.pdf'),
						paper('publicatie wet', '2024-06-28', null, 'https://ek/w.pdf')
					]
				}
			])
		};
		const g = ekGroup(d)!;
		expect(g.regels.map((r) => [r.zin, r.href])).toEqual([
			['Publicatie inwerkingtreding', 'https://ek/i.pdf'],
			['Publicatie wet', '/stb/2024/193']
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

	it('names a paper of its page once where a line of the timeline holds its letter', () => {
		const d = {
			...base,
			senate: senate([
				{
					phase: 'Schriftelijke voorbereiding',
					state: 'vol',
					papers: [
						paper('voorlopig verslag', '2026-09-08', 'EK, A'),
						paper('memorie van antwoord', '2026-09-08', 'EK, B'),
						paper('brief', '2026-09-10', 'EK, C'),
						paper('nader voorlopig verslag', '2026-09-20', 'EK, D')
					]
				}
			])
		};
		const doc = (key: string, date: string, kind: string, number: string) => ({
			node_id: `documents/${key}`,
			node_type: 'document',
			date,
			kind,
			title: kind,
			body: { chamber: 'EK', number }
		});
		const entries = [
			doc('a', '2026-09-08', 'Verslag', 'A'),
			doc('b', '2026-09-08', 'Memorie van antwoord', 'B'),
			{ ...doc('c', '2026-09-10', 'Brief', 'C'), title: 'Brief over de planning' }
		] as unknown as Entry[];
		const g = procedure(d as unknown as Detail, entries, true).groepen.find((g) => g.id === 'ek')!;
		expect(g.regels.map((r) => [r.zin, r.nummers ?? null])).toEqual([
			['Verslag en memorie van antwoord', ['A', 'B']],
			['Brief over de planning', ['C']],
			['Nader voorlopig verslag', null]
		]);
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
			'Volgende stappen: verslag of plenaire behandeling, en stemming.'
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
			[
				null,
				'Voorstel van wet en memorie van toelichting',
				'Kamerstukken II 2023/24, 36547, nrs. 2–3'
			],
			[
				'Brief regering',
				'Aanbieding van het onderzoek naar uitbuiting',
				'Kamerstukken II 2023/24, 36547, nr. 4'
			]
		]);
	});

	it('is named by its kind where its title only names the kind', () => {
		const [regel] = tk([doc('m', 'Motie', 'Motie', 12)]);
		expect([regel.label, regel.zin, regel.meta]).toEqual([
			null,
			'Motie',
			'Kamerstukken II 2023/24, 36547, nr. 12'
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

describe('procedure: what can still follow in the Tweede Kamer', () => {
	type Detail = Parameters<typeof procedure>[0];
	const nog = (current_phase: string | null) => {
		const d = { number: '36500', kind: 'Wetgeving', current_phase, phases: [] };
		const tk = procedure(d as unknown as Detail, [], false).groepen.find((g) => g.id === 'tk')!;
		return tk.regels.find((r) => r.id === 'tk-nog')?.zin;
	};

	it.each([
		[
			null,
			'Volgende stappen: verslag, nota naar aanleiding van het verslag, nota van wijziging, plenaire behandeling en stemming.'
		],
		[
			'Voorstel van wet',
			'Volgende stappen: verslag, nota naar aanleiding van het verslag, nota van wijziging, plenaire behandeling en stemming.'
		],
		[
			'Advies Raad van State',
			'Volgende stappen: verslag, nota naar aanleiding van het verslag, nota van wijziging, plenaire behandeling en stemming.'
		],
		[
			'Verslag',
			'Volgende stappen: nota naar aanleiding van het verslag, nota van wijziging, plenaire behandeling en stemming.'
		],
		[
			'Nota n.a.v. het verslag',
			'Volgende stappen: nota van wijziging, plenaire behandeling en stemming.'
		],
		[
			'Nota van wijziging / Amendement',
			'Volgende stappen: nog een nota van wijziging, plenaire behandeling en stemming.'
		],
		// Votes on amendementen or moties, not yet on the bill: its vote can still follow.
		['Stemmingen', 'Volgende stappen: stemming.']
	])('after %s', (phase, zin) => {
		expect(nog(phase)).toBe(zin);
	});
});

describe('procedure: how a vote on the bill was taken', () => {
	type Detail = Parameters<typeof procedure>[0];
	type Entry = Parameters<typeof procedure>[1][number];
	const vote = (body: object, kind = 'Wetgeving', title = 'Wetgeving') =>
		({
			node_id: 'decisions/w',
			node_type: 'decision',
			date: '2024-04-25',
			kind,
			title,
			body: { chamber: 'TK', passed: true, ...body }
		}) as unknown as Entry;
	const zin = (e: Entry, over: object = {}) => {
		const d = { number: '36496', kind: 'Wetgeving', phases: [], ...over } as unknown as Detail;
		const tk = procedure(d, [e], true).groepen.find((g) => g.id === 'tk')!;
		return tk.regels.find((r) => r.id === 'decisions/w')?.zin;
	};

	it('names a hamerstuk, sitting and standing, and a decision without a vote', () => {
		expect(zin(vote({ method: 'Hamerstuk' }))).toBe('Aangenomen als hamerstuk');
		expect(zin(vote({ method: 'Stemming bij zitten en opstaan, aangenomen' }))).toBe(
			'Aangenomen bij zitten en opstaan'
		);
		expect(zin(vote({}, 'Wetgeving', 'Wetsvoorstel aangenomen zonder stemming'))).toBe(
			'Aangenomen zonder stemming'
		);
		expect(zin(vote({}))).toBe('Aangenomen');
	});

	it('takes the way from the Tweede Kamer’s decision on the bill', () => {
		const d = { tk_decision: { kind: 'Stemmen - zonder stemming aannemen', date: '2024-04-25' } };
		expect(zin(vote({}), d)).toBe('Aangenomen zonder stemming');
	});
});

describe('procedure: a timeline cut at its limit (live toets 27 Oct b, B5)', () => {
	type Detail = Parameters<typeof procedure>[0];
	const wet = (done: boolean) =>
		({
			number: '36600-VII',
			kind: 'Begroting',
			closed: false,
			current_phase: 'Stemmingen',
			tk_decision: null,
			ek_outcome: null,
			phases: [
				{ name: 'Advies Raad van State', chamber: 'TK', done, date: done ? '2024-09-09' : null }
			]
		}) as unknown as Detail;
	const rvs = (d: Detail, cut: boolean) =>
		procedure(d, [], false, cut).groepen.find((g) => g.id === 'rvs');

	it('does not say "Geen advies" when the oldest entries are not in the list', () => {
		const zinnen = procedure(wet(true), [], false, true).groepen.flatMap((g) =>
			g.regels.map((r) => r.zin)
		);
		expect(zinnen.join(' ')).not.toMatch(/Geen advies/);
	});
	it('names the advice the phases hold, with its day', () => {
		const g = rvs(wet(true), true);
		expect(g?.regels.map((r) => [r.datum, r.zin])).toEqual([['2024-09-09', 'Advies uitgebracht']]);
	});
	it('says nothing of an advice neither list holds, rather than that there is none', () => {
		expect(rvs(wet(false), true)).toBeUndefined();
	});
	it('keeps the line of the whole list: no entry, no advice', () => {
		expect(rvs(wet(false), false)?.regels.map((r) => r.zin)).toEqual([
			'Geen advies in de gegevens.'
		]);
	});
});
