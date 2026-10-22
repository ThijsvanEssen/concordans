// The register of Bronnen: per list the request an address asks, its period and its filters.
import { describe, expect, it } from 'vitest';
import { activeFilters } from '../IndexFacets.svelte';
import { INDEX_CATEGORIES, type IndexCategory } from '../categories';
import { LISTS } from '.';
import { forParams, type ListContext } from './list';
import { readParams } from './params';

const params = (query: string) => readParams(new URLSearchParams(query));

/** The request of a list for an address, under the sort it names or the first. */
function query(category: IndexCategory, address = '') {
	const list = LISTS[category];
	const p = params(address);
	const sorts = forParams(list.sorts, p);
	return JSON.parse(JSON.stringify(list.query(p, sorts.find((s) => s.id === p.sort) ?? sorts[0])));
}

/** The filter groups of a list for an address, under its state and the courts' coverage. */
function facetGroups(
	category: IndexCategory,
	address: string,
	state = {},
	coverage = null,
	patch: (p: object) => void = () => {}
) {
	const p = params(address);
	const list = LISTS[category];
	const sort = forParams(list.sorts, p)[0];
	const ctx = {
		p,
		sort,
		dir: sort.dir,
		rows: [],
		page: undefined,
		state,
		shared: { cabinets: [], ministries: [], coverage, parties: [] },
		loading: false,
		patch,
		toggleOpen: () => {},
		openGroups: new Set(),
		toggleGroup: () => {},
		tabHref: () => '',
		empty: (() => {}) as never
	} satisfies ListContext<unknown, object>;
	return list.facets(ctx);
}

/** The filters of a list for an address, as its chips name them. */
function chips(category: IndexCategory, address: string, state = {}) {
	return activeFilters(facetGroups(category, address, state)).map((c) => c.label);
}

describe('the register of Bronnen', () => {
	it('holds a list for every tab', () => {
		expect(Object.keys(LISTS).sort()).toEqual(INDEX_CATEGORIES.map((c) => c.key).sort());
	});

	it('names the period of every list by the date it is about', () => {
		const p = params('');
		expect(
			Object.fromEntries(
				INDEX_CATEGORIES.map(({ key }) => [key, LISTS[key].period(p)?.label ?? null])
			)
		).toEqual({
			instruments: 'In werking getreden',
			judgments: 'Periode',
			dossiers: 'Geopend',
			decisions: 'Datum',
			documents: 'Datum',
			members: 'Actief',
			factions: 'Actief',
			committees: 'Actief',
			cabinets: 'Periode',
			ministers: 'In functie',
			commitments: 'Gedaan'
		});
		// Side by side the cabinets are the period (Tot en met).
		expect(LISTS.ministers.period(params('weergave=naast'))).toBeNull();
	});
});

