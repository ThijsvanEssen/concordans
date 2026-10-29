// The kinds of source of the top navigation (besluit 36): what a reader browses by. Each is
// a list of Bladeren (`/explore?mode=index&kind=…`) or, for Actueel, the page of the day. The
// network is no soort but a tool beside the search field (TopBar). One list here: the bar,
// the tab bar of a phone, the breadcrumb of a reader and the sub-tabs of Bladeren read it.
import { parseNodeId, type Collection } from '$lib/vocabulary';
import { isExplorePath } from '$lib/bron/address';
import { indexHref } from '$lib/bron/href';
import { RUBRIEK_LABEL, isMinister, rubriekOf, type Rubriek } from '$lib/bron/rubrieken';

type SourceId = Rubriek;

type Source = {
	id: SourceId;
	label: string;
	/** What it holds, under its name in the sheet of a phone. */
	holds: string;
	/** The lists of Bladeren it holds (`kind` of the address), the first its landing. */
	lists: readonly string[];
	href: string;
};

const source = (id: SourceId, holds: string, lists: readonly string[]): Source => ({
	id,
	label: RUBRIEK_LABEL[id],
	holds,
	lists,
	href: indexHref(lists[0])
});

/** The five rubrieken, in their order and under their names (indeling.ts). */
export const SOURCES: readonly Source[] = [
	source('wetten', 'wetten, regelingen, artikelen', ['instruments']),
	source('rechtspraak', 'rechtbank tot Hoge Raad', ['judgments']),
	source('kamerstukken', 'dossiers, stukken, stemmingen, toezeggingen', [
		'dossiers',
		'documents',
		'decisions',
		'commitments'
	]),
	source('parlement', 'Kamerleden, fracties, commissies, activiteiten', [
		'members',
		'factions',
		'committees'
	]),
	source('regering', 'kabinetten, ministeries, bewindspersonen', [
		'cabinets',
		'ministries',
		'ministers'
	])
];

const sourceById = (id: SourceId): Source => SOURCES.find((s) => s.id === id)!;

/** The source a list of Bladeren belongs to. */
export const sourceOfList = (list: string): Source => SOURCES.find((s) => s.lists.includes(list))!;

/**
 * The source a kind of bron belongs to: its rubriek. A person with a post in a kabinet and no
 * fractie (`props`) stands under Regering, a Kamerlid under Parlement.
 */
export const sourceOfCollection = (
	collection: Collection,
	props?: Record<string, unknown> | null
): Source => sourceById(rubriekOf(collection, '', props));

/** The first segment of a readable address, per source (src/lib/bron/address.ts). */
const SOURCE_OF_PATH: Record<string, SourceId> = {
	wetten: 'wetten',
	stb: 'wetten',
	stcrt: 'wetten',
	trb: 'wetten',
	uitspraken: 'rechtspraak',
	kamerstukken: 'kamerstukken',
	dossiers: 'kamerstukken',
	zaken: 'kamerstukken',
	activiteiten: 'parlement',
	stemmingen: 'kamerstukken',
	leden: 'parlement',
	fracties: 'parlement',
	commissies: 'parlement',
	kabinetten: 'regering',
	ministeries: 'regering',
	toezeggingen: 'kamerstukken'
};

/**
 * The source a page stands under: the list of Bladeren, or the bron read (by its address or its
 * focus). Null on the start page, Actueel, Mijn and a canvas without a bron.
 */
export function sourceOf(url: URL, person?: Record<string, unknown> | null): Source | null {
	if (url.pathname === '/explore') {
		const kind = url.searchParams.get('kind');
		if (url.searchParams.get('mode') === 'index')
			return kind && SOURCES.some((s) => s.lists.includes(kind)) ? sourceOfList(kind) : null;
		const focus = parseNodeId(url.searchParams.get('focus') ?? '');
		return focus ? sourceOfCollection(focus.collection, person) : null;
	}
	if (!isExplorePath(url.pathname)) return null;
	const id = SOURCE_OF_PATH[url.pathname.split('/')[1]];
	return id === 'parlement' && person && isMinister(person)
		? sourceById('regering')
		: id
			? sourceById(id)
			: null;
}
