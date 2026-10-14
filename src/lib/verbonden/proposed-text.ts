// The wording a wetsvoorstel proposes for a lid, from the mutations of its dossier:
// the edge from the document to the article carries the status `voorgesteld` and,
// where the pipeline read it, the proposed text in its meta.
// TODO(backend): no field of the API names the proposed text; the keys below are read
// where they occur, and the lid is the one the edge names.
import { textOf } from '$lib/text/words';
import { ifExists } from '$lib/api/errors';
import { abortable } from '$lib/api/records';
import { getDossierMutations } from '$lib/components/parliamentary/data';
import { dossierNumbersOf, type Row } from './rows';
import { readEdge } from './edge-meta';

export type ProposedText = { lid: string | null; text: string; source: string };

const TEXT_KEYS = ['proposed_text', 'new_text', 'text_after', 'text_new', 'replacement'];

const metaText = (meta: Record<string, unknown> | null | undefined): string | null => {
	for (const k of TEXT_KEYS) {
		const t = textOf(meta?.[k]);
		if (t) return t;
	}
	return null;
};

export async function proposedTextOf(
	row: Row,
	articleId: string,
	signal?: AbortSignal
): Promise<ProposedText | null> {
	const own = metaText(row.props);
	if (own) return { lid: row.lid ?? null, text: own, source: row.title };

	const numbers = dossierNumbersOf(row.props);
	for (const number of numbers) {
		// The same request as the dossier's hub (dossier-hub.ts): asked once.
		const mutations = await ifExists(abortable(getDossierMutations(number), signal));
		for (const e of mutations?.edges ?? []) {
			if (e.to_id !== articleId) continue;
			const meta = (e.meta ?? null) as Record<string, unknown> | null;
			const text = metaText(meta);
			if (!text) continue;
			const lid = readEdge(meta, { direction: 'inbound', citingEcli: null }).lid ?? row.lid ?? null;
			return { lid, text, source: row.title };
		}
	}
	return null;
}