describe('the request of a list', () => {
	it('asks the laws with an article unless empty ones are asked for', () => {
		expect(query('instruments')).toEqual({ article_count_min: 1, sort: 'title', limit: 100 });
		expect(
			query(
				'instruments',
				'q=huur&soort=verdrag&jurisdiction=eu&leeg=1&legal_area=x&sort=article_count'
			)
		).toEqual({
			q: 'huur',
			jurisdiction: 'eu',
			kind: 'verdrag',
			legal_area: 'x',
			sort: 'article_count',
			limit: 100
		});
	});

	it('asks every judgment, those of the EHRM alone when it is chosen', () => {
		expect(query('judgments')).toEqual({ sort: 'date_desc', limit: 100 });
		expect(
			query(
				'judgments',
				'tier=rechtbank&court_kind=x&subject_area=Civiel+recht&van=2020-01-01&source=echr'
			)
		).toEqual({
			tier: ['rechtbank'],
			subject_area: 'Civiel recht',
			source: 'echr',
			from: '2020-01-01',
			sort: 'date_desc',
			limit: 100
		});
	});

	it('asks the open dossiers, all of them for a number searched for', () => {
		expect(query('dossiers')).toEqual({ status: 'open', sort: 'opened_on', limit: 100 });
		expect(query('dossiers', 'q=36600-VIII')).toMatchObject({
			status: 'all',
			subject: '36600-VIII'
		});
		expect(
			query(
				'dossiers',
				'stand=closed&uitkomst=aangenomen&phase=Eindtekst,Verslag&track=Wetgeving&ministerie=bzk&van=2020-01-01&sort=number'
			)
		).toEqual({
			status: 'closed',
			outcome: 'aangenomen',
			phase: 'Eindtekst,Verslag',
			kind: 'Wetgeving',
			ministry: 'bzk',
			opened_from: '2020-01-01',
			sort: 'number',
			limit: 100
		});
	});

	it('asks the sitting members in one slice, all of them in a period', () => {
		expect(query('members')).toEqual({
			chamber: 'TK',
			active: true,
			include_all: false,
			sort: 'family_name',
			limit: 200
		});
		expect(query('members', 'kamer=EK&van=2020-01-01&fractie=VVD&sort=party')).toEqual({
			chamber: 'EK',
			party: 'VVD',
			include_all: true,
			active_from: '2020-01-01',
			limit: 100
		});
	});

	it('asks the fracties and commissies of the Kamer shown, sorted here', () => {
		expect(query('factions', 'sort=name&q=pvv')).toEqual({ chamber: 'TK', q: 'pvv', active: true });
		expect(query('factions', 'include_inactive=1')).toEqual({ chamber: 'TK' });
		expect(query('committees', 'kamer=EK&q=x&tot=2024-12-31')).toEqual({
			chamber: 'EK',
			active_to: '2024-12-31'
		});
	});

	it('asks the stemmingen with one q and the outcome as a boolean', () => {
		expect(query('decisions')).toEqual({ chamber: 'TK', limit: 200 });
		expect(query('decisions', 'q=huur&passed=false&soort=Motie&dossier=36600&fractie=VVD')).toEqual(
			{
				chamber: 'TK',
				kind: 'Motie',
				passed: false,
				q: ['huur'],
				dossier: '36600',
				party: 'VVD',
				limit: 200
			}
		);
	});

	it('asks the stukken of one Kamer, a number searched for as their dossier', () => {
		expect(query('documents', 'kamer=EK&q=36600&soort=Motie')).toEqual({
			chamber: 'EK',
			kind: 'Motie',
			dossier: '36600',
			limit: 100
		});
	});

	it('asks the toezeggingen by their filters, the government lists by the cabinet', () => {
		expect(
			query('commitments', 'status=Openstaand&overdue=1&persoon=x&sort=expected_resolution')
		).toEqual({
			member: 'x',
			overdue: true,
			status: 'Openstaand',
			sort: 'expected_resolution',
			limit: 100
		});
		expect(query('ministers', 'kabinet=jetten&van=2026-01-01&post=minister')).toEqual({
			cabinet: 'jetten',
			from: '2026-01-01',
			to: ''
		});
		expect(query('cabinets', 'q=rutte')).toBeNull();
	});

	it('leaves out a value the site does not know', () => {
		expect(query('dossiers', 'track=x&phase=y&ministerie=z&stand=q')).toEqual(query('dossiers'));
		expect(query('judgments', 'tier=x&court_kind=y&source=z')).toEqual(query('judgments'));
	});
});

describe('the filters of a list', () => {
	it('names each filter in force, a default one not', () => {
		expect(chips('dossiers', '')).toEqual([]);
		expect(
			chips('dossiers', 'stand=closed&track=Wetgeving&phase=Eindtekst&ministerie=bzk')
		).toEqual(['Afgehandeld', 'Wetgeving', 'Eindtekst', 'bzk']);
		expect(chips('decisions', 'passed=true&soort=Motie&dossier=36600')).toEqual([
			'Motie',
			'Aangenomen',
			'Dossier: 36600'
		]);
		expect(chips('instruments', 'jurisdiction=nl&soort=verdrag&leeg=1&policy_domain=x')).toEqual([
			'x',
			'Nederland',
			'Verdragen',
			'Ook zonder artikelen'
		]);
		expect(chips('commitments', 'status=Afgedaan&overdue=1&persoon=x')).toEqual([
			'Afgedaan',
			'Open en over de verwachte datum',
			'Gekozen bewindspersoon'
		]);
	});

	it('leaves the history of the Eerste Kamer out: it is known from the first read on', () => {
		expect(chips('members', 'include_inactive=1')).toEqual(['Ook historische leden']);
		expect(chips('members', 'kamer=EK&include_inactive=1')).toEqual([]);
		expect(chips('factions', 'kamer=EK&include_inactive=1')).toEqual([]);
		expect(chips('committees', 'kamer=EK&only_active=1')).toEqual([]);
	});
});

