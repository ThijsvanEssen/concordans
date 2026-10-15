// The reader of each collection, each a chunk of its own: a bron loads its own reader only.
// Asked as soon as the collection is known (the address, the focus), beside the bron's first
// request, so the reader is in when the light node is.
import type { Component } from 'svelte';
import type { GraphNode } from '$lib/graph/types';
import type { Collection } from '$lib/vocabulary';
import type { Pad } from '$lib/bron/address';
import { Lazy } from '$lib/util/lazy.svelte';

type Reader = Component<{ node: GraphNode }>;
const WHAT = 'Verkenner lezer';

/** The article's reader, which takes the place in its law too. */
export const articleReader = new Lazy(() => import('./readers/ArticleReader.svelte'), WHAT);

/** The judgment's and the Kamerstuk's readers, read beside an article too. */
export const judgmentReader = new Lazy(() => import('./readers/JudgmentReader.svelte'), WHAT);
export const documentReader = new Lazy(() => import('./readers/DocumentReader.svelte'), WHAT);

const READERS: Partial<Record<Collection, () => Promise<{ default: Reader }>>> = {
	dossiers: () => import('./readers/DossierReader.svelte'),
	committees: () => import('./readers/CommitteeReader.svelte'),
	members: () => import('./readers/MemberReader.svelte'),
	factions: () => import('./readers/FactionReader.svelte'),
	decisions: () => import('./readers/DecisionReader.svelte'),
	activities: () => import('./readers/ActivityReader.svelte'),
	cabinets: () => import('./readers/CabinetReader.svelte'),
	commitments: () => import('./readers/CommitmentReader.svelte'),
	instruments: () => import('./readers/InstrumentReader.svelte'),
	annexes: () => import('./readers/AnnexReader.svelte')
};
/** A toezegging's zaak and every other bron without text of its own: the plain reader. */
const fallback = () => import('./readers/FallbackReader.svelte');

const loaded = new Map<Collection, Lazy<Reader>>([
	['judgments', judgmentReader],
	['documents', documentReader]
]);

/** The reader of a collection but the article's. */
export function readerOf(collection: Collection): Lazy<Reader> {
	let l = loaded.get(collection);
	if (!l) loaded.set(collection, (l = new Lazy(READERS[collection] ?? fallback, WHAT)));
	return l;
}

/** The reader of a collection asked ahead; a failure is the reader's to say. */
export const preloadReader = (collection: Collection) =>
	(collection === 'articles' ? articleReader : readerOf(collection)).load();

/** The collection a readable address names, where its kind says it without a request. */
const COLLECTION_OF_PAD: Partial<Record<Pad['soort'], Collection>> = {
	uitspraak: 'judgments',
	artikel: 'articles',
	wet: 'instruments',
	bijlage: 'annexes',
	dossier: 'dossiers',
	kamerstuk: 'documents',
	lid: 'members',
	kabinet: 'cabinets',
	fractie: 'factions',
	commissie: 'committees',
	toezegging: 'commitments',
	stemming: 'decisions',
	activiteit: 'activities'
};
export const collectionOfPad = (pad: Pad): Collection | null =>
	COLLECTION_OF_PAD[pad.soort] ?? null;
