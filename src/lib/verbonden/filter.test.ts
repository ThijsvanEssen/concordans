import { describe, expect, it } from 'vitest';
import {
	EMPTY_FILTER,
	PRESETS,
	activePreset,
	HIGH_CONFIDENCE,
	MODERATE_CONFIDENCE,
	filterGroupOf,
	confidenceWord,
	filterParams,
	filterGroupCount,
	parseFilter,
	rechterOf,
	rowPasses,
	toggleFilterGroup,
	withPreset,
	type VerbondenFilter
} from './filter';
import type { Row } from './rows';

const row = (over: Partial<Row>): Row => ({
	ref: { collection: 'judgments', key: 'j' },
	title: 'Hof Amsterdam',
	context: null,
	filterGroup: 'uitspraken',
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
		const f = toggleFilterGroup(toggleFilterGroup(EMPTY_FILTER, 'toelichtingen'), 'internationaal');
		expect(activePreset(f)).toBeNull();
		expect(activePreset({ ...EMPTY_FILTER, rechter: 'hr' })).toBeNull();
	});

	it('toggles one kind and returns to all when every kind is on', () => {
		const one = toggleFilterGroup(EMPTY_FILTER, 'uitspraken');
		expect(one.bronnen!.has('uitspraken')).toBe(false);
		expect(one.bronnen!.size).toBe(8);
		expect(toggleFilterGroup(one, 'uitspraken').bronnen).toBeNull();
	});
});

describe('filterGroupOf', () => {
	it('splits documents by kind and relation', () => {
		expect(filterGroupOf('documents', 'd', { kind: 'Memorie van toelichting' })).toBe(
			'toelichtingen'
		);
		expect(filterGroupOf('documents', 'd', { kind: 'Voorstel van wet' })).toBe('wetsvoorstellen');
		expect(filterGroupOf('documents', 'd', { kind: 'Brief regering' }, 'AMENDS')).toBe(
			'wetsvoorstellen'
		);
		expect(filterGroupOf('documents', 'd', { kind: 'Brief regering' })).toBe('dossiers');
		expect(filterGroupOf('articles', 'bwbv0001000_6', {})).toBe('internationaal');
		expect(filterGroupOf('judgments', 'ecli_ce_echr_2026_0908jud000748123', {})).toBe(
			'internationaal'
		);
		// The courts of the EU as the EHRM: by the key, or by the source of a node.
		expect(filterGroupOf('judgments', 'ecli_eu_c_2023_494', {})).toBe('internationaal');
		expect(filterGroupOf('judgments', 'x', { source: 'cjeu' })).toBe('internationaal');
		expect(filterGroupOf('instruments', 'bwbr0001854', {})).toBe('wetten');
	});

	it.each([
		['ESTABLISHES', 'dossiers'],
		['AMENDS', 'wetsvoorstellen'],
		['INTRODUCES', 'wetsvoorstellen'],
		['REPEALS', 'wetsvoorstellen']
	] as const)('counts a stuk that %s a law as %s', (relation, kind) => {
		expect(filterGroupOf('documents', 'd', { kind: 'Brief regering' }, relation)).toBe(kind);
	});

	it('groups kamerleden, fracties and commissies as leden, not dossiers', () => {
		expect(filterGroupOf('members', 'm1', {})).toBe('leden');
		expect(filterGroupOf('factions', 'f1', {})).toBe('leden');
		expect(filterGroupOf('committees', 'c1', {})).toBe('leden');
		expect(filterGroupOf('activities', 'a1', {})).toBe('dossiers');
		expect(filterGroupOf('decisions', 'b1', {})).toBe('stemmingen');
	});
});

describe('rowPasses', () => {
	const hr = row({ identifier: 'ECLI:NL:HR:2024:1769', date: '2024-12-03', lid: '2' });
	const hof = row({ identifier: 'ECLI:NL:GHAMS:2024:2920', date: '2019-09-10', derived: true });
	const art = row({
		ref: { collection: 'articles', key: 'a' },
		filterGroup: 'artikelen',
		lid: null
	});

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
			filterGroup: 'leden',
			period: { from: '2017-11-14', to: '2021-04-06', role: null }
		});
		const now = row({
			ref: { collection: 'committees', key: 'iv' },
			filterGroup: 'leden',
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
		expect(rechterOf(row({ ref: { collection: 'judgments', key: 'ecli_eu_t_2021_441' } }))).toBe(
			'hvj'
		);
		expect(rechterOf(row({ identifier: 'ECLI:NL:CRVB:2020:1' }))).toBeNull();
	});

	it('knows the courts of the EU without a tier: by source, ECLI, or as the Rechtspraak publishes them (XX)', () => {
		// A neighbour carries no tier (live: ECLI:NL:XX:2013:178 beside GHDHA:2015:950).
		const xx = (props: Record<string, unknown>) =>
			row({ ref: { collection: 'judgments', key: 'ecli_nl_xx_2013_178' }, props });
		expect(rechterOf(xx({ court: 'Hof van Justitie van de Europese Unie' }))).toBe('hvj');
		expect(rechterOf(xx({ court: 'Gerecht van de Europese Unie' }))).toBe('hvj');
		expect(rechterOf(xx({ court: null, case_number: 'C-437/12' }))).toBe('hvj');
		expect(rechterOf(xx({ court: 'Kroon' }))).toBeNull();
		expect(rechterOf(row({ props: { source: 'cjeu' } }))).toBe('hvj');
		expect(rechterOf(row({ props: { source: 'echr' } }))).toBe('ehrm');
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

describe('filterGroupCount', () => {
	it('put the noun in the number of the count', () => {
		expect(filterGroupCount(1, 'wetten')).toBe('1 wet');
		expect(filterGroupCount(3, 'artikelen')).toBe('3 artikelen');
		expect(filterGroupCount(1_064, 'uitspraken')).toBe('1.064 uitspraken');
	});
});
