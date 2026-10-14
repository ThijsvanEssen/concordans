// The parts of the band "Behoort bij": a layer (a bron in a line), a line of the kern, a
// group below them, and how a neighbour becomes a layer.
import { textOf } from '$lib/text/words';
import { naamVan } from '$lib/bron/menselijk';
import type { Neighbor } from '$lib/api/nodes';
import { refOf, type BronRef } from '$lib/bron/href';
import { dossierLabel, dossierUitProps } from './dossier-naam';
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
	/** The bron itself in a chain ("deze uitspraak"): no link. */
	huidig?: boolean;
	/** How an instance of a procesgang ended: `cassatie verworpen`, `bekrachtigd` (API 0.79.55). */
	uitkomst?: string;
};

/**
 * A line of the kern: a legal term and the bronnen it names, a chain separated by "›".
 * `laad` gives the line in full where it needs more than the light node (the instances
 * before the eerdere aanleg); until it answers the line shows `lagen`.
 */
export type Regel = {
	id: string;
	label: string;
	lagen: Laag[];
	laad?: (signal?: AbortSignal) => Promise<Laag[]>;
	/** Bronnen side by side (the fracties of a lid), not a chain: "; " in place of "›". */
	los?: boolean;
};

/** The bucket a line or group reads, as the API names it. */
export type Bak = { relation: Relation; direction: 'inbound' | 'outbound'; collection: Collection };

export const outbound = (relation: Relation, collection: Collection): Bak => ({
	relation,
	direction: 'outbound',
	collection
});
export const inbound = (relation: Relation, collection: Collection): Bak => ({
	relation,
	direction: 'inbound',
	collection
});

/** A group below the lines: its count where known, the rows of its bucket when it is opened. */
export type Groep = {
	id: string;
	label: string;
	aantal: number | null;
	bak: Bak;
};

export type Behoort = { regels: Regel[]; onder: Groep[] };

/** A line where it names something. */
export const regel = (id: string, label: string, lagen: Laag[]): Regel[] =>
	lagen.length > 0 ? [{ id, label, lagen }] : [];

/**
 * How a judgment ended, as the band names it beside the instance: its `outcome`, after the
 * remedy that brought it there where the edge names one (`cassatie verworpen`). Null while the
 * data says none.
 */
export function uitkomstVan(outcome: unknown, procedure?: unknown): string | null {
	const o = textOf(outcome);
	if (!o) return null;
	const p = textOf(procedure)?.toLowerCase();
	return p ? `${p} ${o}` : o;
}

/**
 * A dossier's number as the Kamer writes it, with its suffix: "36600-VII". The source gives
 * it as `label`; else `number` and `suffix` apart ("36600", "VII"); `number` alone dropped the
 * suffix (UX-toets 10 Oct: "Over 36600 Vaststelling van de begrotingsstaten …" for 36600-VII).
 */
export function dossierNummer(props: Record<string, unknown>): string | null {
	const label = textOf(props.label);
	if (label) return label;
	const nummer = textOf(props.number);
	const suffix = textOf(props.suffix);
	return nummer ? (suffix ? `${nummer}-${suffix}` : nummer) : null;
}

/** A neighbour as a layer: its kind in the source's word, its name, its ref. */
export function laagVan(n: Neighbor, soort: string): Laag {
	const props = (n.props ?? {}) as Record<string, unknown>;
	const ref = refOf(n.collection as Collection, n.key, props);
	const vol = describe(n.collection, n.key, n.display_name, props).title;
	if (n.collection === 'dossiers') {
		// A dossier by its kind, number and the name of its bill, "Kamerstuk 36496 Wet
		// betaalbare huur" (dossier-naam); its title runs to three lines.
		const nummer = dossierNummer(props);
		const d = dossierUitProps({ display_name: n.display_name, ...props }, nummer ?? '');
		const lang = d.title ?? vol;
		if (!nummer) return { soort, naam: naamVan('dossiers', n), ref, vol: lang };
		return { soort, naam: dossierLabel(d), ref, vol: lang };
	}
	if (n.collection === 'judgments') {
		// An appeal against this one names its remedy on the edge (`Cassatie`); an earlier
		// instance's own remedy is on another edge, so it has its outcome alone.
		const uitkomst = uitkomstVan(
			props.outcome,
			n.relation === 'APPEAL_OF' && n.direction === 'inbound' ? n.meta?.procedure_type : null
		);
		return { soort, naam: vol, ref, kort: instantie(vol), ...(uitkomst ? { uitkomst } : {}) };
	}
	return { soort, naam: vol, ref };
}

const GERECHT: [RegExp, string][] = [
	[/^Rechtbank\b/, 'Rb.'],
	[/^Gerechtshof\b/, 'Hof'],
	[/^Hoge Raad\b/, 'HR'],
	[/^Centrale Raad van Beroep\b/, 'CRvB'],
	[/^Raad van State\b/, 'RvS']
];

/**
 * A judgment as a phone's line carries it, the court as lawyers shorten it and the year:
 * "Rechtbank Den Haag, 24 juni 2015 (Urgenda)" is "Rb. Den Haag 2015".
 */
export function instantie(naam: string): string | undefined {
	const gerecht = naam.split(',')[0].trim();
	const jaar = /\b(1[89]|20)\d{2}\b/.exec(naam.slice(gerecht.length))?.[0];
	const kort = GERECHT.reduce((g, [re, k]) => g.replace(re, k), gerecht);
	return kort !== gerecht || jaar ? [kort, jaar].filter(Boolean).join(' ') : undefined;
}
