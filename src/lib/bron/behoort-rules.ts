// The band "Behoort bij" per kind of bron, as a table: its kern lines in order, the groups
// below them, and the kern its reader's status line names. An ordinary line is the first
// bron of one bucket under a legal term; a line of its own making says which buckets it
// names, so KERN follows from this table alone. The lines follow docs/hierarchie.md ("Kern
// of context").
import { isCoverLetter, belongsToBill, motionOrAmendment } from '$lib/text/document-kind';
import { textOf } from '$lib/text/words';
import { findBucket, type NodeGraph, type Neighbor } from '$lib/api/nodes';
import { getActivity } from '$lib/api/records';
import { ifExists } from '$lib/api/errors';
import { getDossier } from '$lib/api/dossiers';
import { CHAMBER_NAME, chamberFromParam } from '$lib/components/parliamentary/chamber';
import { refOf } from '$lib/bron/href';
import { dossierLabel } from './dossier-naam';
import { artikelAnker, deelIds, layersOf } from '$lib/text/division';
import { langeDatum } from '$lib/text/datum';
import { kindName } from '$lib/components/explore/law-head';
import { lawShortName } from '$lib/text/bw';
import { fractiePeriodes } from './fractie-periode';
import { kernVanZaak, stukkenInDezelfdeZaak } from './zaak';
import type { Collection } from '$lib/vocabulary';
import { dossierNummer } from './dossier-naam';
import {
	inbound,
	laagVan,
	outbound,
	regel,
	type Bak,
	type Laag,
	type Regel
} from './behoort-layer';
import {
	ADVISED,
	CONCLUSION,
	EARLIER,
	LATER,
	procesgangLine,
	translationLines
} from './behoort-procesgang';

/** What a line is made from: the bron's props and its light node (`limit=1`). */
export type Context = { props: Record<string, unknown>; light: NodeGraph | null };

/** An ordinary line: the first bron of one bucket under a legal term. */
export type BucketLine = {
	id: string;
	label: string | ((first: Neighbor) => string);
	bak: Bak;
	soort: string;
};

/** A line of its own making; `kern` the buckets whose bronnen it names. */
type OwnLine = { kern: Bak[]; lines: (c: Context) => Regel[] };

type Band = {
	lines: (BucketLine | OwnLine)[];
	/** A bucket listed below the lines once it holds `atLeast` bronnen, its rows on opening. */
	groups?: { id: string; label: string; bak: Bak; atLeast: number }[];
	/** Kern the reader's status line names, not the band: Verbonden leaves it out too. */
	statusLine?: Bak[];
};

const TO_LAW = outbound('PART_OF', 'instruments');
const TO_DOSSIER = outbound('PART_OF', 'dossiers');
const TO_CASE = outbound('PART_OF', 'cases');
const ABOUT_DOSSIER = outbound('ABOUT', 'dossiers');
const MEMBER_OF_FACTION = outbound('MEMBER_OF', 'factions');

const firstOf = (c: Context, bak: Bak, soort: string): Laag[] => {
	const n = findBucket(c.light, bak)?.items?.[0];
	return n ? [laagVan(n, soort)] : [];
};

/**
 * The law an article or bijlage belongs to, by the kind its own page names (`AMvB`,
 * `Ministeriële regeling`; `Wet` where its node gives none) and its short name (`Awb`,
 * `Boek 7A BW`); an article also with its divisions, each opening the whole law at its
 * heading (WholeLawReader, `deelIds`), and the law at the article (`#artikel-658`).
 */