describe('the courts of the judgments', () => {
	// The live answer without a filter: every source, the EHRM's 3.232 among them.
	const coverage = {
		total: 1001512,
		first_date: null,
		last_date: null,
		stubs: 0,
		replaced: 0,
		tiers: [
			{ tier: 'hoge_raad', count: 57506 },
			{ tier: 'rechtbank', count: 510203 },
			{ tier: 'ehrm', count: 3480 },
			{ tier: 'hvj_eu', count: 2410 }
		],
		courts: [
			{ source: 'rechtspraak', count: 998280 },
			{ source: 'echr', count: 3232 },
			{ source: 'cjeu', count: 2100 }
		]
	} as never;
	const facets = {
		tier: [
			{ value: 'rechtbank', count: 510203 },
			{ value: 'hoge_raad', count: 57506 },
			{ value: 'ehrm', count: 3480 },
			{ value: 'hvj_eu', count: 2410 }
		],
		source: [
			{ value: 'rechtspraak', count: 998280 },
			{ value: 'echr', count: 3232 },
			{ value: 'cjeu', count: 2100 }
		]
	};
	const options = (address: string, patch: (p: object) => void = () => {}) =>
		facetGroups('judgments', address, { facets }, coverage, patch).flatMap((g) =>
			g.kind === 'list' ? g.options : []
		);
	const counts = (address: string) =>
		Object.fromEntries(options(address).map((o) => [o.id, o.count]));

	it('counts each court as the list it chooses holds', () => {
		// The EHRM is `source=echr`: its own judgments, not the Dutch ones that name it as court.
		expect(counts('')).toMatchObject({ hoge_raad: 57506, rechtbank: 510203, ehrm: 3232 });
		expect(counts('q=huur')).toMatchObject({ hoge_raad: 57506, ehrm: 3232 });
	});

	it('takes the Hof van Justitie EU as its own source, as the EHRM', () => {
		// The courts of the EU are `source=cjeu`, not the Dutch records that name the Court.
		expect(counts('')).toMatchObject({ hvj_eu: 2100, ehrm: 3232 });
		const on = (address: string) => Object.fromEntries(options(address).map((o) => [o.id, o.on]));
		expect(on('source=cjeu')).toMatchObject({ hvj_eu: true, ehrm: false, hoge_raad: false });
		expect(on('source=echr')).toMatchObject({ hvj_eu: false, ehrm: true });
		const patched: object[] = [];
		const hof = options('', (p) => patched.push(p)).find((o) => o.id === 'hvj_eu')!;
		hof.onClick?.();
		expect(patched).toEqual([{ tier: null, court_kind: null, court: null, source: 'cjeu' }]);
		expect(query('judgments', 'source=cjeu')).toMatchObject({ source: 'cjeu' });
	});

	it('keeps the Hof van Justitie EU a tier while the data holds none of its own judgments', () => {
		const before = {
			...(coverage as object),
			courts: [{ source: 'rechtspraak', count: 998280 }]
		} as never;
		const hof = facetGroups('judgments', '', { facets }, before)
			.flatMap((g) => (g.kind === 'list' ? g.options : []))
			.find((o) => o.id === 'hvj_eu');
		expect(hof?.count).toBe(2410);
	});
});

describe('a list as a feed', () => {
	it('names the filters of the votes in the words of the feed', () => {
		expect(
			LISTS.decisions.follow?.(params('kamer=EK&dossier=36600&q=huur&van=2026-01-01'))
		).toEqual({
			kind: 'stemming',
			chamber: 'EK',
			since: '2026-01-01',
			until: undefined,
			q: ['huur'],
			dossier: '36600'
		});
	});

	it('offers no Volg where a filter has no word in the feed', () => {
		expect(LISTS.decisions.follow?.(params('passed=false'))).toBeNull();
		expect(LISTS.commitments.follow?.(params('overdue=1'))).toBeNull();
		expect(LISTS.commitments.follow?.(params(''))).toMatchObject({ kind: 'toezegging' });
	});

	it('says how many votes passed from the counts it has, unless passing is the filter', () => {
		const ctx = (address: string, passed: { value: boolean; count: number }[] | undefined) =>
			({
				p: params(address),
				state: { facets: passed ? { passed } : null }
			}) as never;
		const counts = [
			{ value: true, count: 12 },
			{ value: false, count: 43 }
		];
		expect(LISTS.decisions.summary?.(ctx('', counts))).toBe('12 aangenomen');
		expect(LISTS.decisions.summary?.(ctx('passed=true', counts))).toBeNull();
		expect(LISTS.decisions.summary?.(ctx('', undefined))).toBeNull();
	});
});
