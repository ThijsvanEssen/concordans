import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/client';
import { fail, fakeApi } from '$lib/test/fakeApi';
import {
	type ResolveDeps,
	apiDeps,
	bareArticle,
	lawAbbreviation,
	lawTitle,
	parseCitation,
	resolveQuery,
	keuzesOf,
	resolvedOf
} from './resolve-query';
import type { Pad } from '$lib/bron/leesbaar';

describe('parseCitation', () => {
	it.each([
		['ECLI:NL:HR:2024:1769', { kind: 'ecli', ecli: 'ECLI:NL:HR:2024:1769' }],
		['ecli:nl:hr:1987:ac9904', { kind: 'ecli', ecli: 'ECLI:NL:HR:1987:AC9904' }],
		['artikel 287 Sr', { kind: 'article', number: '287', law: 'Sr', book: null, at: null }],
		['art. 6:162 BW', { kind: 'article', number: '162', law: 'BW', book: '6', at: null }],
		['art. 7a:1576 BW', { kind: 'article', number: '1576', law: 'BW', book: '7a', at: null }],
		['art. 3:4 Awb', { kind: 'article', number: '3:4', law: 'Awb', book: null, at: null }],
		[
			'art. 359a lid 1 onder b Sv',
			{ kind: 'article', number: '359a', law: 'Sv', book: null, at: 'lid-1-onder-b' }
		],
		[
			'artikel 416, tweede lid, Wetboek van Strafvordering',
			{ kind: 'article', number: '416', law: 'Wetboek van Strafvordering', book: null, at: 'lid-2' }
		],
		['artikel 1.1.3 Sv', { kind: 'article', number: '1.1.3', law: 'Sv', book: null, at: null }],
		['36327', { kind: 'dossier', number: '36327', document: null }],
		['36327-3', { kind: 'dossier', number: '36327', document: '3' }],
		['Kamerstuk 36327, nr. 3', { kind: 'dossier', number: '36327', document: '3' }],
		['Kamerstukken II 36327', { kind: 'dossier', number: '36327', document: null }],
		['29684-I', { kind: 'dossier', number: '29684-I', document: null }],
		['37020-XV', { kind: 'dossier', number: '37020-XV', document: null }],
		['37020-J', { kind: 'dossier', number: '37020-J', document: null }],
		['Kamerstuk 36327 nr. 3', { kind: 'dossier', number: '36327', document: '3' }],
		['37020-j', { kind: 'dossier', number: '37020-J', document: null }],
		['23908-(R1519)', { kind: 'dossier', number: '23908-(R1519)', document: null }],
		['21501-31', { kind: 'dossier', number: '21501', document: '31' }],
		['37020-XV-3', { kind: 'dossier', number: '37020-XV', document: '3' }],
		['Kamerstuk 36327 nr. A', { kind: 'dossier', number: '36327', document: 'A' }],
		[
			'Kamerstukken II 2025/26, 36799, nr. 31',
			{ kind: 'dossier', number: '36799', document: '31' }
		],
		[
			'Kamerstukken II 2025-2026 36799 nr. 31',
			{ kind: 'dossier', number: '36799', document: '31' }
		],
		['Kamerstukken I 2025/26, 36799, A', { kind: 'dossier', number: '36799', document: 'A' }],
		['Kamerstukken II 2025/26, 36799', { kind: 'dossier', number: '36799', document: null }],
		['BWBR0001854', { kind: 'bwb', id: 'BWBR0001854' }],
		['32004L0017', { kind: 'celex', id: '32004L0017' }],
		['Stb. 2026, 94', { kind: 'publication', series: 'stb', year: '2026', number: '94' }],
		['Staatsblad 2026, 94', { kind: 'publication', series: 'stb', year: '2026', number: '94' }],
		['Trb. 2018, 201', { kind: 'publication', series: 'trb', year: '2018', number: '201' }]
	])('%s', (query, expected) => {
		expect(parseCitation(query)).toEqual(expected);
	});

	it.each(['nieuw wetboek van strafvordering', 'artikel 287', 'doodslag', '2024', ''])(
		'searches "%s" as words',
		(query) => expect(parseCitation(query)).toBeNull()
	);
});

