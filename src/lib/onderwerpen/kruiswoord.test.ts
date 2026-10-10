import { describe, expect, it } from 'vitest';
import {
	amendementKetens,
	grenzenVan,
	leesKeuze,
	somVan,
	tel,
	vakken,
	weekVan
} from './kruiswoord';

describe('the Kruiswoord', () => {
	it('names a week as ISO does', () => {
		expect(weekVan('2026-10-10')).toBe('2026-W41');
		expect(weekVan('2021-01-03')).toBe('2020-W53');
		expect(weekVan('2024-12-30')).toBe('2025-W01');
	});

	it('gives the days of a month and a week', () => {
		expect(grenzenVan('2026-02')).toEqual({ van: '2026-02-01', tot: '2026-02-28' });
		expect(grenzenVan('2026-W41')).toEqual({ van: '2026-10-05', tot: '2026-10-11' });
	});

	it('lays out the months of a period, the newest first', () => {
		expect(vakken('2025-11-15', '2026-02-03', 'maand')).toEqual([
			'2026-02',
			'2026-01',
			'2025-12',
			'2025-11'
		]);
		expect(vakken('2026-09-28', '2026-10-10', 'week')).toEqual(['2026-W41', '2026-W40']);
		expect(vakken('', '2026-01-01', 'maand')).toEqual([]);
	});

	it('counts the stemmingen by outcome, the feed per kind, and marks what is new', () => {
		const m = tel(
			[
				{ date: '2026-10-08', count: 3, passed: 2 },
				{ date: '2026-09-02', count: 1, passed: 0 }
			],
			[
				{ date: '2026-10-07', kolom: 'moties' },
				{ date: '2026-09-30', kolom: 'brieven' },
				{ date: '2026-09-01', kolom: 'toezeggingen', count: 4 }
			],
			'maand',
			'2026-10-01'
		);
		const okt = m.get('2026-10')!;
		expect(okt.aangenomen).toEqual({ n: 2, nieuw: true });
		expect(okt.verworpen).toEqual({ n: 1, nieuw: true });
		expect(okt.moties).toEqual({ n: 1, nieuw: true });
		const sep = m.get('2026-09')!;
		expect(sep.verworpen).toEqual({ n: 1, nieuw: false });
		expect(sep.toezeggingen.n).toBe(4);
		expect(somVan(sep)).toBe(6);
	});

	it('reads a chosen cell from the URL', () => {
		expect(leesKeuze('moties:2026-10')).toEqual({ kolom: 'moties', vak: '2026-10' });
		expect(leesKeuze('brieven:2026-W41')).toEqual({ kolom: 'brieven', vak: '2026-W41' });
		expect(leesKeuze('alles:2026-10')).toBeNull();
	});

	it('counts an amendment once per chain, on the day of its first paper', () => {
		const rij = (
			ids: string[],
			dagen: string[],
			aangenomen: boolean | null,
			soort: string | null = null
		) => ({
			stuk: { id: ids.at(-1)!, nummer: '12', titel: 'Amendement van het lid X' },
			haltes: ids.map((id, i) => ({ id, datum: dagen[i] })),
			uitslag: aangenomen === null && !soort ? null : { aangenomen, soort },
			nogNiet: aangenomen === null && !soort
		});
		const k = amendementKetens(
			[
				rij(['documents/a', 'documents/b'], ['2026-03-01', '2026-04-02'], true),
				rij(['documents/c'], ['2026-05-01'], null, 'ingetrokken'),
				rij(['documents/d'], ['2026-05-02'], null),
				rij(['documents/z'], ['2026-05-03'], false)
			],
			new Set(['documents/b', 'documents/c', 'documents/d'])
		);
		expect(k.map((a) => [a.id, a.datum, a.uitkomst])).toEqual([
			['documents/b', '2026-03-01', 'aangenomen'],
			['documents/c', '2026-05-01', 'ingetrokken'],
			['documents/d', '2026-05-02', 'nog niet gestemd']
		]);
	});
});
