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

	it('keeps the general line without a page', () => {
		const g = ekGroup({ ...base, senate: senate([]) })!;
		expect(g.regels.map((r) => r.zin)).toEqual([
			'Kan nog volgen: verslag of plenaire behandeling, en stemming.'
		]);
	});
});
