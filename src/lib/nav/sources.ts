// The kinds of source of the top navigation (besluit 36): what a reader browses by. Each is
// a list of Bladeren (`/explore?mode=index&kind=…`) or, for Actueel, the page of the day. The
// network is no soort but a tool beside the search field (TopBar). One list here: the bar,
// the tab bar of a phone, the breadcrumb of a reader and the sub-tabs of Bladeren read it.
import { parseNodeId, type Collection } from '$lib/vocabulary';
import { isExplorePath } from '$lib/bron/address';
import { indexHref } from '$lib/bron/href';

type SourceId = 'wetten' | 'uitspraken' | 'kamerstukken' | 'parlement' | 'regering';

type Source = {
	id: SourceId;
	label: string;
	/** What it holds, under its name in the sheet of a phone. */
	holds: string;
	/** The lists of Bladeren it holds (`kind` of the address), the first its landing. */
	lists: readonly string[];
	href: string;
};

const source = (id: SourceId, label: string, holds: string, lists: readonly string[]): Source => ({
	id,
	label,
	holds,
	lists,
	href: indexHref(lists[0])
});

export const SOURCES: readonly Source[] = [
	source('wetten', 'Wetten', 'wetten, regelingen, artikelen', ['instruments']),
	source('uitspraken', 'Uitspraken', 'rechtbank tot Hoge Raad', ['judgments']),
	source('kamerstukken', 'Kamerstukken', 'dossiers, stukken, stemmingen', [
		'dossiers',
		'documents',
		'decisions'
	]),
	source('parlement', 'Parlement', 'Kamerleden, fracties, commissies', [
		'members',
		'factions',
		'committees'
	]),
	source('regering', 'Regering', 'kabinetten, bewindspersonen, toezeggingen', [
		'cabinets',
		'ministers',
		'commitments'
	])
];

const sourceById = (id: SourceId): Source => SOURCES.find((s) => s.id === id)!;

/** The source a list of Bladeren belongs to. */
export const sourceOfList = (list: string): Source => SOURCES.find((s) => s.lists.includes(list))!;

const SOURCE_OF_COLLECTION: Record<Collection, SourceId> = {
	instruments: 'wetten',
	instrument_versions: 'wetten',
	articles: 'wetten',
	article_versions: 'wetten',
	annexes: 'wetten',
	judgments: 'uitspraken',
	dossiers: 'kamerstukken',
	cases: 'kamerstukken',
	documents: 'kamerstukken',
	activities: 'kamerstukken',
	decisions: 'kamerstukken',
	members: 'parlement',
	factions: 'parlement',
	committees: 'parlement',
	cabinets: 'regering',
	commitments: 'regering'
};

/** The source a kind of bron belongs to. */
export const sourceOfCollection = (collection: Collection): Source =>
	sourceById(SOURCE_OF_COLLECTION[collection]);

/** The first segment of a readable address, per source (src/lib/bron/address.ts). */
const SOURCE_OF_PATH: Record<string, SourceId> = {
	wetten: 'wetten',
	stb: 'wetten',
	stcrt: 'wetten',
	trb: 'wetten',
	uitspraken: 'uitspraken',
	kamerstukken: 'kamerstukken',
	dossiers: 'kamerstukken',
	zaken: 'kamerstukken',
	activiteiten: 'kamerstukken',
	stemmingen: 'kamerstukken',
	leden: 'parlement',
	fracties: 'parlement',
	commissies: 'parlement',
	kabinetten: 'regering',
	toezeggingen: 'regering'
};

/**
 * The source a page stands under: the list of Bladeren, or the bron read (by its address or its
 * focus). Null on the start page, Actueel, Mijn and a canvas without a bron.
 */
export function sourceOf(url: URL): Source | null {
	if (url.pathname === '/explore') {
		const kind = url.searchParams.get('kind');
		if (url.searchParams.get('mode') === 'index')
			return kind && SOURCES.some((s) => s.lists.includes(kind)) ? sourceOfList(kind) : null;
		const focus = parseNodeId(url.searchParams.get('focus') ?? '');
		return focus ? sourceOfCollection(focus.collection) : null;
	}
	if (!isExplorePath(url.pathname)) return null;
	const id = SOURCE_OF_PATH[url.pathname.split('/')[1]];
	return id ? sourceById(id) : null;
}