describe('resolveQuery', () => {
	// The data behind /api/lookup: an article by its law and number, a dossier by its number.
	const lookUp = async (pad: Pad): Promise<string | null> => {
		if (pad.soort === 'artikel')
			return `articles/${pad.wet.toLowerCase()}_${pad.nummer.split(':').pop()}`;
		if (pad.soort === 'dossier') return `dossiers/${pad.nummer.toLowerCase().replace('-', '_')}`;
		if (pad.soort === 'kamerstuk') return 'documents/a572870e';
		return null;
	};
	const deps = (over: Partial<ResolveDeps> = {}): ResolveDeps => ({
		resolve: vi.fn(async () => null),
		lawId: vi.fn(async () => 'BWBR0001854'),
		exists: vi.fn(async () => true),
		lookUp: vi.fn(lookUp),
		...over
	});
	/** Only the dossier `number` is in the data. */
	const onlyDossier = (number: string, key: string) => async (pad: Pad) =>
		pad.soort === 'dossier' && pad.nummer === number ? `dossiers/${key}` : null;

	it('resolves a BW article through the boek, without asking for the law', async () => {
		const d = deps();
		expect(await resolveQuery('art. 6:162 BW', d)).toEqual({
			ref: { collection: 'articles', key: 'bwbr0005289_162' },
			at: null
		});
		expect(d.lookUp).toHaveBeenCalledWith({
			soort: 'artikel',
			wet: 'BWBR0005289',
			nummer: '6:162'
		});
		expect(d.lawId).not.toHaveBeenCalled();
	});

	it('carries the lid of a cited article', async () => {
		expect(await resolveQuery('artikel 287, tweede lid, Sr', deps())).toEqual({
			ref: { collection: 'articles', key: 'bwbr0001854_287' },
			at: 'lid-2'
		});
	});

	it('builds the node key of a judgment and a law', async () => {
		expect((await resolveQuery('ECLI:NL:HR:2024:1769', deps()))?.ref.key).toBe(
			'ecli_nl_hr_2024_1769'
		);
		expect((await resolveQuery('BWBR0001854', deps()))?.ref).toEqual({
			collection: 'instruments',
			key: 'bwbr0001854'
		});
	});

	it('looks up a dossier by its number', async () => {
		expect((await resolveQuery('37020-XV', deps()))?.ref).toEqual({
			collection: 'dossiers',
			key: '37020_xv',
			number: '37020-XV'
		});
		expect(await resolveQuery('37020-Q', deps({ lookUp: async () => null }))).toBeNull();
	});

	it('opens a dossier whose suffix is a number before a paper of that number', async () => {
		const d = deps({ lookUp: onlyDossier('21501-31', '21501_31') });
		expect((await resolveQuery('21501-31', d))?.ref).toEqual({
			collection: 'dossiers',
			key: '21501_31',
			number: '21501-31'
		});
	});

	it('opens a Kamerstuk and a publication by lookup, the stuk itself', async () => {
		const d = deps({
			lookUp: vi.fn(async (pad) =>
				pad.soort === 'kamerstuk' ? 'documents/1501fbca' : 'instruments/stb_2026_94'
			)
		});
		expect((await resolveQuery('36799, nr. 31', d))?.ref).toEqual({
			collection: 'documents',
			key: '1501fbca'
		});
		expect(d.lookUp).toHaveBeenCalledWith({ soort: 'kamerstuk', dossier: '36799', nummer: '31' });
		expect((await resolveQuery('Staatsblad 2026, 94', d))?.ref).toEqual({
			collection: 'instruments',
			key: 'stb_2026_94'
		});
		expect(d.resolve).not.toHaveBeenCalled();
	});

	it('finds no publication the data lacks, instead of searching on', async () => {
		expect(await resolveQuery('Stb. 2026, 999', deps())).toBeNull();
	});

	it('opens the stuk a full Kamerstuk citation names, as the API resolves it', async () => {
		const d = deps({
			lookUp: vi.fn(async () => null),
			resolve: vi.fn(async () => ({
				ref: { collection: 'documents' as const, key: '1501fbca' },
				at: null
			}))
		});
		const q = 'Kamerstukken II 2025/26, 36799, nr. 31';
		expect((await resolveQuery(q, d))?.ref).toEqual({ collection: 'documents', key: '1501fbca' });
		expect(d.resolve).toHaveBeenCalledWith(q);
		expect(d.lookUp).not.toHaveBeenCalledWith(expect.objectContaining({ soort: 'dossier' }));
	});

	it('opens the dossier of a paper the data does not have', async () => {
		const d = deps({ lookUp: onlyDossier('36327', '36327') });
		expect((await resolveQuery('36327-999', d))?.ref).toEqual({
			collection: 'dossiers',
			key: '36327',
			number: '36327'
		});
	});

	it('takes what /api/resolve answers before parsing itself', async () => {
		const d = deps({
			resolve: async () => ({
				ref: { collection: 'articles', key: 'bwbr0001854_287' },
				at: 'lid-2'
			})
		});
		expect(await resolveQuery('artikel 287, tweede lid, Sr', d)).toEqual({
			ref: { collection: 'articles', key: 'bwbr0001854_287' },
			at: 'lid-2'
		});
		expect(d.lookUp).not.toHaveBeenCalled();
	});

	it('gives nothing when the API does not know the target', async () => {
		expect(await resolveQuery('ECLI:NL:HR:2099:1', deps({ exists: async () => false }))).toBeNull();
		expect(await resolveQuery('artikel 9999 Sr', deps({ lookUp: async () => null }))).toBeNull();
		expect(await resolveQuery('artikel 9999 Xyz', deps({ lawId: async () => null }))).toBeNull();
		expect(await resolveQuery('doodslag', deps())).toBeNull();
	});

	it('rejects when the API fails, instead of saying the target is not there', async () => {
		const down = async () => {
			throw new ApiError(500, 'Internal Server Error');
		};
		await expect(resolveQuery('art. 6:162 BW', deps({ resolve: down }))).rejects.toBeInstanceOf(
			ApiError
		);
		await expect(resolveQuery('art. 6:162 BW', deps({ lookUp: down }))).rejects.toBeInstanceOf(
			ApiError
		);
		await expect(resolveQuery('artikel 287 Sr', deps({ lawId: down }))).rejects.toBeInstanceOf(
			ApiError
		);
		await expect(resolveQuery('36327-3', deps({ lookUp: down }))).rejects.toBeInstanceOf(ApiError);
		await expect(resolveQuery('Stb. 2026, 94', deps({ lookUp: down }))).rejects.toBeInstanceOf(
			ApiError
		);
		await expect(
			resolveQuery('ECLI:NL:HR:2024:1769', deps({ exists: down }))
		).rejects.toBeInstanceOf(ApiError);
	});
});

