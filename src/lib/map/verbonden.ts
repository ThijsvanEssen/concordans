// The regulations an item of a map opens with, under its text (Thijs, 12 Oct: "verbonden
// regelingen?"): for an article the regulations whose Gelet op names it (`.../delegated`,
// as Verbonden's group Gebaseerd op dit artikel), for a law those whose Gelet op names one of
// its articles (`/instruments/{bwb}/delegated`, as Verbonden's Gebaseerd op deze wet), each
// by its name, its kind, the day it took effect and, under a law, the articles it rests on.
// The rows are Verbonden's own (regelingRow, wetRegelingRow): the same names, kinds and
// articles in both places. A law under which nothing is issued lists the laws its articles
// and theirs refer to (`related-instruments`). Asked when the item opens, once.
import { api, unwrap } from '$lib/api/client';
import { getDelegated } from '$lib/api/articles';
import { getInstrumentDetail } from '$lib/api/instrument-cache';
import { kindName } from '$lib/components/explore/law-head';
import { regelingRow, wetRegelingen } from '$lib/verbonden/loaders';
import { describe, type Row } from '$lib/verbonden/rows';
import type { MapItem } from './map';

/** A regulation as the item lists it: its name, kind and date where known, its address. */
export type Regeling = {
	id: string;
	/** The id the API answers its detail for: a BWB id, a CELEX. */
	ident: string | null;
	naam: string;
	soort: string | null;
	datum: string | null;
	/** The articles of the law it rests on, `art. 16, 21, 24`: under a law only. */
	artikelen: string | null;
};

/** A list under an opened item: its heading and its regulations. */
export type Regelingen = { titel: string; regelingen: Regeling[] };

/** How many a law's list of connected laws shows: the closest, by the references between them. */
export const WETTEN = 6;

const tekst = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** A row of Verbonden as a map lists it. */
export const regelingVanRij = (r: Row): Regeling => ({
	id: `instruments/${r.ref.key}`,
	ident: tekst(r.props?.bwb_id) ?? tekst(r.props?.celex),
	naam: r.title,
	soort: r.context,
	datum: r.date ?? null,
	artikelen: r.position ?? null
});

/** The regulations based on an article: those its Gelet op names. Empty where none. */
export async function opArtikel(bwb: string, nummer: string): Promise<Regelingen> {
	const found = await getDelegated(bwb, nummer);
	return {
		titel: 'Gebaseerd op dit artikel',
		regelingen: (found?.items ?? []).map((r) => regelingVanRij(regelingRow(r)))
	};
}

/**
 * Under a law: the regulations issued under it; where there are none, the laws most
 * connected to it.
 */
export async function onderWet(bwb: string): Promise<Regelingen> {
	const { rows } = await wetRegelingen(bwb);
	if (rows.length) return { titel: 'Gebaseerd op deze wet', regelingen: rows.map(regelingVanRij) };
	return { titel: 'Verbonden regelingen', regelingen: await bijWet(bwb) };
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
		datum: null,
		artikelen: null
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
