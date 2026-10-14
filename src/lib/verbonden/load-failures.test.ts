// A request of Verbonden that fails is reported and shown: the group stays with "kon niet
// laden" and Opnieuw, a fallback answers only where the API does not have it (404), and a
// partial answer never states a total its rows do not reach. Code-eenvoud F14, F16.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { aborted, fail, fakeApi, type FakeAnswer, type ApiPath } from '$lib/test/fakeApi';
import type { GraphStore } from '$lib/graph/graph-store';
import type { GraphNode } from '$lib/graph/types';
import { createVerbondenSource } from './source';
import { LOADERS, type LoaderContext } from './loaders';
import { loadDossierHub } from './dossier-hub';
import { proposedTextOf } from './proposed-text';
import type { Loader } from './groups';
import type { Neighbor, Row } from './rows';
import { filterGroups } from './view';
import { EMPTY_FILTER } from './filter';

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const warnedAbout = (what: string) =>
	warn.mock.calls.some((args: unknown[]) => String(args[0]).includes(what));

const dossierNode = {
	node: { id: 'dossiers/36000', key: '36000', props: { label: '36000' } },
	neighbors: { total: 0, buckets: [] }
};

const document = {
	key: 'tk_36000_1',
	display_name: 'Kamerstuk 36000, nr. 1',
	chamber: 'TK',
	kind: 'Brief',
	date: '2026-01-01'
};

/** A dossier whose detail names its laws and committees: the hub joins nothing. */
const dossierApi = (documents: FakeAnswer) =>
	fakeApi({
		'/api/nodes/{collection}/{key}': dossierNode,
		'/api/dossiers/{number}': { key: '36000', number: '36000', instruments: [], committees: [] },
		'/api/dossiers/{number}/documents': documents,
		'/api/decisions': { items: [], total: 0, facets: {} }
	});

const loadDossier = () => {
	const source = createVerbondenSource({
		nodeResponse: () => Promise.resolve(dossierNode)
	} as unknown as GraphStore);
	source.load({ id: 'dossiers/36000', collection: 'dossiers', key: '36000' } as GraphNode);
	return source;
};

const settled = (source: ReturnType<typeof loadDossier>) =>
	vi.waitFor(() => {
		const st = get(source);
		expect(st.groups.length).toBeGreaterThan(0);
		expect(st.loading).toBe(false);
	});

const group = (source: ReturnType<typeof loadDossier>, id: string) =>
	get(source).groups.find((g) => g.id === id);

describe('a group whose loader fails', () => {
	it('stays as failed and is reported with its loader', async () => {
		dossierApi(fail(500));
		const source = loadDossier();
		await settled(source);
		expect(group(source, 'documents-tk')?.failed).toBe(true);
		expect(warnedAbout('dossier-documents-tk')).toBe(true);
		source.destroy();
	});

	it('is kept by the panel while no filter cuts rows', () => {
		const failed = { id: 'x', label: 'X', rows: [], capped: false, failed: true };
		expect(filterGroups([failed], EMPTY_FILTER).map((g) => g.id)).toEqual(['x']);
	});

	it('says nothing when the reader leaves', async () => {
		dossierApi(aborted());
		const source = loadDossier();
		source.load(null);
		await new Promise((r) => setTimeout(r, 10));
		expect(warn).not.toHaveBeenCalled();
		source.destroy();
	});
});

