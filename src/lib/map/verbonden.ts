// The regulations an item of a map opens with, under its text (Thijs, 12 Oct: "verbonden
// regelingen?"): for an article the regulations whose Gelet op names it (`.../delegated`,
// as Verbonden's group Uitgewerkt in), for a law those whose Gelet op names one of
// its articles (`/instruments/{bwb}/delegated`, as Verbonden's Uitvoeringsregelingen), each
// by its name, its kind, the day it took effect and, under a law, the articles it rests on.
// The rows are Verbonden's own (regelingRow, wetRegelingRow): the same names, kinds and
// articles in both places. A law under which nothing is issued lists the laws its articles
// and theirs refer to (`related-instruments`). Asked when the item opens, once.
import { textOf } from '$lib/text/words';
import { getRelatedInstruments } from '$lib/api/verbonden';
import { getDelegated } from '$lib/api/articles';
import { getInstrumentDetail } from '$lib/api/instrument-cache';
import { kindName } from '$lib/text/law-kind';
import { regelingRow, wetRegelingen, wetRijVanRelated } from '$lib/verbonden/loaders';
import type { Row } from '$lib/verbonden/rows';
import { hoeVan } from '$lib/verbonden/hoe';
import type { MapItem } from './map';

/** A regulation as the item lists it: its name, kind and date where known, its address. */
export type Regeling = {
	id: string;
	/** The id the API answers its detail for: a BWB id, a CELEX. */
	ident: string | null;
	naam: string;
	soort: string | null;
	datum: string | null;
	/**
	 * Its grondslag in the words of Verbonden's row (hoe.ts): `AMvB op grond van art. 16 lid 1
	 * en 7` under a law, `AMvB op grond van lid 1 en 7` under an article.
	 */
	artikelen: string | null;
};

/** A list under an opened item: its heading and its regulations. */
export type Regelingen = { titel: string; regelingen: Regeling[] };

/** How many a law's list of connected laws shows: the closest, by the references between them. */
const WETTEN = 6;

/** The line of a row of Verbonden, as one string: `AMvB op grond van art. 16 lid 1 en 7`. */
export function regelVanRij(r: Row, op: 'instruments' | 'articles'): string | null {
	const h = hoeVan(r, op);
	return h ? [h.werkwoord, h.rest].filter(Boolean).join(' ') || null : null;
}

/** A row of Verbonden as a map lists it, under a law or an article. */
const regelingVanRij = (r: Row, op: 'instruments' | 'articles'): Regeling => ({
	id: `instruments/${r.ref.key}`,
	ident: textOf(r.props?.bwb_id) ?? textOf(r.props?.celex),
	naam: r.title,
	soort: r.context,
	datum: r.date ?? null,
	artikelen: regelVanRij(r, op)
});

/** The regulations based on an article: those its Gelet op names. Empty where none. */
export async function opArtikel(bwb: string, nummer: string): Promise<Regelingen> {
	const found = await getDelegated(bwb, nummer);
	return {
		titel: 'Uitgewerkt in',
		regelingen: (found?.items ?? []).map((r) => regelingVanRij(regelingRow(r), 'articles'))
	};
}

/**
 * Under a law: the regulations issued under it; where there are none, the laws most
 * connected to it.
 */
export async function onderWet(bwb: string): Promise<Regelingen> {
	const { rows } = await wetRegelingen(bwb);
	if (rows.length)
		return {
			titel: 'Uitvoeringsregelingen',
			regelingen: rows.map((r) => regelingVanRij(r, 'instruments'))
		};
	return { titel: 'Wetten die met deze wet verbonden zijn', regelingen: await bijWet(bwb) };
}

/**
 * The laws most connected to a law, by the references between their articles, each with the
 * line of its row in Verbonden (`17 artikelen verwijzen naar deze wet`, its grondslag where one
 * is issued under the other; wetRijVanRelated).
 */
async function bijWet(bwb: string): Promise<Regeling[]> {
	const found = await getRelatedInstruments(bwb, WETTEN);
	return found.items.map((i) => ({
		...regelingVanRij(wetRijVanRelated(i, bwb), 'instruments'),
		ident: i.bwb_id ?? i.celex ?? null
	}));
}

/** A regulation's kind and date from its detail, where the list did not give them. */
export async function aangevuld(r: Regeling): Promise<Regeling> {
	// A regulation under the law says its kind in its grondslag (`AMvB op grond van`).
	if (r.datum || !r.ident) return r;
	const d = await getInstrumentDetail(r.ident);
	return {
		...r,
		soort: r.soort ?? kindName(d.kind),
		datum: r.datum ?? d.date_in_force ?? d.version_date_in_force ?? null
	};
}

/**
 * The law a group of a map stands for, as its BWB id, from the group's key. Null for a group
 * of a dossier, a judgment or an act of the EU.
 */
export function wetVanGroep(items: readonly Pick<MapItem, 'groupKey'>[]): string | null {
	const wet = items.map((i) => i.groupKey).find((k) => k.startsWith('wet:bwbr'));
	return wet ? wet.slice('wet:'.length).toUpperCase() : null;
}
