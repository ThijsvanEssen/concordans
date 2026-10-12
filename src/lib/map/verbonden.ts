// The regulations an item of a map opens with, under its text (Thijs, 12 Oct: "verbonden
// regelingen?"): for an article the regulations whose Gelet op names it (`.../delegated`,
// as Verbonden's group Gebaseerd op dit artikel), for a law the laws its articles and theirs
// refer to (`related-instruments`, as Verbonden's Wetten die met deze wet verbonden zijn),
// each by its name, its kind and the day it took effect. Asked when the item opens, once.
import { api, unwrap } from '$lib/api/client';
import { getDelegated } from '$lib/api/articles';
import { getInstrumentDetail } from '$lib/api/instrument-cache';
import { kindName } from '$lib/components/explore/law-head';
import { describe } from '$lib/verbonden/rows';
import type { MapItem } from './map';

/** A regulation as the item lists it: its name, kind and date where known, its address. */
export type Regeling = {
	id: string;
	/** The id the API answers its detail for: a BWB id, a CELEX. */
	ident: string | null;
	naam: string;
	soort: string | null;
	datum: string | null;
};

/** How many a law's list shows: the closest, by the references between them. */
export const WETTEN = 6;

/** The regulations based on an article: those its Gelet op names. Empty where none. */
export async function opArtikel(bwb: string, nummer: string): Promise<Regeling[]> {
	const found = await getDelegated(bwb, nummer);
	// Named as Verbonden names them (regelingRow): the reader's name of the bron.
	return (found?.items ?? []).map(({ instrument: i, kind, date_in_force }) => ({
		id: `instruments/${i.key}`,
		ident: i.bwb_id ?? i.celex ?? null,
		naam: describe('instruments', i.key, i.display_name, {
			bwb_id: i.bwb_id,
			citation_title: i.citation_title,
			title: i.title,
			kind
		}).title,
		soort: kindName(kind),
		datum: date_in_force ?? null
	}));
}

/** The laws most connected to a law, by the references between their articles. */
export async function bijWet(bwb: string): Promise<Regeling[]> {
	const found = await unwrap(
		api.GET('/api/instruments/{bwb_id}/related-instruments', {
			params: { path: { bwb_id: bwb }, query: { limit: WETTEN } }
		})
	);
	return found.items.map((i) => ({
		id: `instruments/${i.key}`,
		ident: i.bwb_id ?? i.celex ?? null,
		naam: describe('instruments', i.key, i.citation_title ?? i.display_name, {
			bwb_id: i.bwb_id,
			celex: i.celex
		}).title,
		soort: null,
		datum: null
	}));
}

/** A regulation's kind and date from its detail, where the list did not give them. */
export async function aangevuld(r: Regeling): Promise<Regeling> {
	if ((r.soort && r.datum) || !r.ident) return r;
	const d = await getInstrumentDetail(r.ident);
	return {
		...r,
		soort: r.soort ?? kindName(d.kind),
		datum: r.datum ?? d.date_in_force ?? d.version_date_in_force ?? null
	};
}

/**
 * The law a group of a map stands for, as its BWB id: the law of its articles, or the law
 * kept whole. Null for a group of a dossier, a judgment or an act of the EU.
 */
export function wetVanGroep(items: readonly Pick<MapItem, 'id'>[]): string | null {
	for (const i of items) {
		const m = /^(?:articles\/(bwbr\d+)_|instruments\/(bwbr\d+)$)/i.exec(i.id);
		if (m) return (m[1] ?? m[2]).toUpperCase();
	}
	return null;
}