function lawLine(c: Context, withPlace: boolean): Regel[] {
	const law = findBucket(c.light, TO_LAW)?.items?.[0]?.props;
	const soort = kindName(textOf(law?.kind)) ?? 'Wet';
	const afk = lawShortName(textOf(law?.bwb_id), textOf(law?.abbreviation));
	const nummer = withPlace ? textOf(c.props.article_number) : null;
	const wet = firstOf(c, TO_LAW, soort).map((l) => ({
		...l,
		...(afk ? { kort: afk } : {}),
		...(nummer ? { at: artikelAnker(nummer) } : {})
	}));
	if (!withPlace) return regel('wet', soort, wet);
	// Wet › hoofdstuk › titel › afdeling: the division by name (in props, `breadcrumb`); a
	// layer that is the law itself is no layer.
	const crumbs = Array.isArray(c.props.breadcrumb)
		? (c.props.breadcrumb as { type?: string; label?: string; title?: string }[])
		: [];
	const lagen = layersOf(crumbs, textOf(c.props.instrument_citation_title));
	const ids = deelIds(crumbs).slice(crumbs.length - lagen.length);
	const deel = lagen
		.map((d, i) => ({
			soort: textOf(d.type) ?? 'Deel',
			naam: [textOf(d.label), textOf(d.title)].filter(Boolean).join(' '),
			kort: textOf(d.label) ?? undefined,
			ref: wet[0]?.ref,
			at: wet[0]?.ref ? ids[i] : undefined
		}))
		.filter((l) => l.kort);
	return regel('wet', soort, [...wet, ...deel]);
}

/**
 * What a stuk's zaak gives its kern (kernVanZaak): a paper that changes or explains a bill
 * belongs with the voorstel van wet (Bij wetsvoorstel); a geleidende brief says nothing
 * without what it offers (Biedt aan), side by side. Found when the zaak's papers come in.
 */
function caseLine(c: Context): Regel | null {
	const key = c.light?.node.key;
	const kind = textOf(c.props.kind) ?? '';
	if (!key || !(findBucket(c.light, TO_CASE)?.total ?? 0)) return null;
	const bill = belongsToBill(kind);
	if (!bill && !isCoverLetter(kind)) return null;
	return {
		id: bill ? 'wetsvoorstel' : 'biedt-aan',
		label: bill ? 'Bij wetsvoorstel' : 'Biedt aan',
		lagen: [],
		...(bill ? {} : { los: true }),
		laad: (signal) =>
			stukkenInDezelfdeZaak({ key }, signal).then(({ rows }) =>
				kernVanZaak(kind, rows).map((r) => ({
					soort: bill ? 'Wetsvoorstel' : (textOf(r.props?.kind) ?? 'Stuk'),
					naam: r.title,
					ref: r.ref
				}))
			)
	};
}

/** "Voorstel van wet, Kamerstuk 34372, nr. 2" as "Voorstel van wet, nr. 2", after its dossier. */
const zonderKamerstuk = (naam: string) => naam.replace(/,\s*Kamerstuk\s+[^,]+,\s*/, ', ');

/**
 * A motie or amendement is ingediend bij its dossier, another stuk is in it. A stuk at a bill
 * stands in one chain with it, "Dossier: 34372 … › Voorstel van wet, nr. 2" (concept 21,
 * Thijs 10 Oct).
 */
function dossierLines(c: Context): Regel[] {
	const label = motionOrAmendment(c.props.kind) ? 'Ingediend bij' : 'Dossier';
	const dossier = firstOf(c, TO_DOSSIER, 'Dossier');
	const zaak = caseLine(c);
	const bill = zaak?.id === 'wetsvoorstel' ? zaak : null;
	if (!dossier.length || !bill)
		return [...regel('dossier', label, dossier), ...(bill ? [bill] : [])];
	return [
		{
			id: 'dossier',
			label,
			lagen: dossier,
			laad: (signal) =>
				bill.laad!(signal).then((ls) => [
					...dossier,
					// After its dossier the bill needs no dossier number of its own.
					...ls.map((l) => ({ ...l, naam: zonderKamerstuk(l.naam) }))
				])
		}
	];
}

/** The line Biedt aan of a geleidende brief. */
const offersLines = (c: Context): Regel[] => {
	const zaak = caseLine(c);
	return zaak?.id === 'biedt-aan' ? [zaak] : [];
};

/** The Kamer in props, else in the bron's label (a dossier node: `TK`), a source value. */
function chamberOf(c: Context): Laag[] {
	const label = c.light?.node.labels?.find((l) => chamberFromParam(l));
	const chamber = chamberFromParam(textOf(c.props.chamber) ?? label);
	return chamber ? [{ soort: 'Kamer', naam: CHAMBER_NAME[chamber] }] : [];
}

