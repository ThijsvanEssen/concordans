// De indeling van Concordans in één tabel: vijf rubrieken (de soorten van het netwerk, de
// bladen van de Topbalk), daaronder de soorten bron. Kleur, vorm, naam en volgorde komen
// overal vandaan: Topbalk, Bladeren, Tonen, Filter Soort, Verbonden, Zoeken en de Keten lezen
// deze tabel (guardtest `rubrieken.test.ts`).
import { isExplanatory } from '$lib/verbonden/document-chamber';
import { BILL_KIND, isAmendingRelation, isInternational } from '$lib/vocabulary';

const RUBRIEK_ROWS = [
	['wetten', 'Wetten'],
	['rechtspraak', 'Rechtspraak'],
	['kamerstukken', 'Kamerstukken'],
	['parlement', 'Parlement'],
	['regering', 'Regering']
] as const;

const RUBRIEKEN = RUBRIEK_ROWS.map((r) => r[0]);
export type Rubriek = (typeof RUBRIEK_ROWS)[number][0];

export const RUBRIEK_LABEL = Object.fromEntries(RUBRIEK_ROWS) as Record<Rubriek, string>;

/** The colour of a rubriek, as a token (`--rubriek-wetten`): lines and areas, never text. */
export const rubriekColour = (rubriek: Rubriek): string => `var(--rubriek-${rubriek})`;

/**
 * The soorten, in the order of the rubrieken: id, rubriek, name as a heading (plural) and one
 * bron of it, for counts of one.
 */
const SORT_ROWS = [
	['wetten', 'wetten', 'Wetten', 'wet'],
	['artikelen', 'wetten', 'Artikelen', 'artikel'],
	['internationaal', 'wetten', 'Europees en internationaal', 'Europese of internationale bron'],
	['publicaties', 'wetten', 'Publicaties', 'publicatie'],
	['uitspraken', 'rechtspraak', 'Uitspraken', 'uitspraak'],
	['dossiers', 'kamerstukken', 'Dossiers', 'dossier'],
	['stukken', 'kamerstukken', 'Stukken', 'stuk'],
	['stemmingen', 'kamerstukken', 'Stemmingen', 'stemming'],
	['activiteiten', 'kamerstukken', 'Activiteiten', 'activiteit'],
	['toezeggingen', 'kamerstukken', 'Toezeggingen', 'toezegging'],
	['kamerzaken', 'kamerstukken', 'Kamerzaken', 'Kamerzaak'],
	['kamerleden', 'parlement', 'Kamerleden', 'kamerlid'],
	['fracties', 'parlement', 'Fracties', 'fractie'],
	['commissies', 'parlement', 'Commissies', 'commissie'],
	['kabinetten', 'regering', 'Kabinetten', 'kabinet'],
	['ministeries', 'regering', 'Ministeries', 'ministerie'],
	['bewindspersonen', 'regering', 'Bewindspersonen', 'bewindspersoon']
] as const satisfies readonly (readonly [string, Rubriek, string, string])[];

export const SORTS = SORT_ROWS.map((r) => r[0]);
export type Sort = (typeof SORT_ROWS)[number][0];

const SORT_INFO = Object.fromEntries(
	SORT_ROWS.map(([id, rubriek, label, one]) => [id, { rubriek, label, one }])
) as Record<Sort, { rubriek: Rubriek; label: string; one: string }>;

export const sortLabel = (sort: Sort): string => SORT_INFO[sort].label;
export const sortOne = (sort: Sort): string => SORT_INFO[sort].one;
export const rubriekOfSort = (sort: Sort): Rubriek => SORT_INFO[sort].rubriek;
export const sortColour = (sort: Sort): string => rubriekColour(SORT_INFO[sort].rubriek);

/**
 * Whether a person is a bewindspersoon rather than a Kamerlid: a post in a cabinet and no seat in
 * a fractie (a Kamerlid who was minister stays a Kamerlid among the leden of their fractie), or
 * the person met on a kabinet (`SERVED_IN`). Without a known role: a Kamerlid. `government_functions`
 * is in the light node, as the canvas asks it (props=canvas).
 */
