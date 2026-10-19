// What an opened row asks the API (RijInhoud, Wijzigingen, PostOpen), for `load()`: an
// answer, "niet in de gegevens" where the API does not have it (a 404), or a failure that
// rejects, so it is shown as one and never as an empty row or a 0.
import { ifExists } from '$lib/api/errors';
import { getNodeGraph, neighborsOf, NODE_BUCKET, type Neighbor } from '$lib/api/nodes';
import { getMemberDocuments } from '$lib/api/members';
import { getCommitments } from '$lib/api/commitments';
import { abortable, getAmendedBy, getDocument } from '$lib/api/records';
import type { Schema } from '$lib/api/types';
import { kernSoort, kernVan, type Inhoud, type MetInhoud } from './rij-inhoud';
import { CHANGE_RELATIONS } from '$lib/vocabulary';
import { brengersVan, wijzigingenVan, type Brenger, type WetRegel } from './wijzigingen';

/** The text a row opens on, and what it is (a stuk of kind `kern` says its own). */
type RowText = { text: string | null; as: Inhoud };

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
			limit: NODE_BUCKET,
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
	/** The newest stukken signed, newest first. */
	authored: Neighbor[];
	/** The stukken signed, every one. */
	signed: number;
};

/** How many of each an opened post shows. */
const NEWEST = 3;

export async function postRecord(memberKey: string, signal: AbortSignal): Promise<PostRecord> {
	const [commitments, documents] = await Promise.all([
		getCommitments({ member: memberKey, limit: NEWEST, sort: 'date' }, signal),
		getMemberDocuments(memberKey, NEWEST, signal)
	]);
	return { commitments, authored: documents.items, signed: documents.total };
}