/**
 * The Kamers that dealt with a dossier: those of its label, and the Eerste Kamer where its
 * detail holds papers there (`senate.document_count`) or an outcome there (`ek_outcome`).
 */
export function metEersteKamer(
	kamers: Laag[],
	d: { senate?: { document_count?: number | null } | null; ek_outcome?: unknown }
): Laag[] {
	const ek = (d.senate?.document_count ?? 0) > 0 || !!d.ek_outcome;
	if (!ek || kamers.some((k) => k.naam === CHAMBER_NAME.EK)) return kamers;
	return kamers.some((k) => k.naam === CHAMBER_NAME.TK)
		? [{ soort: 'Kamer', naam: `${CHAMBER_NAME.TK} en ${CHAMBER_NAME.EK}` }]
		: [{ soort: 'Kamer', naam: CHAMBER_NAME.EK }];
}

/**
 * The Kamer a dossier is in, and the Eerste Kamer too where the dossier's own detail says so
 * (UX-toets 10 Oct: 36600-VII "Behandeld in: Tweede Kamer" while the Eerste Kamer adopted
 * it). What its bill amends and implements stands in the reader, under the title.
 */
function treatedInLines(c: Context): Regel[] {
	const kamers = chamberOf(c);
	// The dossier to ask: its number, else its key (a lookup, not a name).
	const lookup = c.light?.node.key ?? null;
	const nummer = dossierNummer(c.props) ?? lookup;
	return [
		{
			id: 'kamer',
			label: 'Behandeld in',
			lagen: kamers,
			laad: nummer
				? () => ifExists(getDossier(nummer)).then((d) => (d ? metEersteKamer(kamers, d) : kamers))
				: undefined
		}
	];
}

/**
 * A lid in its fracties, each with its period from the lid's own memberships ("D66, sinds
 * 2023"; "VVD, 2017–2021"), the current one first (Thijs, 9 Oct); the period on a phone too.
 */
function factionLines(c: Context): Regel[] {
	const periodes = fractiePeriodes(c.props.faction_memberships);
	if (!periodes.length)
		return findBucket(c.light, MEMBER_OF_FACTION)?.total === 1
			? regel('fractie', 'Fractie', firstOf(c, MEMBER_OF_FACTION, 'Fractie'))
			: [];
	return [
		{
			id: 'fractie',
			label: periodes.length > 1 ? 'Fracties' : 'Fractie',
			los: true,
			lagen: periodes.map((f) => ({
				soort: 'Fractie',
				naam: `${f.naam}, ${f.periode}`,
				ref: refOf('factions', f.key, {})
			}))
		}
	];
}

/** A dossier on an agenda as a layer, as `laagVan` names one: "Kamerstuk 36764 Cyberbeveiligingswet". */
function dossierLaag(d: {
	number: string;
	short_title?: string | null;
	title?: string | null;
}): Laag {
	return {
		soort: 'Dossier',
		naam: dossierLabel(d),
		ref: { collection: 'dossiers', key: d.number, number: d.number },
		vol: d.title?.trim() || undefined
	};
}

/**
 * Every dossier on an activiteit's agenda side by side, and the activiteit it took the place
 * of, from its own answer (`/api/activities/{key}`, one cheap request); the light node has
 * the first dossier only.
 */
function activityLines(c: Context): Regel[] {
	const over = firstOf(c, ABOUT_DOSSIER, 'Dossier');
	const key = c.light?.node.key;
	if (!key) return [{ id: 'dossier', label: 'Over', lagen: over, los: true }];
	const activity = () => getActivity(key);
	return [
		{
			id: 'dossier',
			label: 'Over',
			lagen: over,
			los: true,
			laad: async () => {
				const ds = (await activity()).dossiers ?? [];
				return ds.length ? ds.map(dossierLaag) : over;
			}
		},
		{
			id: 'verplaatst',
			label: 'Verplaatst van',
			lagen: [],
			los: true,
			laad: async () =>
				((await activity()).moved_from ?? []).map(
					(m): Laag => ({
						soort: 'Activiteit',
						naam: langeDatum(m.date) || 'een eerdere datum',
						ref: { collection: 'activities', key: m.key }
					})
				)
		}
	];
}

