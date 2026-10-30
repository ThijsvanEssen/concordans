import { afterEach, describe, expect, it, vi } from 'vitest';
import { fail, fakeApi } from '$lib/test/fakeApi';
import { getExplanations } from '$lib/api/records';
import {
	focusIn,
	focusOfPad,
	isExplorePath,
	padHref,
	padOfFocus,
	parsePad,
	remember,
	exploreHref,
	type Pad
} from './address';
import { ecliKey } from '$lib/text/ecli';
import { focusUitPagina, lookUp } from './leesbaar';
import { keepPaths } from './kept-paths';

describe('a readable address', () => {
	it('reads the official identifier from the path', () => {
		expect(parsePad('/uitspraken/ECLI:NL:HR:2019:2006')).toEqual({
			soort: 'uitspraak',
			ecli: 'ECLI:NL:HR:2019:2006'
		});
		expect(parsePad('/wetten/BWBR0005289/artikel/6:162')).toEqual({
			soort: 'artikel',
			wet: 'BWBR0005289',
			nummer: '6:162'
		});
		expect(parsePad('/dossiers/36600-VIII')).toEqual({ soort: 'dossier', nummer: '36600-VIII' });
		expect(parsePad('/kamerstukken/36799/31')).toEqual({
			soort: 'kamerstuk',
			dossier: '36799',
			nummer: '31'
		});
	});

	it('opens an EU act by its CELEX number in the Verkenner, on its node', () => {
		expect(parsePad('/wetten/32022L2555')).toEqual({ soort: 'wet', wet: '32022L2555' });
		expect(isExplorePath('/wetten/32022L2555')).toBe(true);
		expect(focusIn(new URL('https://concordans.nl/wetten/32022L2555'))).toBe(
			'instruments/32022l2555'
		);
		expect(padOfFocus('instruments/32022l2555')).toBe('/wetten/32022L2555');
		// A bijlage is of a BWB law only.
		expect(parsePad('/wetten/32022L2555/bijlage/I')).toBeNull();
	});

	it('reads a cabinet, a fractie, a commissie and a toezegging, and gives them back', () => {
		expect(parsePad('/kabinetten/rutte_iv')).toEqual({ soort: 'kabinet', key: 'rutte_iv' });
		expect(parsePad('/ministeries/jenv')).toEqual({ soort: 'ministry', key: 'jenv' });
		expect(focusOfPad({ soort: 'ministry', key: 'jenv' })).toBe('ministries/jenv');
		expect(padOfFocus('ministries/jenv')).toBe('/ministeries/jenv');
		expect(parsePad('/fracties/ek_democraten_1966')).toEqual({
			soort: 'fractie',
			key: 'ek_democraten_1966'
		});
		expect(parsePad('/commissies/buhaos-2021')).toEqual({
			soort: 'commissie',
			slug: 'buhaos-2021'
		});
		expect(parsePad('/toezeggingen/tz202609-124')).toEqual({
			soort: 'toezegging',
			nummer: 'TZ202609-124'
		});
		expect(parsePad('/kabinetten/Rutte IV')).toBeNull();
		expect(parsePad('/toezeggingen/124')).toBeNull();
		expect(focusOfPad({ soort: 'kabinet', key: 'jetten' })).toBe('cabinets/jetten');
		expect(focusOfPad({ soort: 'fractie', key: 'd66' })).toBe('factions/d66');
		expect(focusOfPad({ soort: 'commissie', slug: 'szw' })).toBeNull();
		expect(padOfFocus('cabinets/rutte_iv')).toBe('/kabinetten/rutte_iv');
		expect(padOfFocus('factions/d66')).toBe('/fracties/d66');
		expect(padOfFocus('committees/b18e', '/commissies/szw')).toBe('/commissies/szw');
		expect(padOfFocus('committees/b18e')).toBeNull();
		expect(padOfFocus('commitments/6149', '/toezeggingen/tz202609-124')).toBe(
			'/toezeggingen/TZ202609-124'
		);
		// A stemming by its key (Back-end #2, SEO PR 2): /stemmingen/<key>.
		expect(padOfFocus('decisions/decision_6312')).toBe('/stemmingen/decision_6312');
		expect(parsePad('/stemmingen/decision_6312')).toEqual({
			soort: 'stemming',
			key: 'decision_6312'
		});
		expect(focusOfPad({ soort: 'stemming', key: 'decision_6312' })).toBe('decisions/decision_6312');
		// A dossier is named by its number; its node key is the API's, with the path it gives.
		expect(padOfFocus('dossiers/36496')).toBe('/dossiers/36496');
		expect(padOfFocus('dossiers/36600-VIII')).toBe('/dossiers/36600-VIII');
		expect(padOfFocus('dossiers/36600_viii', '/dossiers/36600-VIII')).toBe('/dossiers/36600-VIII');
		expect(padOfFocus('dossiers/36600_viii')).toBeNull();
	});

	it('reads a lid by its slug, and gives a lid its address from its slug', () => {
		expect(parsePad('/leden/rob-jetten')).toEqual({ soort: 'lid', slug: 'rob-jetten' });
		expect(parsePad('/leden/Rob Jetten')).toBeNull();
		expect(padOfFocus('members/49be', '/leden/rob-jetten')).toBe('/leden/rob-jetten');
		expect(padOfFocus('members/49be')).toBeNull();
	});

	it('reads a publication by series, year and number', () => {
		expect(parsePad('/stb/2026/94')).toEqual({
			soort: 'publicatie',
			reeks: 'stb',
			jaar: '2026',
			nummer: '94'
		});
		expect(parsePad('/stb/26/94')).toBeNull();
		// Its key is its id at officielebekendmakingen.nl.
		expect(padOfFocus('instruments/stb_2026_94')).toBe('/stb/2026/94');
		expect(padOfFocus('instruments/stcrt_2025_1234')).toBe('/stcrt/2025/1234');
		expect(padOfFocus('instruments/stb_26_94')).toBeNull();
	});

	it('reads a law by its BWB id, and names it so', () => {
		expect(parsePad('/wetten/BWBR0005537')).toEqual({ soort: 'wet', wet: 'BWBR0005537' });
		expect(parsePad('/wetten/bwbr0005537')).toEqual({ soort: 'wet', wet: 'BWBR0005537' });
		expect(parsePad('/wetten/Awb')).toBeNull();
		expect(padOfFocus('instruments/bwbr0005537')).toBe('/wetten/BWBR0005537');
		expect(focusOfPad({ soort: 'wet', wet: 'BWBR0005537' })).toBe('instruments/bwbr0005537');
	});

	it('reads the letter of a stuk of the Eerste Kamer', () => {
		expect(parsePad('/kamerstukken/36600-VIII/ab')).toEqual({
			soort: 'kamerstuk',
			dossier: '36600-VIII',
			nummer: 'AB'
		});
	});

	it('leaves every other page alone', () => {
		for (const path of [
			'/',
			'/explore',
			'/docs',
			'/uitspraken',
			'/dossiers/abc',
			'/kamerstukken/36799/A1'
		])
			expect(parsePad(path)).toBeNull();
		expect(isExplorePath('/explore')).toBe(true);
		expect(isExplorePath('/dossiers/36799')).toBe(true);
		expect(isExplorePath('/docs')).toBe(false);
	});

	it('writes the path with its colons as they are', () => {
		expect(padHref({ soort: 'artikel', wet: 'BWBR0005537', nummer: '3:4' })).toBe(
			'/wetten/BWBR0005537/artikel/3:4'
		);
	});

	it('names a judgment and a dossier without a request', () => {
		expect(focusOfPad({ soort: 'uitspraak', ecli: 'ECLI:NL:HR:2019:2006' })).toBe(
			'judgments/ecli_nl_hr_2019_2006'
		);
		expect(focusOfPad({ soort: 'dossier', nummer: '36600-VIII' })).toBe('dossiers/36600-VIII');
		expect(focusIn(new URL('http://x/uitspraken/ECLI:NL:HR:2019:2006?lezen=1'))).toBe(
			'judgments/ecli_nl_hr_2019_2006'
		);
		expect(focusIn(new URL('http://x/explore?focus=members/m'))).toBe('members/m');
	});
});

