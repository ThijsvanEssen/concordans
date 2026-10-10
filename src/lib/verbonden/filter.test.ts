import { describe, expect, it } from 'vitest';
import {
	EMPTY_FILTER,
	PRESETS,
	activePreset,
	bronKindOf,
	bronnenLabel,
	filterParams,
	hiddenByKind,
	kindCount,
	seatCount,
	parseFilter,
	rechterOf,
	rowPasses,
	toggleKind,
	withPreset,
	type VerbondenFilter
} from './filter';
import type { Row } from './rows';
import { countLine, filterGroups, regroup, yearHistogram } from './view';
import type { Group } from './groups';

const row = (over: Partial<Row>): Row => ({
	ref: { collection: 'judgments', key: 'j' },
	title: 'Hof Amsterdam',
	context: null,
	kind: 'uitspraken',
	...over
});

describe('parseFilter', () => {
	it('reads the bronnen and the other filters from the URL, and writes them back', () => {
		const f = parseFilter(
			new URLSearchParams(
				'bronnen=artikelen,wetten,toelichtingen&lid=2&rechter=hof&van=2015&tot=2026'
			)
		);
		expect([...f.bronnen!]).toEqual(['artikelen', 'wetten', 'toelichtingen']);
		expect(f.lid).toBe('2');
		expect(f.rechter).toBe('hof');
		// An address from before, with years, reads as days (the period of every list).
		expect(f.van).toBe('2015-01-01');
		expect(f.tot).toBe('2026-12-31');
		expect(filterParams(f)).toMatchObject({
			bronnen: 'artikelen,wetten,toelichtingen',
			lid: '2',
			rechter: 'hof',
			van: '2015-01-01',
			tot: '2026-12-31',
			betrouwbaarheid: null
		});
	});

	it('means all bronnen when the parameter is absent or holds no known kind', () => {
		expect(parseFilter(new URLSearchParams('')).bronnen).toBeNull();
		expect(parseFilter(new URLSearchParams('bronnen=x')).bronnen).toBeNull();
		expect(filterParams(EMPTY_FILTER).bronnen).toBeNull();
	});
});

describe('presets', () => {
	it('names the active preset in the head of the panel', () => {
		expect(bronnenLabel(EMPTY_FILTER)).toBe('Alle bronnen');
		const f = withPreset(EMPTY_FILTER, PRESETS[2]);
		expect(activePreset(f)?.id).toBe('wetteksten');
		expect(bronnenLabel(f)).toBe('Wetteksten en toelichting');
		expect(activePreset(withPreset(EMPTY_FILTER, PRESETS[4]))?.id).toBe('hoge-raad');
	});

	it('toggles one kind and returns to all when every kind is on', () => {
		const one = toggleKind(EMPTY_FILTER, 'uitspraken');
		expect(one.bronnen!.has('uitspraken')).toBe(false);
		expect(one.bronnen!.size).toBe(7);
		expect(toggleKind(one, 'uitspraken').bronnen).toBeNull();
	});
});

describe('bronKindOf', () => {
	it('splits documents by kind and relation', () => {
		expect(bronKindOf('documents', 'd', { kind: 'Memorie van toelichting' })).toBe('toelichtingen');
		expect(bronKindOf('documents', 'd', { kind: 'Voorstel van wet' })).toBe('wetsvoorstellen');
		expect(bronKindOf('documents', 'd', { kind: 'Brief regering' }, 'AMENDS')).toBe(
			'wetsvoorstellen'
		);
		expect(bronKindOf('documents', 'd', { kind: 'Brief regering' })).toBe('dossiers');
		expect(bronKindOf('articles', 'bwbv0001000_6', {})).toBe('internationaal');
		expect(bronKindOf('judgments', 'ecli_ce_echr_2026_0908jud000748123', {})).toBe(
			'internationaal'
		);
		expect(bronKindOf('instruments', 'bwbr0001854', {})).toBe('wetten');
	});

	it('groups kamerleden, fracties and commissies as leden, not dossiers', () => {
		expect(bronKindOf('members', 'm1', {})).toBe('leden');
		expect(bronKindOf('factions', 'f1', {})).toBe('leden');
		expect(bronKindOf('committees', 'c1', {})).toBe('leden');
		expect(bronKindOf('activities', 'a1', {})).toBe('dossiers');
		expect(bronKindOf('decisions', 'b1', {})).toBe('dossiers');
	});
});

