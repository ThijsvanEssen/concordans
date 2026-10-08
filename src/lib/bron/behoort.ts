// Where a bron stands, for the band "Behoort bij" above every reader: the layers above it
// on its own axis, and the groups beside and below it, in the terms of its source. The rows
// follow docs/hierarchie.md; a layer the data lacks is left out without a word. Thijs, 9 Oct:
// "maak het consistent en klikbaar zodat de hiërarchie gelijk voelt voor de hele website".
import type { NodeGraph, Neighbor } from '$lib/api/nodes';
import { refOf, type BronRef } from '$lib/bron/href';
import { shortDossierTitle } from '$lib/graph/types';
import { deelIds, layersOf } from '$lib/text/division';
import { describe } from '$lib/verbonden/rows';
import type { Collection, Relation } from '$lib/vocabulary';

/**
 * One layer: a bron to open, or (in props) only a name; `vol` the full name where it is cut,
 * `kort` the name a phone's one line carries ("Awb", "Hoofdstuk 3").
 */
export type Laag = {
	soort: string;
	naam: string;
	ref?: BronRef;
	/** The place in the bron the link goes to: a division of a law (`deel-hoofdstuk-3`). */
	at?: string;
	vol?: string;
	kort?: string;
};

/** The bucket a group lists, as the API names it. */
export type Bak = { relation: Relation; direction: 'inbound' | 'outbound'; collection: Collection };

/**
 * A group beside or below: its count where known, its rows when it is opened: the bucket
 * `bak`, or `laad` for a list that is no one bucket (the stukken of a zaak).
 */
export type Groep = {
	id: string;
	label: string;
	aantal: number | null;
	bak?: Bak;
	laad?: (signal?: AbortSignal) => Promise<Laag[]>;
};

export type Behoort = { boven: Laag[]; naast: Groep[]; onder: Groep[] };

const LEEG: Behoort = { boven: [], naast: [], onder: [] };

const KAMER: Record<string, string> = { TK: 'Tweede Kamer', EK: 'Eerste Kamer' };

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** A neighbour as a layer: its kind in the source's word, its name, its ref. */
export function laagVan(n: Neighbor, soort: string): Laag {
	const props = (n.props ?? {}) as Record<string, unknown>;
	const ref = refOf(n.collection as Collection, n.key, props);
	const vol = describe(n.collection, n.key, n.display_name, props).title;
	if (n.collection === 'dossiers') {
		// A dossier by its number and the name of its bill, "36496 Wet betaalbare huur"; its
		// title runs to three lines.
		const nummer = text(props.number) ?? n.key;
		const titel = shortDossierTitle(vol.replace(/^Kamerstukdossier\s+[^:]+:\s*/, ''));
		return { soort, naam: titel && titel !== nummer ? `${nummer} ${titel}` : nummer, ref, vol };
	}
	return { soort, naam: vol, ref };
}

/**
 * The band of a bron from its light node (`limit=1`: every bucket with its total and its
 * first row), which the reader has asked already. A layer above is the first row of a
 * bucket that holds one; a group is a bucket with its total, its rows asked when opened.
 */
