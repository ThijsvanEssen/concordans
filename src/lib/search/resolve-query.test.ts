import { describe, expect, it, vi } from 'vitest';
import { parseCitation, resolveQuery, type ResolveDeps } from './resolve-query';

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
		['BWBR0001854', { kind: 'bwb', id: 'BWBR0001854' }],
		['32004L0017', { kind: 'celex', id: '32004L0017' }]
	])('%s', (query, expected) => {
		expect(parseCitation(query)).toEqual(expected);
	});

	it.each(['nieuw wetboek van strafvordering', 'artikel 287', 'doodslag', '2024', ''])(
		'searches "%s" as words',
		(query) => expect(parseCitation(query)).toBeNull()
	);
});

describe('resolveQuery', () => {
	const deps = (over: Partial<ResolveDeps> = {}): ResolveDeps => ({
		resolve: vi.fn(async () => null),
		lawId: vi.fn(async () => 'BWBR0001854'),
		articleKey: vi.fn(async (bwb, n) => `${bwb.toLowerCase()}_${n.replace(':', '_')}`),
		documentKey: vi.fn(async () => 'a572870e'),
		exists: vi.fn(async () => true),
		...over
	});

	it('resolves a BW article through the boek, without asking for the law', async () => {
		const d = deps();
		expect(await resolveQuery('art. 6:162 BW', d)).toEqual({
			ref: { collection: 'articles', key: 'bwbr0005289_162' },
			at: null
		});
		expect(d.lawId).not.toHaveBeenCalled();
	});

	it('carries the lid of a cited article', async () => {
		expect(await resolveQuery('artikel 287, tweede lid, Sr', deps())).toEqual({
			ref: { collection: 'articles', key: 'bwbr0001854_287' },
			at: 'lid-2'
		});
	});

	it('builds the node key of a judgment, a dossier and a law', async () => {
		expect((await resolveQuery('ECLI:NL:HR:2024:1769', deps()))?.ref.key).toBe(
			'ecli_nl_hr_2024_1769'
		);
		expect((await resolveQuery('29684-I', deps()))?.ref.key).toBe('29684_i');
		expect((await resolveQuery('BWBR0001854', deps()))?.ref).toEqual({
			collection: 'instruments',
			key: 'bwbr0001854'
		});
	});

	it('opens the document of a dossier, and the dossier when it has no such document', async () => {
		expect((await resolveQuery('36327-3', deps()))?.ref.collection).toBe('documents');
		const none = deps({ documentKey: async () => null });
		expect((await resolveQuery('36327-999', none))?.ref).toEqual({
			collection: 'dossiers',
			key: '36327'
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
		expect(d.articleKey).not.toHaveBeenCalled();
	});

	it('gives nothing when the API does not know the target', async () => {
		expect(await resolveQuery('ECLI:NL:HR:2099:1', deps({ exists: async () => false }))).toBeNull();
		expect(
			await resolveQuery('artikel 9999 Sr', deps({ articleKey: async () => null }))
		).toBeNull();
		expect(await resolveQuery('doodslag', deps())).toBeNull();
	});
});