describe('bareArticle', () => {
	it('writes out an article cited without "art."', () => {
		expect(bareArticle('55 Gw')).toBe('art. 55 Gw');
		expect(bareArticle('6:162  BW')).toBe('art. 6:162 BW');
		expect(bareArticle('3:4 Awb, tweede lid')).toBe('art. 3:4 Awb, tweede lid');
	});

	it('leaves years, words and full citations alone', () => {
		expect(bareArticle('2024 begroting')).toBeNull();
		expect(bareArticle('fit for 55')).toBeNull();
		expect(bareArticle('55')).toBeNull();
		expect(bareArticle('art. 55 Gw')).toBeNull();
	});
});

describe('lawAbbreviation', () => {
	it('takes one short word with a capital as a possible abbreviation of a law', () => {
		expect(lawAbbreviation('AVG')).toBe('AVG');
		expect(lawAbbreviation(' Awb ')).toBe('Awb');
		expect(lawAbbreviation('stikstof')).toBeNull();
		expect(lawAbbreviation('Wet open overheid')).toBeNull();
	});
});

describe('lawTitle', () => {
	it('knows a regeling by its title', () => {
		for (const q of [
			'Omgevingswet',
			'Handelsregisterwet 2007',
			'Wet op de rechterlijke organisatie',
			'Wetboek van Strafvordering',
			'Besluit bouwwerken leefomgeving'
		])
			expect(lawTitle(q)).toBe(q);
	});

	it('leaves words, a lone "wet" and citations to the search', () => {
		for (const q of ['huurrecht', 'wet', 'ontslag op staande voet', 'art. 3:4 Awb'])
			expect(lawTitle(q)).toBeNull();
	});
});

