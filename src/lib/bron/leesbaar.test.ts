import { describe, expect, it } from 'vitest';
import {
	focusIn,
	focusOfPad,
	isVerkenner,
	onthoudPaden,
	padHref,
	padOfFocus,
	parsePad,
	remember,
	verkennerHref
} from './leesbaar';

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

	it('reads a cabinet, a fractie, a commissie and a toezegging, and gives them back', () => {
		expect(parsePad('/kabinetten/rutte_iv')).toEqual({ soort: 'kabinet', key: 'rutte_iv' });
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
		expect(padOfFocus('committees/b18e', { slug: 'szw' })).toBe('/commissies/szw');
		expect(padOfFocus('committees/b18e')).toBeNull();
		expect(padOfFocus('commitments/6149', { number: 'TZ202609-124' })).toBe(
			'/toezeggingen/TZ202609-124'
		);
		// A stemming by its key (Back-end #2, SEO PR 2): /stemmingen/<key>.
		expect(padOfFocus('decisions/decision_6312')).toBe('/stemmingen/decision_6312');
		expect(parsePad('/stemmingen/decision_6312')).toEqual({
			soort: 'stemming',
			key: 'decision_6312'
		});
		expect(focusOfPad({ soort: 'stemming', key: 'decision_6312' })).toBe('decisions/decision_6312');
		// A dossier's node key is its number made a key; the label gives the number back.
		expect(padOfFocus('dossiers/36496')).toBe('/dossiers/36496');
		expect(padOfFocus('dossiers/36600_viii', { label: '36600-VIII' })).toBe('/dossiers/36600-VIII');
		expect(padOfFocus('dossiers/36455_r2188', { label: '36455-(R2188)' })).toBe(
			'/dossiers/36455-(R2188)'
		);
		expect(padOfFocus('dossiers/36600_viii')).toBeNull();
	});

	it('reads a lid by its slug, and gives a lid its address from its slug', () => {
		expect(parsePad('/leden/rob-jetten')).toEqual({ soort: 'lid', slug: 'rob-jetten' });
		expect(parsePad('/leden/Rob Jetten')).toBeNull();
		expect(padOfFocus('members/49be', { slug: 'rob-jetten' })).toBe('/leden/rob-jetten');
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
		expect(padOfFocus('instruments/stb_2026_94')).toBe('/stb/2026/94');
		expect(padOfFocus('instruments/x', { official_id: 'stcrt-2025-1234' })).toBe(
			'/stcrt/2025/1234'
		);
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
		expect(isVerkenner('/explore')).toBe(true);
		expect(isVerkenner('/dossiers/36799')).toBe(true);
		expect(isVerkenner('/docs')).toBe(false);
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
	it('gives an article its number as cited, a BW article with its book', () => {
		expect(
			padOfFocus('articles/bwbr0005289_162', { bwb_id: 'BWBR0005289', article_number: '162' })
		).toBe('/wetten/BWBR0005289/artikel/6:162');
		expect(
			padOfFocus('articles/32017l1132_27', { celex: '32017L1132', article_number: '27' })
		).toBe('/wetten/32017L1132/artikel/27');
	});

	it('gives a Kamerstuk its number, or the letter of the Eerste Kamer', () => {
		expect(padOfFocus('documents/1501fbca', { dossier_number: '36799', sequence: 31 })).toBe(
			'/kamerstukken/36799/31'
		);
		expect(padOfFocus('documents/ek_kst_1', { dossier_number: '32317', number: 'QK' })).toBe(
			'/kamerstukken/32317/QK'
		);
		expect(
			padOfFocus('documents/ek_kst_2', {
				dossier_number: '36600',
				dossier_suffix: 'VIII',
				number: 'AB'
			})
		).toBe('/kamerstukken/36600-VIII/AB');
		expect(padOfFocus('members/49be')).toBeNull();
	});

	it('keeps the query and moves the focus into the path', () => {
		const params = new URLSearchParams('focus=dossiers/36799&lezen=1');
		expect(verkennerHref(params, '#stemming')).toBe('/dossiers/36799?lezen=1#stemming');
		expect(verkennerHref(new URLSearchParams('focus=members/m'))).toBe('/explore?focus=members/m');
	});

	it('remembers an address it looked up, both ways', () => {
		remember('/kamerstukken/36799/31', 'documents/1501fbca');
		expect(focusOfPad({ soort: 'kamerstuk', dossier: '36799', nummer: '31' })).toBe(
			'documents/1501fbca'
		);
		expect(padOfFocus('documents/1501fbca')).toBe('/kamerstukken/36799/31');
	});

	it('takes the address the API gives beside an id, anywhere in an answer', () => {
		onthoudPaden({
			node: { id: 'articles/abc123', path: '/wetten/BWBR0005289/artikel/6:162' },
			neighbors: [{ id: 'documents/9f8e', path: '/kamerstukken/36600-VIII/12' }],
			dossier: { id: 'dossiers/k1', path: '/dossiers/36600-VIII' },
			stemming: { id: 'decisions/x1', path: null },
			committees: [{ id: 'committees/ek_ocw', key: 'ek_ocw', slug: 'ek-ocw' }]
		});
		expect(padOfFocus('committees/ek_ocw')).toBe('/commissies/ek-ocw');
		expect(padOfFocus('articles/abc123')).toBe('/wetten/BWBR0005289/artikel/6:162');
		expect(padOfFocus('documents/9f8e')).toBe('/kamerstukken/36600-VIII/12');
		// A dossier is named by its number; its key is not a focus.
		expect(padOfFocus('dossiers/k1')).toBeNull();
	});

	it("takes a feed item's address: Actueel links to the paper, not /explore?focus (#523)", () => {
		onthoudPaden({
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
		onthoudPaden({
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
});