const chamberLine: OwnLine = { kern: [], lines: (c) => regel('kamer', 'Kamer', chamberOf(c)) };
const aboutDossier: BucketLine = {
	id: 'dossier',
	label: 'Over',
	bak: ABOUT_DOSSIER,
	soort: 'Dossier'
};

export const BANDS: Partial<Record<Collection, Band>> = {
	articles: { lines: [{ kern: [TO_LAW], lines: (c) => lawLine(c, true) }] },
	// A bijlage belongs to its law, as an article does (UX-toets 0.79.43, #30).
	annexes: { lines: [{ kern: [TO_LAW], lines: (c) => lawLine(c, false) }] },
	judgments: {
		lines: [
			{ kern: [], lines: (c) => translationLines(c.props, c.light) },
			{ id: 'conclusie-bij', label: 'Conclusie bij', bak: ADVISED, soort: 'Arrest' },
			{ kern: [EARLIER, LATER], lines: (c) => procesgangLine(c.props, c.light) }
		],
		// More than one appeal against it: the line names the first, the group all.
		groups: [{ id: 'beroep', label: 'Hoger beroep of cassatie', bak: LATER, atLeast: 2 }],
		// The conclusie of the A-G or P-G (concept 21, Thijs 10 Oct).
		statusLine: [CONCLUSION]
	},
	documents: {
		lines: [
			{ kern: [TO_DOSSIER], lines: dossierLines },
			// A motie is submitted in its debate (`meta.reason` `ingediend`, API 0.79.55), a
			// stenogram is the record of it (#351: MADE_IN).
			{
				id: 'debat',
				label: (n) => (n.meta?.reason === 'ingediend' ? 'Ingediend in' : 'Verslag van'),
				bak: outbound('MADE_IN', 'activities'),
				soort: 'Activiteit'
			},
			{
				id: 'brief',
				label: 'Bijlage bij',
				bak: outbound('ACCOMPANIES', 'documents'),
				soort: 'Brief'
			},
			{ kern: [], lines: offersLines }
		],
		// "Vervangt nr. 19", "Vervangen door nr. 31" of a motie or amendement; its own bijlagen
		// are in the status line too, but context.
		statusLine: [outbound('REVISES', 'documents'), inbound('REVISES', 'documents')]
	},
	dossiers: { lines: [{ kern: [], lines: treatedInLines }] },
	cases: { lines: [{ id: 'dossier', label: 'Dossier', bak: TO_DOSSIER, soort: 'Dossier' }] },
	members: { lines: [{ kern: [MEMBER_OF_FACTION], lines: factionLines }] },
	factions: { lines: [chamberLine] },
	committees: { lines: [chamberLine] },
	cabinets: { lines: [] },
	activities: {
		lines: [
			{
				id: 'commissie',
				label: 'Commissie',
				bak: outbound('LED_BY', 'committees'),
				soort: 'Commissie'
			},
			{ kern: [ABOUT_DOSSIER], lines: activityLines }
		]
	},
	decisions: { lines: [aboutDossier] },
	// Where it was made stands in the reader's status line, in the Kamer's words ("Toegezegd
	// in het wetgevingsoverleg van 23 maart 2026"): once, not here too.
	commitments: { lines: [aboutDossier], statusLine: [outbound('MADE_IN', 'activities')] },
	instruments: {
		lines: [
			{
				id: 'wetsvoorstel',
				label: 'Wetsvoorstel',
				bak: outbound('LEGISLATED_IN', 'dossiers'),
				soort: 'Dossier'
			}
		]
	}
};

/** The buckets of the kern of a kind of bron: what its lines and its status line name. */
export const kernOf = (band: Band | undefined): Bak[] =>
	band
		? [...band.lines.flatMap((l) => ('bak' in l ? [l.bak] : l.kern)), ...(band.statusLine ?? [])]
		: [];