describe('rowPasses', () => {
	const hr = row({ identifier: 'ECLI:NL:HR:2024:1769', date: '2024-12-03', lid: '2' });
	const hof = row({ identifier: 'ECLI:NL:GHAMS:2024:2920', date: '2019-09-10', derived: true });
	const art = row({ ref: { collection: 'articles', key: 'a' }, kind: 'artikelen', lid: null });

	it('applies the bronnen, the lid, the rechter, the period and the betrouwbaarheid', () => {
		const only = (f: Partial<VerbondenFilter>) => ({ ...EMPTY_FILTER, ...f });
		expect(rowPasses(hr, only({ bronnen: new Set(['artikelen']) }))).toBe(false);
		expect(rowPasses(art, only({ bronnen: new Set(['artikelen']) }))).toBe(true);
		expect(rowPasses(hr, only({ lid: '2' }))).toBe(true);
		expect(rowPasses(hof, only({ lid: '2' }))).toBe(false);
		expect(rowPasses(art, only({ lid: 'geen' }))).toBe(true);
		expect(rowPasses(hr, only({ rechter: 'hr' }))).toBe(true);
		expect(rowPasses(hof, only({ rechter: 'hr' }))).toBe(false);
		// A rechter narrows the judgments only.
		expect(rowPasses(art, only({ rechter: 'hr' }))).toBe(true);
		expect(rowPasses(hof, only({ van: '2020-01-01' }))).toBe(false);
		expect(rowPasses(hr, only({ van: '2020-01-01', tot: '2026-12-31' }))).toBe(true);
		expect(rowPasses(hof, only({ betrouwbaarheid: 'bron' }))).toBe(false);
		expect(rowPasses(hof, only({ betrouwbaarheid: 'afgeleid' }))).toBe(true);
		// A confidence of 0.95 counts as hoog, whatever `derived` says.
		const sure = row({ confidence: 0.95, derived: true });
		expect(rowPasses(sure, only({ betrouwbaarheid: 'bron' }))).toBe(true);
		expect(rowPasses(sure, only({ betrouwbaarheid: 'afgeleid' }))).toBe(false);
		expect(rowPasses(hr, only({ jaar: 2024 }))).toBe(true);
		expect(rowPasses(hr, only({ zoek: 'hr:2024' }))).toBe(true);
	});

	it('counts a seat for every year it lasted', () => {
		const only = (f: Partial<VerbondenFilter>) => ({ ...EMPTY_FILTER, ...f });
		const lnv = row({
			ref: { collection: 'committees', key: 'lnv' },
			kind: 'leden',
			period: { from: '2017-11-14', to: '2021-04-06', role: null }
		});
		const now = row({
			ref: { collection: 'committees', key: 'iv' },
			kind: 'leden',
			period: { from: '2025-11-12', to: null, role: null }
		});
		expect(rowPasses(lnv, only({ van: '2019-01-01', tot: '2019-12-31' }))).toBe(true);
		expect(rowPasses(lnv, only({ van: '2022-01-01' }))).toBe(false);
		expect(rowPasses(lnv, only({ jaar: 2020 }))).toBe(true);
		expect(rowPasses(now, only({ van: '2030-01-01' }))).toBe(true);
		expect(rowPasses(now, only({ tot: '2024-12-31' }))).toBe(false);
	});

	it('tells the rechter from the ECLI and the court name', () => {
		expect(rechterOf(hr)).toBe('hr');
		expect(rechterOf(hof)).toBe('hof');
		expect(rechterOf(row({ court: 'Rechtbank Amsterdam' }))).toBe('rechtbank');
		expect(rechterOf(row({ court: 'Raad van State' }))).toBe('rvs');
	});
});