describe('the address of a focus', () => {
	it('takes the path the API gives its node, as it is written', () => {
		expect(padOfFocus('articles/bwbr0005289_162', '/wetten/bwbr0005289/artikel/6:162')).toBe(
			'/wetten/BWBR0005289/artikel/6:162'
		);
		expect(padOfFocus('documents/ek_kst_2', '/kamerstukken/36600-viii/ab')).toBe(
			'/kamerstukken/36600-VIII/AB'
		);
		// No address of its own: none made from its props.
		expect(padOfFocus('articles/bwbr0005289_162')).toBeNull();
		expect(padOfFocus('documents/1501fbca', '/explore')).toBeNull();
		expect(padOfFocus('members/49be')).toBeNull();
	});

	it('keeps the query and moves the focus into the path, the node’s path where given', () => {
		expect(
			exploreHref(new URLSearchParams('focus=members/m&lezen=1'), '', '/leden/rob-jetten')
		).toBe('/leden/rob-jetten?lezen=1');
	});

	it('keeps the query and moves the focus into the path', () => {
		const params = new URLSearchParams('focus=dossiers/36799&lezen=1');
		expect(exploreHref(params, '#stemming')).toBe('/dossiers/36799?lezen=1#stemming');
		expect(exploreHref(new URLSearchParams('focus=members/m'))).toBe('/explore?focus=members/m');
	});

	it('remembers an address it looked up, both ways', () => {
		remember('/kamerstukken/36799/31', 'documents/1501fbca');
		expect(focusOfPad({ soort: 'kamerstuk', dossier: '36799', nummer: '31' })).toBe(
			'documents/1501fbca'
		);
		expect(padOfFocus('documents/1501fbca')).toBe('/kamerstukken/36799/31');
	});

	it('takes the address the API gives beside an id, anywhere in an answer', () => {
		keepPaths({
			node: { id: 'articles/abc123', path: '/wetten/BWBR0005289/artikel/6:162' },
			neighbors: [{ id: 'documents/9f8e', path: '/kamerstukken/36600-VIII/12' }],
			dossier: { id: 'dossiers/k1', path: '/dossiers/36600-VIII' },
			stemming: { id: 'decisions/x1', path: null },
			committees: [
				{ id: 'committees/ek_ocw', key: 'ek_ocw', slug: 'ek-ocw', path: '/commissies/ek-ocw' }
			]
		});
		expect(padOfFocus('committees/ek_ocw')).toBe('/commissies/ek-ocw');
		expect(padOfFocus('articles/abc123')).toBe('/wetten/BWBR0005289/artikel/6:162');
		expect(padOfFocus('documents/9f8e')).toBe('/kamerstukken/36600-VIII/12');
		// A dossier is named by its number; its key is not a focus.
		expect(padOfFocus('dossiers/k1')).toBeNull();
	});

	it('reads the addresses in an answer of a record getter, such as an article’s explanations', async () => {
		fakeApi({
			'/api/articles/{bwb_id}/{article_number}/explanations': {
				explanations: [{ id: 'documents/f80e1', path: '/kamerstukken/36801/3' }]
			}
		});
		await getExplanations('BWBR0005537', '3:80');
		expect(focusOfPad(parsePad('/kamerstukken/36801/3')!)).toBe('documents/f80e1');
	});

	it("takes a feed item's address: Actueel links to the paper, not /explore?focus (#523)", () => {
		keepPaths({
			items: [
				{
					id: 'documents/feed01',
					kind: 'motie',
					node: { collection: 'documents', key: 'feed01' },
					path: '/kamerstukken/37022/13'
				},
				{
					id: 'documents/feed02',
					kind: 'brief',
					node: { collection: 'documents', key: 'feed02' },
					path: null
				}
			]
		});
		expect(padOfFocus('documents/feed01')).toBe('/kamerstukken/37022/13');
		expect(padOfFocus('documents/feed02')).toBeNull();
	});

	it('takes a person’s address beside the key of the lid (UX-toets 0.79.47, #51)', () => {
		keepPaths({
			key: 'kabinet_test',
			path: '/kabinetten/kabinet_test',
			prime_minister: { key: 'lid_pad_0', name: 'Zonder adres', path: null },
			ministries: [
				{ seats: [{ posts: [{ member: { key: 'lid_pad_1', path: '/leden/rob-jetten' } }] }] }
			],
			submitters: [
				{
					name: 'A. Lahlah',
					member_key: 'lid_pad_2',
					role: 'medeindiener',
					path: '/leden/esmah-lahlah'
				}
			]
		});
		expect(padOfFocus('members/lid_pad_1')).toBe('/leden/rob-jetten');
		expect(padOfFocus('members/lid_pad_2')).toBe('/leden/esmah-lahlah');
		expect(padOfFocus('members/lid_pad_0')).toBeNull();
	});

	it('links the minister-president by `prime_minister.path` (API 0.79.48, #580)', () => {
		keepPaths({
			key: 'kabinet_pm',
			path: '/kabinetten/kabinet_pm',
			prime_minister: { key: 'lid_pm_1', name: 'Met adres', path: '/leden/met-adres' },
			ministries: []
		});
		expect(padOfFocus('members/lid_pm_1')).toBe('/leden/met-adres');
	});
});

