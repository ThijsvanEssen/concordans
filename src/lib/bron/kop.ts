// The node a reader first stands on: built from the bron's cheapest call that gives its head
// and text, not from its node (Thijs, 9 Oct: "alles zo lazy mogelijk"). A person's node took
// 1 to 1.8 s on prod where their record took 0.4 s; a law's 2.2 s against 1 kB; a dossier's
// 1.5 s against 0.1 s. The node, once in, takes its place under the same id.
import type { Schema } from '$lib/api/types';
import { getMember } from '$lib/api/records';
import { getJudgmentDetail } from '$lib/api/judgments';
import { getInstrumentDetail } from '$lib/api/instrument-cache';
import { getDossier } from '$lib/components/parliamentary/data';
import { memberToGraphNode, syntheticNode, type GraphNode } from '$lib/graph/types';
import type { Collection } from '$lib/vocabulary';
import { keyEcli } from './leesbaar';

export const kopVanLid = (m: Schema<'MemberDetailDTO'>): GraphNode =>
	memberToGraphNode(m as unknown as Schema<'MemberDTO'>);

export const kopVanUitspraak = (j: Schema<'JudgmentDTO'>): GraphNode =>
	syntheticNode('judgments', j.key, j.display_name, { ...(j.props ?? {}), ecli: j.ecli });

export const kopVanWet = (d: Schema<'InstrumentDetailDTO'>): GraphNode =>
	syntheticNode('instruments', d.key, d.display_name ?? d.citation_title ?? d.title, { ...d });

/** A dossier's node carries its number as `label`, as its reader and its links read it. */
export const kopVanDossier = (d: Schema<'DossierDetailResponse'>): GraphNode =>
	syntheticNode('dossiers', d.key, d.title ?? d.number, { ...d, label: d.number });

/**
 * The head of a bron, by the name a link uses (a dossier by its number); null for a kind whose
 * node is as cheap as its head (an article, a stuk) or a key that names no head call.
 */
export function kopNode(collection: Collection, key: string): Promise<GraphNode> | null {
	switch (collection) {
		case 'members':
			return getMember(key).then(kopVanLid);
		case 'judgments': {
			const ecli = keyEcli(key);
			return ecli ? getJudgmentDetail(ecli).then((d) => kopVanUitspraak(d.judgment)) : null;
		}
		case 'instruments':
			return getInstrumentDetail(key.toUpperCase()).then(kopVanWet);
		case 'dossiers':
			return getDossier(key).then(kopVanDossier);
		default:
			return null;
	}
}
