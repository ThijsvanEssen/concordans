import { describe, expect, it } from 'vitest';
import {
	EMPTY_FILTER,
	PRESETS,
	activePreset,
	HIGH_CONFIDENCE,
	MODERATE_CONFIDENCE,
	bronKindOf,
	confidenceWord,
	filterParams,
	hiddenByKind,
	kindCount,
	parseFilter,
	rechterOf,
	rowPasses,
	toggleKind,
	withPreset,
	type VerbondenFilter
} from './filter';
import type { Row } from './rows';
import { countLine, filterGroups, regroup, vasteGroepen, yearHistogram } from './view';
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
				'bronnen=artikelen,wetten,toelichtingen&lid=2&rechter=hof&van=2015-01-01&tot=2026-12-31'
			)
		);
		expect([...f.bronnen!]).toEqual(['artikelen', 'wetten', 'toelichtingen']);
		expect(f.lid).toBe('2');
		expect(f.rechter).toBe('hof');
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
	it('knows the active preset, by its bronnen and rechter', () => {
		expect(activePreset(EMPTY_FILTER)?.id).toBe('alles');
		expect(activePreset(withPreset(EMPTY_FILTER, PRESETS[2]))?.id).toBe('wetteksten');
		expect(activePreset(withPreset(EMPTY_FILTER, PRESETS[4]))?.id).toBe('hoge-raad');
		const f = toggleKind(toggleKind(EMPTY_FILTER, 'toelichtingen'), 'internationaal');
		expect(activePreset(f)).toBeNull();
		expect(activePreset({ ...EMPTY_FILTER, rechter: 'hr' })).toBeNull();
	});

	it('toggles one kind and returns to all when every kind is on', () => {
		const one = toggleKind(EMPTY_FILTER, 'uitspraken');
		expect(one.bronnen!.has('uitspraken')).toBe(false);
		expect(one.bronnen!.size).toBe(8);
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

	it.each([
		['ESTABLISHES', 'dossiers'],
		['AMENDS', 'wetsvoorstellen'],
		['INTRODUCES', 'wetsvoorstellen'],
		['REPEALS', 'wetsvoorstellen']
	] as const)('counts a stuk that %s a law as %s', (relation, kind) => {
		expect(bronKindOf('documents', 'd', { kind: 'Brief regering' }, relation)).toBe(kind);
	});

	it('groups kamerleden, fracties and commissies as leden, not dossiers', () => {
		expect(bronKindOf('members', 'm1', {})).toBe('leden');
		expect(bronKindOf('factions', 'f1', {})).toBe('leden');
		expect(bronKindOf('committees', 'c1', {})).toBe('leden');
		expect(bronKindOf('activities', 'a1', {})).toBe('dossiers');
		expect(bronKindOf('decisions', 'b1', {})).toBe('stemmingen');
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
		expect(rechterOf(row({ ref: { collection: 'judgments', key: 'ecli_nl_rbams_2020_1' } }))).toBe(
			'rechtbank'
		);
		expect(rechterOf(row({ ref: { collection: 'judgments', key: 'ecli_ce_echr_2026_1' } }))).toBe(
			'ehrm'
		);
		expect(rechterOf(row({ identifier: 'ECLI:NL:CRVB:2020:1' }))).toBeNull();
	});

	it('reads the rechter from the tier the API gives, before the ECLI', () => {
		const tier = (t: string) => row({ props: { tier: t } });
		expect(rechterOf(tier('hoge_raad'))).toBe('hr');
		expect(rechterOf(tier('parket'))).toBe('hr');
		expect(rechterOf(tier('gerechtshof'))).toBe('hof');
		expect(rechterOf(tier('rechtbank'))).toBe('rechtbank');
		expect(rechterOf(tier('raad_van_state'))).toBe('rvs');
		expect(rechterOf(tier('andere_instantie'))).toBeNull();
		// No guess from the court's name: a row without tier or ECLI has no rechter.
		expect(rechterOf(row({ court: 'Rechtbank Amsterdam' }))).toBeNull();
	});
});

describe('confidenceWord', () => {
	it('grades hoog from HIGH_CONFIDENCE, matig from MODERATE_CONFIDENCE, else laag', () => {
		expect([HIGH_CONFIDENCE, MODERATE_CONFIDENCE]).toEqual([0.9, 0.6]);
		expect(confidenceWord(0.9, false)).toBe('hoog');
		expect(confidenceWord(0.89, false)).toBe('matig');
		expect(confidenceWord(0.6, true)).toBe('matig');
		expect(confidenceWord(0.59, false)).toBe('laag');
		// Without a figure: read from the source is hoog, derived matig.
		expect(confidenceWord(null, false)).toBe('hoog');
		expect(confidenceWord(null, true)).toBe('matig');
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
		// A group the API cut off without a total: the sum is at least.
		const afgekapt = [
			...groups,
			{ ...groups[groups.length - 1], id: 'x', total: undefined, capped: true }
		];
		expect(countLine(afgekapt, EMPTY_FILTER)).toBe('1.099+ verbindingen');
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

	it('writes one count, once it holds (UX-toets 0.79.47, #56)', () => {
		const leden = { ...groups[1], id: 'members', total: 300 };
		const dossiers = { id: 'dossiers', label: 'Dossiers', rows: [], capped: false };
		const activiteiten = { id: 'activities', label: 'Activiteiten', rows: [], capped: false };
		const alle = [leden, dossiers, activiteiten];
		// A waiting group the node cannot foretell: no count yet.
		expect(vasteGroepen(alle, ['dossiers', 'activities'], { activities: 4493 })).toBeNull();
		// Dossiers in, the activities foretold: the count it will have.
		const binnen = [leden, { ...dossiers, rows: [groups[1].rows[0]], total: 611 }, activiteiten];
		const vast = vasteGroepen(binnen, ['activities'], { activities: 4493 })!;
		const wacht = new Set(['activities']);
		expect(countLine(vast, EMPTY_FILTER, wacht)).toBe('5.404 verbindingen');
		// The same once the activities are in.
		const klaar = [...binnen.slice(0, 2), { ...activiteiten, rows: [row({})], total: 4493 }];
		expect(countLine(vasteGroepen(klaar)!, EMPTY_FILTER)).toBe('5.404 verbindingen');
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

describe('kindCount', () => {
	it('put the noun in the number of the count', () => {
		expect(kindCount(1, 'wetten')).toBe('1 wet');
		expect(kindCount(3, 'artikelen')).toBe('3 artikelen');
		expect(kindCount(1_064, 'uitspraken')).toBe('1.064 uitspraken');
	});
});