describe('the key of a judgment', () => {
	it('is its ECLI as the API makes it, a dot and a space too', () => {
		expect(ecliKey('ECLI:NL:HR:2019:2006')).toBe('ecli_nl_hr_2019_2006');
		expect(ecliKey(' ECLI:BE:CASS:2019:ARR.20190101.1 ')).toBe('ecli_be_cass_2019_arr_20190101_1');
	});
});

describe('lookUp', () => {
	const artikel = { soort: 'artikel', wet: 'BWBR0005537', nummer: '3:4' } as const;
	const vooraf = {
		'/api/articles/{bwb_id}/{article_number}': { article: {} },
		'/api/articles/{bwb_id}/{article_number}/history': { versions: [] },
		'/api/instruments/{bwb_id}/articles': { items: [] },
		'/api/articles/{bwb_id}/{article_number}/explained-by': { items: [] }
	} as const;

	it('asks an article’s text and what its reader shows beside the lookup', async () => {
		const fake = fakeApi({ ...vooraf, '/api/lookup': fail(404) });
		expect(await lookUp(artikel)).toBeNull();
		expect(fake.requests.map((r) => r.path).sort()).toEqual(
			[...Object.keys(vooraf), '/api/lookup'].sort()
		);
	});

	it('throws another failure than a 404, whatever the requests beside it do', async () => {
		fakeApi({
			'/api/articles/{bwb_id}/{article_number}': fail(500),
			'/api/articles/{bwb_id}/{article_number}/history': fail(500),
			'/api/instruments/{bwb_id}/articles': fail(500),
			'/api/articles/{bwb_id}/{article_number}/explained-by': fail(500),
			'/api/lookup': fail(500)
		});
		await expect(lookUp(artikel)).rejects.toBeDefined();
	});

	it('asks the stukken of the dossier of the text in force only where the data holds it', async () => {
		const versie = (number: string, exists: boolean) => ({
			versions: [
				{
					key: `v-${number}`,
					valid_from: '1997-04-01',
					valid_until: null,
					current: true,
					text_changed: true,
					amended_by: { dossiers: [{ number, key: number, exists }] }
				}
			]
		});
		const fake = fakeApi({
			...vooraf,
			'/api/articles/{bwb_id}/{article_number}/history': (req) =>
				String(req.params.path?.article_number).endsWith('611')
					? versie('23438', false)
					: versie('34372', true),
			'/api/dossiers/{number}/documents': { items: [] },
			'/api/lookup': fail(404)
		});
		await lookUp({ soort: 'artikel', wet: 'BWBR0005290', nummer: '7:611' });
		await lookUp({ soort: 'artikel', wet: 'BWBR0005290', nummer: '7:612' });
		await vi.waitFor(() =>
			expect(fake.asked('/api/dossiers/{number}/documents')).toEqual([
				{ path: { number: '34372' }, query: { limit: 200 } }
			])
		);
	});

	it('asks a Kamerstuk’s text as soon as the lookup names it', async () => {
		const fake = fakeApi({
			'/api/lookup': { collection: 'documents', key: 'kst-36600-vii-147' },
			'/api/documents/{key}': {}
		});
		expect(await lookUp({ soort: 'kamerstuk', dossier: '36600-VII', nummer: '147' })).toBe(
			'documents/kst-36600-vii-147'
		);
		expect(fake.asked('/api/documents/{key}')).toEqual([{ path: { key: 'kst-36600-vii-147' } }]);
	});
});

