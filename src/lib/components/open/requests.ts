// What an opened row asks the API (RijInhoud, Wijzigingen, PostOpen), for `load()`: an
// answer, "niet in de gegevens" where the API does not have it (a 404), or a failure that
// rejects, so it is shown as one and never as an empty row or a 0.
import { api, unwrap } from '$lib/api/client';
import { ifExists } from '$lib/api/errors';
import { getNodeGraph, neighborsOf } from '$lib/api/nodes';
import { abortable, getAmendedBy, getDocument } from '$lib/api/records';
import type { Schema } from '$lib/api/types';
import { kernSoort, kernVan, type Inhoud, type MetInhoud } from './rij-inhoud';
import { CHANGE_RELATIONS } from '$lib/verbonden/hoe';
import { brengersVan, wijzigingenVan, type Brenger, type WetRegel } from './wijzigingen';

/** The text a row opens on, and what it is (a stuk of kind `kern` says its own). */
export type RowText = { text: string | null; as: Inhoud };

export async function rowText(
	item: MetInhoud,
	soort: 'dictum' | 'toelichting' | 'opening' | 'kern',
	signal: AbortSignal
): Promise<RowText> {
	const d = await ifExists(abortable(getDocument(item.node.key), signal));
	const as = soort === 'kern' ? kernSoort(d?.kind) : soort;
	// The API's dictum before the one read from the text; the feed's summary where the stuk
	// has no text in the data yet (the newest papers).
	return { text: (d && kernVan(as, d)) ?? (item.summary?.trim() || null), as };
}

/** A publication's changes per law, or the publication that brought an inwerkingtreding. */
export async function changesOf(
	item: MetInhoud,
	soort: 'wijzigingen' | 'inwerkingtreding',
	signal: AbortSignal
): Promise<WetRegel[] | Brenger[]> {
	if (soort === 'wijzigingen') {
		const g = await getNodeGraph('instruments', item.node.key, {
			limit: 200,
			relations: CHANGE_RELATIONS.join(','),
			direction: 'outbound',
			signal
		});
		return wijzigingenVan(neighborsOf(g), item.publication?.instruments ?? []);
	}
	const wet = item.commencement?.instrument?.key;
	if (!wet) return [];
	const r = await abortable(getAmendedBy(wet.toUpperCase()), signal);
	return brengersVan(r.items, item.date ?? '');
}

/** What an opened post shows: the newest toezeggingen and the stukken the person signed. */
export type PostRecord = {
	commitments: Schema<'CommitmentListResponse'>;
	authored: ReturnType<typeof neighborsOf>;
	/** The stukken signed, counted. */
	signed: number;
};

export async function postRecord(memberKey: string, signal: AbortSignal): Promise<PostRecord> {
	const [commitments, node] = await Promise.all([
		unwrap(
			api.GET('/api/commitments', {
				params: { query: { member: memberKey, limit: 3, sort: 'date' } },
				signal
			})
		),
		unwrap(
			api.GET('/api/nodes/{collection}/{key}', {
				params: {
					path: { collection: 'members', key: memberKey },
					query: { relations: 'AUTHORED', limit: 200 }
				},
				signal
			})
		)
	]);
	const authored = neighborsOf(node);
	return { commitments, authored, signed: authored.length };
}
