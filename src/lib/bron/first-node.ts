// The node a reader first stands on: built from the bron's cheapest call that gives its head
// and text, not from its node (Thijs, 9 Oct: "alles zo lazy mogelijk"). A person's node took
// 1 to 1.8 s on prod where their record took 0.4 s; a law's 2.2 s against 1 kB; a dossier's
// 1.5 s against 0.1 s; an article's text came with the lookup, its node up to 1.1 s later.
// The node, once in, takes its place under the same id.
import type { Schema } from '$lib/api/types';
import { getMember } from '$lib/api/records';
import { getJudgmentDetail } from '$lib/api/judgments';
import { getArticleDetailByKey } from '$lib/api/articles';
import { getInstrumentDetail } from '$lib/api/instrument-cache';
import { getDossier } from '$lib/api/dossiers';
import { memberToGraphNode, syntheticNode, type GraphNode } from '$lib/graph/types';
import type { Collection } from '$lib/vocabulary';
import { keyEcli } from './address';

export const headOfMember = (m: Schema<'MemberDetailDTO'>): GraphNode => memberToGraphNode(m);

export const headOfJudgment = (j: Schema<'JudgmentDTO'>): GraphNode =>
	syntheticNode('judgments', j.key, j.display_name, { ...(j.props ?? {}), ecli: j.ecli });

export const headOfLaw = (d: Schema<'InstrumentDetailDTO'>): GraphNode =>
	syntheticNode('instruments', d.key, d.display_name ?? d.citation_title ?? d.title, { ...d });

/** A dossier's node carries its number as `label`, as its reader and its links read it. */
export const headOfDossier = (d: Schema<'DossierDetailResponse'>): GraphNode =>
	syntheticNode('dossiers', d.key, d.title ?? d.number, { ...d, label: d.number });

/** An article from its detail, with the names of its law the light node carries. */
const kopVanArtikel = (d: Schema<'ArticleDetailResponse'>): GraphNode =>
	syntheticNode('articles', d.article.key, d.article.display_name, {
		...d.article,
		instrument_citation_title: d.instrument?.citation_title ?? undefined,
		instrument_abbreviation: d.instrument?.abbreviation ?? undefined
	});

/**
 * The head of a bron, by the name a link uses (a dossier by its number); null for a kind whose
 * node is as cheap as its head (a stuk), an article whose detail was not asked by its address,
 * or a key that names no head call.
 */
export function kopNode(collection: Collection, key: string): Promise<GraphNode> | null {
	switch (collection) {
		case 'members':
			return getMember(key).then(headOfMember);
		case 'judgments': {
			const ecli = keyEcli(key);
			return ecli ? getJudgmentDetail(ecli).then((d) => headOfJudgment(d.judgment)) : null;
		}
		case 'instruments':
			return getInstrumentDetail(key.toUpperCase()).then(headOfLaw);
		case 'dossiers':
			return getDossier(key).then(headOfDossier);
		case 'articles':
			return getArticleDetailByKey(key)?.then(kopVanArtikel) ?? null;
		default:
			return null;
	}
}