// The focus the server's page names (<meta name="focus">) is for the address it served,
// once (UX test 0.79.43, #28): after a step in the app the meta still names the first page.
function pagina(served: string, focus: string, nu: string) {
	let meta: { getAttribute: () => string; remove: () => void } | null = {
		getAttribute: () => focus,
		remove: () => (meta = null)
	};
	vi.stubGlobal('document', { querySelector: () => meta });
	vi.stubGlobal('location', { pathname: nu, href: `https://concordans.nl${nu}` });
	vi.stubGlobal('performance', {
		getEntriesByType: () => [{ name: `https://concordans.nl${served}` }]
	});
}

describe('focusUitPagina', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('gives the focus for the address the page was served for', async () => {
		pagina('/leden/rob-jetten', 'members/49be3576', '/leden/rob-jetten');
		expect(focusUitPagina({ soort: 'lid', slug: 'rob-jetten' })).toBe('members/49be3576');
	});

	it('gives nothing after a step in the app to another address', async () => {
		pagina(
			'/uitspraken/ECLI:NL:HR:2019:2006',
			'judgments/ecli_nl_hr_2019_2006',
			'/kamerstukken/36600-VII/147'
		);
		expect(focusUitPagina({ soort: 'kamerstuk', dossier: '36600-VII', nummer: '147' })).toBeNull();
		// Nothing wrong is remembered for the Kamerstuk's address either.
		expect(padOfFocus('judgments/ecli_nl_hr_2019_2006')).not.toBe('/kamerstukken/36600-VII/147');
	});

	it('gives the focus once: back on the first address later, the lookup speaks', async () => {
		pagina('/leden/rob-jetten', 'members/49be3576', '/leden/rob-jetten');
		expect(focusUitPagina({ soort: 'lid', slug: 'rob-jetten' })).toBe('members/49be3576');
		expect(focusUitPagina({ soort: 'lid', slug: 'rob-jetten' })).toBeNull();
	});
});

