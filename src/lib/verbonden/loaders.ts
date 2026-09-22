// The groups of the panel Verbonden that no edge of the selected bron fills. One
// function per `Loader` of the group table; each returns rows, and a total where
// the API gives one.
import { api, unwrap } from '$lib/api/client';
import type { Schema } from '$lib/api/types';
import { getCommittee } from '$lib/components/parliamentary/data';
import type { Collection } from '$lib/vocabulary';
import { loadDossierHub, type DossierHub } from './dossier-hub';
import { explanatoryDocuments } from './explanatory-documents';
import { buildGroups, type Loader } from './groups';
import { getJudgmentDetail } from '$lib/api/judgments';
import { anchorLabel, anchorOf, parseQualifier } from '$lib/text/qualifier';
import { describe, rowOfNeighbor, type Neighbor, type Row } from './rows';

export type LoaderContext = {
	node: Schema<'BaseNodeDTO'>;
	neighbors: Neighbor[];
	/** The store's cached node response, so a bron is asked for once. */
	nodeResponse: (collection: Collection, key: string) => Promise<Schema<'NodeGraphResponse'>>;
	signal: AbortSignal;
};

export type Loaded = { rows: Row[]; total?: number };

// The four dossier groups read one hub.
let hub: { key: string; request: Promise<DossierHub> } | null = null;
const hubOf = ({ node, neighbors }: LoaderContext) => {
	if (hub?.key !== node.key) hub = { key: node.key, request: loadDossierHub(node.key, neighbors) };
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
			context: String(i.count)
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
			const group = buildGroups('instruments', response?.neighbors.all ?? []).find(
				(g) => g.id === 'international'
			);
			for (const row of group?.rows ?? []) rows.set(row.ref.key, { ...row, relation: undefined });
		}
		return { rows: [...rows.values()] };
	},

	'article-explanatory': async ({ node, neighbors, signal }) => ({
		rows: await explanatoryDocuments({ bwbId: bwbOf(node) }, neighbors, signal)
	}),

	// TODO(backend B7): the lid a judgment cites is not a field. It is read from the
	// citation spans of the paragraphs; the first qualifier found per article counts.
	'judgment-articles': async ({ node, neighbors }) => {
		const ecli = typeof node.props?.ecli === 'string' ? node.props.ecli : node.key;
		const detail = await getJudgmentDetail(ecli).catch(() => null);
		const at = new Map<string, string>();
		for (const p of detail?.judgment.paragraphs ?? []) {
			for (const c of p.citations ?? []) {
				if (c.target.collection !== 'articles' || at.has(c.target.key) || c.end == null) continue;
				const anchor = anchorOf(parseQualifier(c.text ?? '', p.text.slice(c.end, c.end + 80)));
				if (anchor) at.set(c.target.key, anchor);
			}
		}
		const rows = neighbors
			.filter(
				(n) =>
					n.relation === 'REFERS_TO' && n.direction === 'outbound' && n.collection === 'articles'
			)
			.map(rowOfNeighbor)
			.filter((row) => row !== null)
			.map((row) => {
				const anchor = at.get(row.ref.key);
				return anchor ? { ...row, at: anchor, context: anchorLabel(anchor), derived: true } : row;
			});
		return { rows };
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
				ref: { collection: 'dossiers', key: d.key },
				...describe('dossiers', d.key, d.display_name, {
					title: d.title,
					number: d.dossier_number
				}),
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
				context: d.first_effective_date ?? null,
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
				ref: { collection: 'dossiers', key: d.key },
				...describe('dossiers', d.key, d.title, { ...d })
			}))
		};
	}
};