describe('resolvedOf', () => {
	const answer = (kind: string, collection: string, key: string, display_name: string) =>
		({
			q: 'x',
			kind,
			confidence: 1,
			match: { id: `${collection}/${key}`, key, collection, kind, display_name, confidence: 1 },
			alternatives: [],
			qualifier: null
		}) as unknown as Parameters<typeof resolvedOf>[0];

	it('names an article as it is cited, and no dossier', () => {
		expect(
			resolvedOf(
				answer('article', 'articles', 'bwbr0005289_162', 'Artikel 162 Burgerlijk Wetboek Boek 6')
			)
		).toEqual({
			ref: { collection: 'articles', key: 'bwbr0005289_162' },
			at: null,
			label: 'Artikel 6:162 BW'
		});
		expect(resolvedOf(answer('dossier', 'dossiers', '36799', 'Dossier 36799'))).toBeNull();
		expect(resolvedOf(null)).toBeNull();
	});
});

describe('keuzesOf', () => {
	const art = (book: string, key: string) => ({
		id: `articles/${key}`,
		key,
		collection: 'articles',
		kind: 'article',
		display_name: `Artikel 3 Burgerlijk Wetboek Boek ${book}`,
		confidence: 0.4
	});
	const ambiguous = {
		q: 'artikel 3 bw lid 2',
		kind: 'article',
		confidence: 0.4,
		match: null,
		alternatives: [art('1', 'bwbr0002656_3'), art('3', 'bwbr0005291_3')],
		qualifier: 'tweede lid'
	} as unknown as Parameters<typeof keuzesOf>[0];

	it('lists every article a citation can mean, in order, with its lid', () => {
		expect(keuzesOf(ambiguous)).toEqual({
			items: [
				{
					ref: { collection: 'articles', key: 'bwbr0002656_3' },
					at: 'lid-2',
					label: 'Artikel 1:3 BW'
				},
				{
					ref: { collection: 'articles', key: 'bwbr0005291_3' },
					at: 'lid-2',
					label: 'Artikel 3:3 BW'
				}
			],
			total: 2
		});
	});

	it('counts the ones left out, and gives nothing beside a match', () => {
		expect(keuzesOf({ ...ambiguous!, alternatives_total: 14 } as never).total).toBe(14);
		expect(keuzesOf({ ...ambiguous!, match: art('6', 'bwbr0005289_3') } as never).items).toEqual(
			[]
		);
		expect(keuzesOf(null).items).toEqual([]);
	});
});

describe('a fractie or lid the API resolves (0.79.30)', () => {
	it('opens the fractie for "VVD", not the regulation with that abbreviation', () => {
		const r = resolvedOf({
			q: 'VVD',
			kind: 'faction',
			confidence: 0.9,
			match: {
				id: 'factions/vvd',
				key: 'vvd',
				collection: 'factions',
				kind: 'faction',
				display_name: 'Volkspartij voor Vrijheid en Democratie',
				confidence: 0.9
			},
			alternatives: []
		} as never);
		expect(r?.ref).toEqual({ collection: 'factions', key: 'vvd' });
		expect(r?.label).toBe('Volkspartij voor Vrijheid en Democratie');
	});
});

describe('the API behind resolveQuery', () => {
	const ecli = { collection: 'judgments', key: 'ecli_nl_hr_2099_1' } as const;

	it('says a bron is not there only when the API says so (404)', async () => {
		fakeApi({ '/api/nodes/{collection}/{key}': fail(404) });
		expect(await apiDeps.exists(ecli)).toBe(false);
	});

	it('does not say "niet gevonden" when the API fails', async () => {
		fakeApi({ '/api/nodes/{collection}/{key}': fail(500) });
		await expect(apiDeps.exists(ecli)).rejects.toBeInstanceOf(ApiError);
	});

	it('resolves nothing for a 404, and rejects on a failure', async () => {
		fakeApi({ '/api/resolve': fail(404) });
		expect(await apiDeps.resolve('art. 6:162 BW')).toBeNull();
		fakeApi({ '/api/resolve': fail(500) });
		await expect(apiDeps.resolve('art. 6:162 BW')).rejects.toBeInstanceOf(ApiError);
	});
});