export function isMinister(
	props: Record<string, unknown> | null | undefined,
	relation?: string | null
): boolean {
	if (relation === 'SERVED_IN') return true;
	const posts = props?.government_functions;
	if (!Array.isArray(posts) || posts.length === 0) return false;
	const seats = props?.faction_memberships;
	return !(Array.isArray(seats) && seats.length > 0) && !props?.party;
}

/** The soort of a bron of a publication: Staatsblad, Staatscourant, Tractatenblad. */
const isPublication = (key: string, props: Record<string, unknown> | null | undefined): boolean =>
	!!props?.publication_kind || /^(stb|stcrt|trb)[_-]/i.test(key);

/**
 * The soort of a bron by its collection, key and props: the one rule Verbonden, Tonen, the filter,
 * the canvas and the legend read. `relation` lets a bron met through a wijziging be a wetsvoorstel
 * (see `stuksoortOf`), a person met on a kabinet a bewindspersoon.
 */
export function sortOf(
	collection: string,
	key: string,
	props: Record<string, unknown> | null | undefined,
	relation?: string | null
): Sort {
	if (isInternational({ key, props: props ?? undefined })) return 'internationaal';
	switch (collection) {
		case 'articles':
		case 'article_versions':
		case 'annexes':
			return 'artikelen';
		case 'instruments':
		case 'instrument_versions':
			if (isPublication(key, props)) return 'publicaties';
			// An act of the EU or a treaty, as the data names it beside its key.
			return props?.celex || /^celex/i.test(key) || /verdrag/i.test(String(props?.kind ?? ''))
				? 'internationaal'
				: 'wetten';
		case 'judgments':
			return 'uitspraken';
		case 'documents':
			return 'stukken';
		case 'decisions':
			return 'stemmingen';
		case 'activities':
			return 'activiteiten';
		case 'commitments':
			return 'toezeggingen';
		case 'cases':
			return 'kamerzaken';
		case 'members':
			return isMinister(props, relation) ? 'bewindspersonen' : 'kamerleden';
		case 'factions':
			return 'fracties';
		case 'committees':
			return 'commissies';
		case 'cabinets':
			return 'kabinetten';
		case 'ministries':
			return 'ministeries';
		default:
			return 'dossiers';
	}
}

/** The soorten in the order of the rubrieken, those of rubriek `own` first. */
export const sortsFrom = (own: Rubriek): Sort[] => {
	const rank = (sort: Sort) =>
		SORT_INFO[sort].rubriek === own ? -1 : RUBRIEKEN.indexOf(SORT_INFO[sort].rubriek);
	return [...SORTS].sort((a, b) => rank(a) - rank(b));
};

export const rubriekOf = (
	collection: string,
	key: string,
	props?: Record<string, unknown> | null,
	relation?: string | null
): Rubriek => SORT_INFO[sortOf(collection, key, props, relation)].rubriek;

// ── Stuksoort: what a stuk is, a facet of the soort Stukken ───────────────────────────────────

const STUKSOORT_ROWS = [
	['wetsvoorstellen', 'Wetsvoorstellen'],
	['toelichtingen', 'Toelichtingen'],
	['overige', 'Overige']
] as const;

export const STUKSOORTEN = STUKSOORT_ROWS.map((r) => r[0]);
export type Stuksoort = (typeof STUKSOORT_ROWS)[number][0];

export const STUKSOORT_LABEL = Object.fromEntries(STUKSOORT_ROWS) as Record<Stuksoort, string>;

/**
 * The stuksoort of a document: a toelichting (`is_explanatory`, or the kind memorie or nota van
 * toelichting), a wetsvoorstel (a change of a law that exists, or the kind of the document), else
 * overige: a motie, a brief, a verslag.
 */
export function stuksoortOf(
	props: Record<string, unknown> | null | undefined,
	relation?: string | null
): Stuksoort {
	const kind = typeof props?.kind === 'string' ? props.kind : null;
	if (isExplanatory({ kind, is_explanatory: props?.is_explanatory as boolean | null | undefined }))
		return 'toelichtingen';
	if (isAmendingRelation(relation) || (kind && BILL_KIND.test(kind))) return 'wetsvoorstellen';
	return 'overige';
}