describe('the panel under the filter', () => {
	const groups: Group[] = [
		{
			id: 'judgments',
			label: 'Uitspraken die dit artikel aanhalen',
			rows: [
				row({ date: '2024-01-01', lid: '2' }),
				row({ ref: { collection: 'judgments', key: 'k' }, date: '2023-01-01', lid: '1' })
			],
			total: 1064,
			capped: false
		},
		{
			id: 'cited-by',
			label: 'Artikelen die naar dit artikel verwijzen',
			rows: [row({ ref: { collection: 'articles', key: 'a' }, kind: 'artikelen', lid: '2' })],
			total: 34,
			capped: false
		}
	];

	it('counts what is shown and what is hidden, and never leaves an empty panel silent', () => {
		expect(countLine(groups, EMPTY_FILTER)).toBe('1.098 verbindingen');
		const f = { ...EMPTY_FILTER, bronnen: new Set(['artikelen'] as const) };
		expect(countLine(groups, f)).toBe('34 van 1.098 verbindingen');
		expect(filterGroups(groups, f).map((g) => g.id)).toEqual(['cited-by']);
		expect(
			hiddenByKind(
				groups.flatMap((g) => g.rows),
				{ uitspraken: 1064 },
				f
			)
		).toEqual([{ kind: 'uitspraken', count: 1064 }]);
		const none = { ...EMPTY_FILTER, bronnen: new Set(['dossiers'] as const) };
		expect(filterGroups(groups, none)).toEqual([]);
	});

	it('keeps a group whose loader is still under way in its place, unless a filter cuts rows', () => {
		const wachtend = [
			{ id: 'judgments', label: 'Uitspraken die dit artikel aanhalen', rows: [], capped: false },
			groups[1]
		];
		const shown = filterGroups(wachtend, EMPTY_FILTER, new Set(['judgments']));
		expect(shown.map((g) => [g.id, !!g.laden])).toEqual([
			['judgments', true],
			['cited-by', false]
		]);
		expect(filterGroups(wachtend, EMPTY_FILTER).map((g) => g.id)).toEqual(['cited-by']);
		const f = { ...EMPTY_FILTER, bronnen: new Set(['artikelen'] as const) };
		expect(filterGroups(wachtend, f, new Set(['judgments'])).map((g) => g.id)).toEqual([
			'cited-by'
		]);
	});

	it('regroups per lid, the rest under Hele artikel', () => {
		const perLid = regroup(
			[
				...groups,
				{
					id: 'law',
					label: 'Wet',
					rows: [row({ ref: { collection: 'instruments', key: 'w' }, kind: 'wetten' })],
					capped: false
				}
			],
			'lid',
			'articles'
		);
		expect(perLid.map((g) => g.label)).toEqual(['Lid 1', 'Lid 2', 'Hele artikel']);
		expect(perLid[1].rows).toHaveLength(2);
	});

	it('counts judgments per year for the bar chart', () => {
		const bars = yearHistogram(groups[0].rows, 3);
		expect(bars.map((b) => b.year)).toEqual([2022, 2023, 2024]);
		expect(bars.map((b) => b.count)).toEqual([0, 1, 1]);
	});
});

describe('kindCount and seatCount', () => {
	it('put the noun in the number of the count', () => {
		expect(kindCount(1, 'wetten')).toBe('1 wet');
		expect(kindCount(3, 'artikelen')).toBe('3 artikelen');
		expect(kindCount(1_064, 'uitspraken')).toBe('1.064 uitspraken');
		expect(seatCount(1)).toBe('1 zetel');
		expect(seatCount(22)).toBe('22 zetels');
	});
});