describe('every kind of address', () => {
	// One of each, typed so that a new kind of address needs one here.
	const ONE: { [S in Pad['soort']]: Extract<Pad, { soort: S }> } = {
		uitspraak: { soort: 'uitspraak', ecli: 'ECLI:BE:CASS:2020:ARR.20201015.1F.6' },
		artikel: { soort: 'artikel', wet: 'BWBR0005289', nummer: '6:162' },
		wet: { soort: 'wet', wet: '32022L2555' },
		dossier: { soort: 'dossier', nummer: '36455-(R2188)' },
		kamerstuk: { soort: 'kamerstuk', dossier: '36600-VIII', nummer: 'AB' },
		publicatie: { soort: 'publicatie', reeks: 'stcrt', jaar: '2026', nummer: '17140' },
		lid: { soort: 'lid', slug: 'rob-jetten' },
		kabinet: { soort: 'kabinet', key: 'rutte_iv' },
		ministry: { soort: 'ministry', key: 'jenv' },
		fractie: { soort: 'fractie', key: 'ek_democraten_1966' },
		commissie: { soort: 'commissie', slug: 'buhaos-2021' },
		toezegging: { soort: 'toezegging', nummer: 'TZ202609-124' },
		stemming: { soort: 'stemming', key: 'decision_154df5db_64e5_414a_9cd1_3967aab7de58' },
		zaak: { soort: 'zaak', nummer: '2025Z15468' },
		activiteit: { soort: 'activiteit', nummer: '2026A01323' },
		bijlage: { soort: 'bijlage', wet: 'BWBR0002741', label: '2.A' }
	};

	it.each(Object.values(ONE))('reads back the address it writes: %o', (pad) => {
		expect(parsePad(padHref(pad))).toEqual(pad);
	});
});
