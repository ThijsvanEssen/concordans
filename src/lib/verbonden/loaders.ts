// The groups of the panel Verbonden that no edge of the selected bron fills. One
// function per `Loader` of the group table; each returns rows, and a total where
// the API gives one.
import { api, unwrap } from '$lib/api/client';
import type { Schema } from '$lib/api/types';
import { getCommittee, str } from '$lib/components/parliamentary/data';
import type { Collection } from '$lib/vocabulary';
import { loadDossierHub, type DossierHub } from './dossier-hub';
import { explanatoryDocuments } from './explanatory-documents';
import { getArticleDetail } from '$lib/api/articles';
import { buildGroups, type Loader } from './groups';
import { bronKindOf, isInternational } from './filter';
import { instrumentMetaStore } from '$lib/api/instrument-cache';
import { getJudgmentDetail } from '$lib/api/judgments';
import { bucketKey, neighborsOf } from '$lib/api/nodes';
import { lawIdOfArticleKey } from '$lib/util/law-id';
import { get } from 'svelte/store';
import { anchorLabel, anchorOf, parseQualifier } from '$lib/text/qualifier';
import { aardLabel, describe, lidOfMatch, rowOfNeighbor, type Neighbor, type Row } from './rows';

export type LoaderContext = {
	node: Schema<'BaseNodeDTO'>;
	neighbors: Neighbor[];
	/** What the database holds per bucket; see `bucketTotals`. */
	totals: Map<string, number>;
	/** The store's cached node response, so a bron is asked for once. */
	nodeResponse: (collection: Collection, key: string) => Promise<Schema<'NodeGraphResponse'>>;
	signal: AbortSignal;
};

export type Loaded = { rows: Row[]; total?: number };

// The four dossier groups read one hub.
let hub: { key: string; request: Promise<DossierHub> } | null = null;
const hubOf = ({ node, neighbors }: LoaderContext) => {
	if (hub?.key !== node.key)
		hub = { key: node.key, request: loadDossierHub(str(node.props?.label) ?? '', neighbors) };
	return hub.request;
};

const bwbOf = (node: Schema<'BaseNodeDTO'>) =>
	typeof node.props?.bwb_id === 'string' ? node.props.bwb_id : null;

/** The laws of a dossier whose own verbindingen are read for the international group. */
const MAX_LAWS = 3;

/** The laws a member or a fractie has worked on, with the number of their documents. */
async function touched(
	who: 'members' | 'factions',
	key: string,
	signal: AbortSignal
): Promise<Loaded> {
	const found = await unwrap(
		who === 'members'
			? api.GET('/api/members/{key}/touched-instruments', { params: { path: { key } }, signal })
			: api.GET('/api/factions/{key}/touched-instruments', { params: { path: { key } }, signal })
	);
	return {
		rows: found.items.map((i) => ({
			ref: { collection: 'instruments', key: i.key },
			title: i.citation_title ?? i.title ?? i.display_name ?? i.key,
			context: `${i.count} stukken`,
			kind: bronKindOf('instruments', i.key, { bwb_id: i.bwb_id })
		}))
	};
}