export function behoort(
	collection: Collection,
	props: Record<string, unknown>,
	light: NodeGraph | null
): Behoort {
	const buckets = light?.neighbors.buckets ?? [];
	const bak = (relation: Relation, direction: Bak['direction'], coll: Collection) =>
		buckets.find(
			(b) => b.relation === relation && b.direction === direction && b.collection === coll
		);
	/** The first row of a bucket as a layer, where the bucket has rows. */
	const eerste = (
		relation: Relation,
		direction: Bak['direction'],
		coll: Collection,
		soort: string
	) => {
		const b = bak(relation, direction, coll);
		const n = b?.items?.[0];
		return n ? [laagVan(n, soort)] : [];
	};
	/** A group of a bucket that has rows. */
	const groep = (
		id: string,
		label: string,
		relation: Relation,
		direction: Bak['direction'],
		coll: Collection
	): Groep[] => {
		const b = bak(relation, direction, coll);
		return b && b.total > 0
			? [{ id, label, aantal: b.total, bak: { relation, direction, collection: coll } }]
			: [];
	};
	const kamer = (): Laag[] => {
		const k = KAMER[text(props.chamber)?.toUpperCase() ?? ''];
		return k ? [{ soort: 'Kamer', naam: k }] : [];
	};

	switch (collection) {
		case 'articles': {
			// Wet › hoofdstuk › titel › afdeling: the law as a bron, the division by name
			// (in props, `breadcrumb`); a layer that is the law itself is no layer.
			const afk = text(bak('PART_OF', 'outbound', 'instruments')?.items?.[0]?.props?.abbreviation);
			const wet = eerste('PART_OF', 'outbound', 'instruments', 'Wet').map((l) =>
				afk ? { ...l, kort: afk } : l
			);
			const crumbs = Array.isArray(props.breadcrumb)
				? (props.breadcrumb as { type?: string; label?: string; title?: string }[])
				: [];
			const lagen = layersOf(crumbs, text(props.instrument_citation_title));
			// Each division opens in the whole law at its heading (WholeLawReader, `deelIds`).
			const ids = deelIds(crumbs).slice(crumbs.length - lagen.length);
			const deel = lagen
				.map((c, i) => ({
					soort: text(c.type) ?? 'Deel',
					naam: [text(c.label), text(c.title)].filter(Boolean).join(' '),
					kort: text(c.label) ?? undefined,
					ref: wet[0]?.ref,
					at: wet[0]?.ref ? ids[i] : undefined
				}))
				.filter((l) => l.kort);
			return { boven: [...wet, ...deel], naast: [], onder: [] };
		}
		case 'judgments':
			return {
				boven: eerste('APPEAL_OF', 'outbound', 'judgments', 'Eerdere aanleg'),
				naast: [
					...groep('conclusie', 'Conclusie in dezelfde zaak', 'ADVISES_ON', 'inbound', 'judgments'),
					...groep('zaak', 'Uitspraak in dezelfde zaak', 'ADVISES_ON', 'outbound', 'judgments'),
					...groep('ook', 'Ook gepubliceerd als', 'SAME_AS', 'outbound', 'judgments'),
					...groep('samenhang', 'Samenhang met', 'RELATED_TO', 'outbound', 'judgments')
				],
				onder: groep(
					'beroep',
					'Hoger beroep of cassatie tegen deze uitspraak',
					'APPEAL_OF',
					'inbound',
					'judgments'
				)
			};
		case 'documents':
			// A stuk in its dossier; a stenogram in its debat and a bijlage at its brief once
			// the data has them (#351: MADE_IN, ACCOMPANIES).
			return {
				boven: [
					...eerste('PART_OF', 'outbound', 'dossiers', 'Dossier'),
					...eerste('MADE_IN', 'outbound', 'activities', 'Activiteit'),
					...eerste('ACCOMPANIES', 'outbound', 'documents', 'Bijlage bij')
				],
				naast: [],
				onder: groep('bijlagen', 'Bijlagen', 'ACCOMPANIES', 'inbound', 'documents')
			};
		case 'dossiers':
			return {
				boven: kamer(),
				naast: groep(
					'verbonden',
					'Dossiers die de Kamer ermee verbindt',
					'RELATED_TO',
					'inbound',
					'dossiers'
				),
				onder: [
					...groep('zaken', 'Zaken', 'PART_OF', 'inbound', 'cases'),
					...groep('stukken', 'Stukken', 'PART_OF', 'inbound', 'documents'),
					...groep('activiteiten', 'Activiteiten', 'ABOUT', 'inbound', 'activities'),
					...groep('stemmingen', 'Stemmingen', 'ABOUT', 'inbound', 'decisions'),
					...groep('toezeggingen', 'Toezeggingen', 'ABOUT', 'inbound', 'commitments')
				]
			};
		case 'cases':
			return {
				boven: eerste('PART_OF', 'outbound', 'dossiers', 'Dossier'),
				naast: [],
				onder: groep('stukken', 'Stukken', 'PART_OF', 'inbound', 'documents')
			};
		case 'members': {
			// Kamer › fractie › lid. A lid of several fracties over time has them as a group.
			const fracties = bak('MEMBER_OF', 'outbound', 'factions');
			return {
				boven: fracties?.total === 1 ? eerste('MEMBER_OF', 'outbound', 'factions', 'Fractie') : [],
				naast: [
					...(fracties && fracties.total > 1
						? groep('fracties', 'Fracties', 'MEMBER_OF', 'outbound', 'factions')
						: []),
					...groep('commissies', 'Commissies', 'MEMBER_OF', 'outbound', 'committees'),
					...groep('kabinetten', 'Kabinetten', 'SERVED_IN', 'outbound', 'cabinets')
				],
				onder: []
			};
		}
		case 'factions':
			return {
				boven: kamer(),
				naast: [],
				onder: groep('leden', 'Leden', 'MEMBER_OF', 'inbound', 'members')
			};
		case 'committees':
			return {
				boven: kamer(),
				naast: [],
				onder: [
					...groep('leden', 'Leden', 'MEMBER_OF', 'inbound', 'members'),
					...groep('activiteiten', 'Activiteiten', 'LED_BY', 'inbound', 'activities')
				]
			};
		case 'cabinets':
			return {
				boven: [],
				naast: [],
				onder: groep('bewindspersonen', 'Bewindspersonen', 'SERVED_IN', 'inbound', 'members')
			};
		case 'activities':
			return {
				boven: [
					...eerste('LED_BY', 'outbound', 'committees', 'Commissie'),
					...eerste('ABOUT', 'outbound', 'dossiers', 'Dossier')
				],
				naast: [],
				onder: [
					...groep('stukken', 'Stukken bij deze activiteit', 'MADE_IN', 'inbound', 'documents'),
					...groep('toezeggingen', 'Toezeggingen', 'MADE_IN', 'inbound', 'commitments')
				]
			};
		case 'decisions':
			return {
				boven: eerste('ABOUT', 'outbound', 'dossiers', 'Dossier'),
				naast: [],
				onder: groep('fracties', 'Stem per fractie', 'VOTED', 'inbound', 'factions')
			};
		case 'commitments':
			return {
				boven: [
					...eerste('ABOUT', 'outbound', 'dossiers', 'Dossier'),
					...eerste('MADE_IN', 'outbound', 'activities', 'Activiteit')
				],
				naast: [],
				onder: []
			};
		case 'instruments':
			return {
				boven: eerste('LEGISLATED_IN', 'outbound', 'dossiers', 'Dossier'),
				naast: [],
				onder: [
					...groep('artikelen', 'Artikelen', 'PART_OF', 'inbound', 'articles'),
					...groep('versies', 'Versies', 'VERSION_OF', 'inbound', 'instrument_versions')
				]
			};
		default:
			return LEEG;
	}
}

/** Whether a band has anything to show. */
export const heeftIets = (b: Behoort) => b.boven.length + b.naast.length + b.onder.length > 0;

/** The context through which a reader's frame learns which bron its band is for. */
export const BEHOORT_KEY = Symbol('behoort-bij');