describe('the dossier hub', () => {
	it('is asked again after a failure (Opnieuw)', async () => {
		let calls = 0;
		dossierApi(() => (calls++ === 0 ? fail(500) : { items: [document], total: 1 }));
		const source = loadDossier();
		await settled(source);
		expect(group(source, 'documents-tk')?.rows).toEqual([]);
		source.reload();
		await vi.waitFor(() => expect(group(source, 'documents-tk')?.rows).toHaveLength(1));
		expect(group(source, 'documents-tk')?.failed).toBeFalsy();
		source.destroy();
	});

	it('shares the mutations of its dossier with the proposed text', async () => {
		const api = fakeApi({
			'/api/dossiers/{number}': { key: '36000', number: '36000' },
			'/api/dossiers/{number}/documents': { items: [], total: 0 },
			'/api/dossiers/{number}/mutations': { nodes: [], edges: [] },
			'/api/committees': []
		});
		const row = {
			ref: { collection: 'documents', key: 'tk_36000_2' },
			title: 'Voorstel van wet',
			props: { dossier_numbers: ['36000'] }
		} as unknown as Row;
		await Promise.all([
			loadDossierHub('36000', async () => []),
			proposedTextOf(row, 'articles/bwbr0001854_1')
		]);
		expect(api.asked('/api/dossiers/{number}/mutations')).toHaveLength(1);
	});
});

const ctx = (props: Record<string, unknown>, neighbors: Neighbor[] = []): LoaderContext => ({
	node: { id: 'x/y', key: String(props.key ?? 'y'), props } as LoaderContext['node'],
	neighbors,
	totals: new Map(),
	buren: async () => neighbors,
	signal: new AbortController().signal
});

const ARTICLE = { bwb_id: 'BWBR0005537', article_number: '3:4', key: 'bwbr0005537_3_4' };
const LAW = { bwb_id: 'BWBR0005537', key: 'bwbr0005537' };

// A loader with a fallback for an API that lacks the route: the fallback on a 404 only.
const FALLBACKS: [Loader, Record<string, unknown>, ApiPath][] = [
	['article-judgments', ARTICLE, '/api/articles/{bwb_id}/{article_number}/cited-by'],
	['article-changes', ARTICLE, '/api/articles/{bwb_id}/{article_number}/legislative-history'],
	['article-cited-by', ARTICLE, '/api/articles/{bwb_id}/{article_number}'],
	['instrument-international', LAW, '/api/instruments/{identifier}/eu-links'],
	['instrument-judgments', LAW, '/api/instruments/{bwb_id}/judgments'],
	['instrument-articles', LAW, '/api/instruments/{bwb_id}/articles'],
	['committee-activities', { slug: 'justitie', key: 'c1' }, '/api/committees/{slug}/activities'],
	[
		'judgment-articles',
		{ ecli: 'ECLI:NL:HR:2020:1', key: 'ecli_nl_hr_2020_1' },
		'/api/judgments/{ecli}'
	],
	['decision-subject', { key: 'd1' }, '/api/decisions/{key}']
];

describe('a loader with a fallback', () => {
	it.each(FALLBACKS)('%s fails on a 500 of its route', async (loader, props, path) => {
		fakeApi({ [path]: fail(500), '/api/instruments/{bwb_id}/articles': fail(500) });
		await expect(LOADERS[loader](ctx(props))).rejects.toThrow();
	});

	it.each(FALLBACKS)('%s falls back on a 404 of its route', async (loader, props, path) => {
		fakeApi({ [path]: fail(404), '/api/instruments/{bwb_id}/articles': fail(404) });
		await expect(LOADERS[loader](ctx(props))).resolves.toHaveProperty('rows');
	});
});

describe('the references of a law by aard', () => {
	const relationship = (n: number) => ({
		edge_id: `e${n}`,
		source_article: { key: `bwbr0005537_${n}`, bwb_id: 'BWBR0005537', article_number: `${n}` },
		target_article: null,
		semantic_type: 'voorwaarde'
	});

	it('is capped, with no total its rows do not reach, when a further page fails', async () => {
		fakeApi({
			'/api/relationships/search': ({ params }) =>
				params.query?.offset === 0
					? { total: 450, relationships: [relationship(1), relationship(2)] }
					: params.query?.offset === 200
						? fail(500)
						: { total: 450, relationships: [relationship(3)] }
		});
		const loaded = await LOADERS['instrument-aard'](ctx(LAW));
		expect(loaded.capped).toBe(true);
		expect(loaded.total ?? 0).toBeLessThanOrEqual(loaded.rows.length);
		expect(warnedAbout('instrument-aard')).toBe(true);
	});
});