export const LOADERS: Record<Loader, (ctx: LoaderContext) => Promise<Loaded>> = {
	'dossier-laws': async (ctx) => ({ rows: (await hubOf(ctx)).laws }),
	'dossier-committees': async (ctx) => ({ rows: (await hubOf(ctx)).committees }),
	'dossier-documents-tk': async (ctx) => ({ rows: (await hubOf(ctx)).tweedeKamer }),
	'dossier-documents-ek': async (ctx) => ({ rows: (await hubOf(ctx)).eersteKamer }),

	// TODO(backend B1, B9): the European and international instruments of a dossier are
	// those of its laws, read from the node of each law.
	'dossier-international': async (ctx) => {
		const { laws } = await hubOf(ctx);
		const responses = await Promise.all(
			laws
				.slice(0, MAX_LAWS)
				.map((law) => ctx.nodeResponse('instruments', law.ref.key).catch(() => null))
		);
		const rows = new Map<string, Row>();
		for (const response of responses) {
			const group = buildGroups('instruments', response ? neighborsOf(response) : []).find(
				(g) => g.id === 'international'
			);
			for (const row of group?.rows ?? []) rows.set(row.ref.key, { ...row, relation: undefined });
		}
		return { rows: [...rows.values()] };
	},

	'article-explanatory': async ({ node, neighbors, signal }) => ({
		rows: await explanatoryDocuments(
			{
				bwbId: bwbOf(node),
				number: typeof node.props?.article_number === 'string' ? node.props.article_number : null
			},
			neighbors,
			signal
		)
	}),

	// The judgments that cite an article, each at the overweging that does (API 0.5,
	// `cited-by`). Before that: the citing judgments from the node, without a position.
	// TODO(backend B8): the fallback goes when every article answers on `cited-by`.
	'article-judgments': async ({ node, neighbors, totals, signal }) => {
		const bwb = bwbOf(node);
		const number =
			typeof node.props?.article_number === 'string' ? node.props.article_number : null;
		if (bwb && number) {
			const { data, response } = await api
				.GET('/api/articles/{bwb_id}/{article_number}/cited-by', {
					params: { path: { bwb_id: bwb, article_number: number }, query: { limit: 200 } },
					signal
				})
				.catch(() => ({ data: undefined, response: null }));
			if (response?.ok && data && data.items.length > 0) {
				const rows = new Map<string, Row>();
				for (const item of data.items) {
					const j = item.judgment;
					if (isInternational({ key: j.key, props: {} })) continue;
					const at =
						item.paragraph_id || (item.paragraph_number ? `rov-${item.paragraph_number}` : null);
					const id = `${j.key}#${at ?? ''}`;
					if (rows.has(id)) continue;
					rows.set(id, {
						ref: { collection: 'judgments', key: j.key },
						...describe('judgments', j.key, j.display_name, { ...j }),
						kind: 'uitspraken',
						at,
						lid: item.leden?.[0] ?? lidOfMatch(item.qualifier ?? item.text),
						position: item.paragraph_number ? `r.o. ${item.paragraph_number}` : null,
						derived: item.confidence < 1,
						confidence: item.confidence,
						snippet: item.snippet || null,
						match: item.text || null,
						relation: 'REFERS_TO',
						direction: 'inbound',
						props: { ...j }
					});
				}
				return { rows: [...rows.values()], total: data.total };
			}
		}
		return {
			total: totals.get(bucketKey('REFERS_TO', 'judgments', 'inbound')),
			rows: neighbors
				.filter(
					(n) =>
						n.relation === 'REFERS_TO' &&
						n.direction === 'inbound' &&
						n.collection === 'judgments' &&
						!isInternational(n)
				)
				.map(rowOfNeighbor)
				.filter((r) => r !== null)
		};
	},

	// The articles that refer to this one, with the lid they name and the aard of the
	// reference, from the article's own detail (`downstream_implications`). Without
	// it: the citing articles from the node, the lid read from the phrase.
	// TODO(backend B6): the aard and the lid belong on the edge of the node response.
	'article-cited-by': async ({ node, neighbors, totals }) => {
		const bwb = bwbOf(node);
		const number =
			typeof node.props?.article_number === 'string' ? node.props.article_number : null;
		const fromNode = neighbors
			.filter(
				(n) =>
					(n.relation === 'REFERS_TO' || n.relation === 'BASED_ON') &&
					n.direction === 'inbound' &&
					n.collection === 'articles'
			)
			.map(rowOfNeighbor)
			.filter((r) => r !== null);
		const total =
			(totals.get(bucketKey('REFERS_TO', 'articles', 'inbound')) ?? 0) +
				(totals.get(bucketKey('BASED_ON', 'articles', 'inbound')) ?? 0) || undefined;
		const detail = bwb && number ? await getArticleDetail(bwb, number).catch(() => null) : null;
		const byKey = new Map(fromNode.map((r) => [r.ref.key, r]));
		for (const rel of detail?.downstream_implications ?? []) {
			const t = rel.target_article;
			const row = byKey.get(t.key) ?? {
				ref: { collection: 'articles' as const, key: t.key },
				title: t.display_name ?? t.key,
				context: null,
				kind: bronKindOf('articles', t.key, { bwb_id: t.bwb_id, celex: t.celex }),
				relation: 'REFERS_TO' as const,
				direction: 'inbound' as const,
				props: { ...t }
			};
			byKey.set(t.key, {
				...row,
				lid: rel.leden?.[0] ?? row.lid ?? lidOfMatch(rel.text),
				aard: aardLabel(rel.semantic_type) ?? row.aard ?? null,
				match: rel.text ?? row.match ?? null,
				edgeId: rel.edge_id ?? row.edgeId ?? null,
				confidence: rel.confidence ?? row.confidence ?? null,
				derived: rel.confidence != null ? rel.confidence < 1 : row.derived
			});
		}
		return { rows: [...byKey.values()], total };
	},

	// The European and international instruments of a law (API 0.5, `eu-links`). Before
	// that, what the node shows: IMPLEMENTS and references to treaties.
	// TODO(backend B9): the fallback goes when every law answers on `eu-links`.
	'instrument-international': async ({ node, neighbors, signal }) => {
		const { data, response } = await api
			.GET('/api/instruments/{identifier}/eu-links', {
				params: { path: { identifier: node.key }, query: { limit: 50 } },
				signal
			})
			.catch(() => ({ data: undefined, response: null }));
		const linked =
			(data?.implements?.length ?? 0) +
			(data?.implemented_by?.length ?? 0) +
			(data?.international?.length ?? 0);
		if (response?.ok && data && linked > 0) {
			const rows = new Map<string, Row>();
			const add = (row: Row) => {
				if (!rows.has(row.ref.key)) rows.set(row.ref.key, row);
			};
			const implemented = data.implements ?? [];
			for (const link of [...implemented, ...(data.implemented_by ?? [])]) {
				const i = link.instrument;
				add({
					ref: { collection: 'instruments', key: i.key },
					title: i.citation_title ?? i.title ?? i.key,
					context: link.basis ?? null,
					kind: 'internationaal',
					derived: link.confidence != null && link.confidence < 1,
					relation: 'IMPLEMENTS',
					direction: implemented.includes(link) ? 'outbound' : 'inbound'
				});
			}
			for (const link of data.international ?? []) {
				if (link.instrument) {
					add({
						ref: { collection: 'instruments', key: link.instrument.key },
						title: link.instrument.citation_title ?? link.instrument.title ?? link.instrument.key,
						context: null,
						kind: 'internationaal',
						derived: link.confidence != null && link.confidence < 1
					});
				} else if (link.judgment) {
					const j = link.judgment;
					add({
						ref: { collection: 'judgments', key: j.key },
						...describe('judgments', j.key, j.display_name, { ...j }),
						kind: 'internationaal',
						derived: link.confidence != null && link.confidence < 1
					});
				}
			}
			return {
				rows: [...rows.values()],
				total:
					(data.implements_total ?? 0) +
					(data.implemented_by_total ?? 0) +
					(data.international_total ?? 0)
			};
		}
		const group = buildGroups('instruments', neighbors).find((g) => g.id === 'international');
		return { rows: group?.rows ?? [] };
	},

	// TODO(backend B7): the lid a judgment cites is not a field. Where the citation
	// pipeline made a stub article `{law}_{article}_{lid}`, the lid is in the key; else it
	// is read from the citation spans of the paragraphs.
	'judgment-articles': async ({ node, neighbors }) => {
		const ecli = typeof node.props?.ecli === 'string' ? node.props.ecli : node.key;
		const detail = await getJudgmentDetail(ecli).catch(() => null);
		const fromSpans = new Map<string, string>();
		for (const p of detail?.judgment.paragraphs ?? []) {
			for (const c of p.citations ?? []) {
				if (c.target.collection !== 'articles' || fromSpans.has(c.target.key) || c.end == null)
					continue;
				const anchor = anchorOf(parseQualifier(c.text ?? '', p.text.slice(c.end, c.end + 80)));
				if (anchor) fromSpans.set(c.target.key, anchor);
			}
		}
		const cited = neighbors.filter(
			(n) => n.relation === 'REFERS_TO' && n.direction === 'outbound' && n.collection === 'articles'
		);
		const names = get(instrumentMetaStore);
		const rows = new Map<string, Row>();
		for (const n of cited) {
			const stub = n.props?.stub ? /^(.+_[0-9]+[a-z]*)_(\d+)$/.exec(n.key) : null;
			const key = stub ? stub[1] : n.key;
			const at = stub ? `lid-${stub[2]}` : fromSpans.get(n.key);
			const row = rowOfNeighbor(n);
			if (!row) continue;
			const real = stub ? cited.find((c) => c.key === key) : n;
			if (stub) {
				const lawId = lawIdOfArticleKey(key);
				const law = lawId && names.get(lawId);
				const number = key.slice(key.indexOf('_') + 1);
				row.ref = { collection: 'articles', key };
				row.title =
					real?.display_name ??
					`Artikel ${number}${law ? ` ${law.citationTitle ?? law.title ?? ''}` : ''}`.trim();
				row.derived = false;
			}
			if (at) {
				row.at = at;
				row.position = anchorLabel(at);
				// rowOfNeighbor only reads the lid for an inbound relation; this one is
				// outbound (judgment → article), so the anchor is the only source of it.
				const lid = /^lid-(\w+)/.exec(at);
				if (lid) row.lid = lid[1];
				if (!stub) row.derived = true;
			}
			const id = `${key}#${at ?? ''}`;
			if (!rows.has(id)) rows.set(id, row);
		}
		return { rows: [...rows.values()] };
	},

	'instrument-dossiers': async ({ node, signal }) => {
		const bwb = bwbOf(node);
		if (!bwb) return { rows: [] };
		const found = await unwrap(
			api.GET('/api/instruments/{bwb_id}/dossiers', { params: { path: { bwb_id: bwb } }, signal })
		);
		return {
			total: found.total,
			rows: found.items.map((d) => ({
				ref: { collection: 'dossiers', key: d.key, number: d.dossier_number ?? '' },
				...describe('dossiers', d.key, d.display_name, {
					title: d.title,
					label: d.dossier_number
				}),
				kind: 'dossiers' as const,
				relation: 'LEGISLATED_IN',
				direction: 'outbound'
			}))
		};
	},

	'instrument-amended-by': async ({ node, signal }) => {
		const bwb = bwbOf(node);
		if (!bwb) return { rows: [] };
		const found = await unwrap(
			api.GET('/api/instruments/{bwb_id}/amended-by', {
				params: { path: { bwb_id: bwb }, query: { limit: 30 } },
				signal
			})
		);
		return {
			total: found.total,
			rows: found.items.map((d) => ({
				ref: { collection: 'documents', key: d.key },
				title: d.display_name ?? d.identifier ?? d.key,
				context: null,
				kind: 'wetsvoorstellen' as const,
				identifier: d.identifier ?? null,
				date: d.first_effective_date ?? null,
				relation: 'AMENDS',
				direction: 'inbound'
			}))
		};
	},

	'member-instruments': ({ node, signal }) => touched('members', node.key, signal),
	'faction-instruments': ({ node, signal }) => touched('factions', node.key, signal),

	'committee-dossiers': async ({ node }) => {
		const slug = typeof node.props?.slug === 'string' ? node.props.slug : null;
		if (!slug) return { rows: [] };
		const committee = await getCommittee(slug);
		return {
			total: committee.active_dossier_count,
			rows: (committee.dossiers ?? []).map((d) => ({
				ref: { collection: 'dossiers', key: d.key, number: d.number },
				...describe('dossiers', d.key, d.title, { title: d.title, label: d.number }),
				kind: 'dossiers' as const
			}))
		};
	}
};
