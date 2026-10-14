// Where a bron stands, for the band "Behoort bij" above every reader: the kern, the relations
// without which the bron does not read (Procesgang, Ingediend bij, Wet), as lines in the
// reading column; under them the groups of its context, folded. The lines follow
// docs/hierarchie.md ("Kern of context"); a layer the data lacks is left out without a word.
// Thijs, 9 Oct: "maak het consistent en klikbaar", and the conclusie and eerdere aanleg of an
// arrest are "vrij cruciale info", not extra data.
import { textOf } from '$lib/text/words';
import { naamVan } from '$lib/bron/menselijk';
import type { Bucket, NodeGraph, Neighbor } from '$lib/api/nodes';
import { getActivity, getNodeFirst } from '$lib/api/records';
import { getDossier } from '$lib/components/parliamentary/data';
import { refOf, type BronRef } from '$lib/bron/href';
import { dossierName, dossierUitProps, kamerstukNummer } from './dossier-naam';
import { artikelAnker, deelIds, layersOf } from '$lib/text/division';
import { langeDatum } from '$lib/text/datum';
import { kindName } from '$lib/components/explore/law-head';
import { fractiePeriodes } from './fractie-periode';
import { describe, type Row } from '$lib/verbonden/rows';
import {
	aangebodenVan,
	isAanbieding,
	isBijWetsvoorstel,
	stukkenInDezelfdeZaak,
	wetsvoorstelVan
} from './zaak';
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

export type Behoort = { regels: Regel[]; naast: Groep[]; onder: Groep[] };

const LEEG: Behoort = { regels: [], naast: [], onder: [] };

const KAMER: Record<string, string> = { TK: 'Tweede Kamer', EK: 'Eerste Kamer' };

const norm = (x: string) => x.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * A paper of a zaak by its kind and number, "Geleidende brief, Kamerstuk 37027, nr. 1", where
 * its title is the one its zaak shares (the bill's, on every paper of it): that says nothing
 * of what it is. A letter with a title of its own keeps it. The title in full on hover.
 */
/** "Voorstel van wet, Kamerstuk 34372, nr. 2" as "Voorstel van wet, nr. 2", after its dossier. */
const zonderKamerstuk = (naam: string) => naam.replace(/,\s*Kamerstuk\s+[^,]+,\s*/, ', ');

function stukLaag(r: Row, soort: string, gedeeld: Set<string>): Laag {
	const naam = r.context && gedeeld.has(norm(r.title)) ? r.context : r.title;
	return { soort, naam, ref: r.ref, vol: naam === r.title ? undefined : r.title };
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

/**
 * The Kamers that dealt with a dossier: those of its label, and the Eerste Kamer where its
 * detail holds papers there (`senate.document_count`) or an outcome there (`ek_outcome`).
 */
export function metEersteKamer(
	kamers: Laag[],
	d: { senate?: { document_count?: number | null } | null; ek_outcome?: unknown }
): Laag[] {
	const ek = (d.senate?.document_count ?? 0) > 0 || !!d.ek_outcome;
	if (!ek || kamers.some((k) => k.naam === 'Eerste Kamer')) return kamers;
	return kamers.some((k) => k.naam === 'Tweede Kamer')
		? [{ soort: 'Kamer', naam: 'Tweede Kamer en Eerste Kamer' }]
		: [{ soort: 'Kamer', naam: 'Eerste Kamer' }];
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
		const label = kamerstukNummer(nummer);
		const titel = dossierName(d);
		return { soort, naam: titel !== nummer ? `${label} ${titel}` : label, ref, vol: lang };
	}
	if (n.collection === 'judgments') {
		// An appeal against this one names its remedy on the edge (`Cassatie`); an earlier
		// instance's own remedy is on another edge, so it has its outcome alone.
		const uitkomst = uitkomstVan(
			props.outcome,
			n.relation === 'APPEAL_OF' && n.direction === 'inbound'
				? (n.meta as Record<string, unknown> | null | undefined)?.procedure_type
				: null
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
function instantie(naam: string): string | undefined {
	const gerecht = naam.split(',')[0].trim();
	const jaar = /\b(1[89]|20)\d{2}\b/.exec(naam.slice(gerecht.length))?.[0];
	const kort = GERECHT.reduce((g, [re, k]) => g.replace(re, k), gerecht);
	return kort !== gerecht || jaar ? [kort, jaar].filter(Boolean).join(' ') : undefined;
}

/**
 * The conclusie of the A-G or P-G on a judgment (`ADVISES_ON` inbound), from its light node:
 * "P-G Langemeijer en Wissink, 13 september 2019", for the status line of the reader.
 */
export function conclusieVan(light: NodeGraph | null): Laag | null {
	const n = light?.neighbors.buckets?.find(
		(b) => b.relation === 'ADVISES_ON' && b.direction === 'inbound' && b.collection === 'judgments'
	)?.items?.[0];
	if (!n) return null;
	const l = laagVan(n, 'Conclusie');
	return { ...l, naam: l.naam.replace(/^Conclusie\s+/i, '') };
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
	/**
	 * A paper that changes or explains a bill (nota van wijziging, memorie van toelichting,
	 * nader rapport, nota naar aanleiding van het verslag) belongs with it: the voorstel van
	 * wet of its zaak, the text it is about. Found when the zaak's papers come in.
	 */
	const bijWetsvoorstel = (): Regel[] => {
		const key = light?.node.key;
		const soort = textOf(props.kind) ?? '';
		if (!key || !(bak('PART_OF', 'outbound', 'cases')?.total ?? 0) || !isBijWetsvoorstel(soort))
			return [];
		return [
			{
				id: 'wetsvoorstel',
				label: 'Bij wetsvoorstel',
				lagen: [],
				laad: (signal) =>
					stukkenInDezelfdeZaak({ key }, signal).then(({ rows }) =>
						[wetsvoorstelVan(rows)].flatMap((r) =>
							r ? [stukLaag(r, 'Wetsvoorstel', new Set())] : []
						)
					)
			}
		];
	};
	/**
	 * A geleidende brief or aanbiedingsbrief says nothing without what it offers: the substance
	 * of its zaak (aangebodenVan), side by side. Found when the zaak's papers come in.
	 */
	const biedtAan = (): Regel[] => {
		const key = light?.node.key;
		if (!key || !(bak('PART_OF', 'outbound', 'cases')?.total ?? 0) || !isAanbieding(props.kind))
			return [];
		return [
			{
				id: 'biedt-aan',
				label: 'Biedt aan',
				lagen: [],
				los: true,
				laad: (signal) =>
					stukkenInDezelfdeZaak({ key }, signal).then(({ rows }) =>
						aangebodenVan(rows).map((r) => stukLaag(r, textOf(r.props?.kind) ?? 'Stuk', new Set()))
					)
			}
		];
	};
	const kamer = (): Laag[] => {
		// The Kamer in props, else in the bron's label (a dossier node: `TK`), a source value.
		const label = (light?.node as { labels?: string[] } | undefined)?.labels?.find(
			(l) => l === 'TK' || l === 'EK'
		);
		const k = KAMER[(textOf(props.chamber) ?? label ?? '').toUpperCase()];
		return k ? [{ soort: 'Kamer', naam: k }] : [];
	};

	/**
	 * The kind of the law an article or bijlage belongs to, as its own page names it: `AMvB`,
	 * `Ministeriële regeling`, `Verdrag`; `Wet` where its node gives none.
	 */
	const soortVanWet = () =>
		kindName(textOf(bak('PART_OF', 'outbound', 'instruments')?.items?.[0]?.props?.kind)) ?? 'Wet';

	/** A line where it names something. */
	const regel = (id: string, label: string, lagen: Laag[]): Regel[] =>
		lagen.length > 0 ? [{ id, label, lagen }] : [];

	switch (collection) {
		case 'articles': {
			// Wet › hoofdstuk › titel › afdeling: the law as a bron, the division by name
			// (in props, `breadcrumb`); a layer that is the law itself is no layer.
			const afk = textOf(
				bak('PART_OF', 'outbound', 'instruments')?.items?.[0]?.props?.abbreviation
			);
			// The law opens with this article in view (WholeLawReader, `#artikel-658`).
			const nummer = textOf(props.article_number);
			const soort = soortVanWet();
			const wet = eerste('PART_OF', 'outbound', 'instruments', soort).map((l) => ({
				...l,
				...(afk ? { kort: afk } : {}),
				...(nummer ? { at: artikelAnker(nummer) } : {})
			}));
			const crumbs = Array.isArray(props.breadcrumb)
				? (props.breadcrumb as { type?: string; label?: string; title?: string }[])
				: [];
			const lagen = layersOf(crumbs, textOf(props.instrument_citation_title));
			// Each division opens in the whole law at its heading (WholeLawReader, `deelIds`).
			const ids = deelIds(crumbs).slice(crumbs.length - lagen.length);
			const deel = lagen
				.map((c, i) => ({
					soort: textOf(c.type) ?? 'Deel',
					naam: [textOf(c.label), textOf(c.title)].filter(Boolean).join(' '),
					kort: textOf(c.label) ?? undefined,
					ref: wet[0]?.ref,
					at: wet[0]?.ref ? ids[i] : undefined
				}))
				.filter((l) => l.kort);
			return { regels: regel('wet', soort, [...wet, ...deel]), naast: [], onder: [] };
		}
		case 'annexes': {
			// A bijlage belongs to its law, as an article does (UX-toets 0.79.43, #30).
			const afk = textOf(
				bak('PART_OF', 'outbound', 'instruments')?.items?.[0]?.props?.abbreviation
			);
			const soort = soortVanWet();
			const wet = eerste('PART_OF', 'outbound', 'instruments', soort).map((l) =>
				afk ? { ...l, kort: afk } : l
			);
			return { regels: regel('wet', soort, wet), naast: [], onder: [] };
		}
		case 'judgments': {
			// The procesgang: eerdere aanleg › this uitspraak › hoger beroep or cassatie, the
			// instances before the eerdere aanleg asked one by one. A conclusie names the arrest
			// it is for.
			// An eerdere aanleg the source names but the data lacks (`unresolved_appeal_targets`)
			// stands in the line as text: "Rechtbank Gelderland, 9 juli 2025, 24/6811".
			const nietInGegevens: Laag[] = (
				Array.isArray(props.unresolved_appeal_targets)
					? (props.unresolved_appeal_targets as Record<string, unknown>[])
					: []
			).map((t) => {
				const court = textOf(t.court) ?? '';
				const naam = [
					court.charAt(0).toUpperCase() + court.slice(1),
					textOf(t.date) ? langeDatum(textOf(t.date)!) : null,
					textOf(t.case_number)
				]
					.filter(Boolean)
					.join(', ');
				return { soort: 'Eerdere aanleg, niet in de gegevens', naam, kort: instantie(naam) };
			});
			const eerder = [
				...nietInGegevens,
				...eerste('APPEAL_OF', 'outbound', 'judgments', 'Eerdere aanleg')
			];
			const later = eerste('APPEAL_OF', 'inbound', 'judgments', 'Hoger beroep of cassatie');
			// This one's outcome, after the remedy its edge to the eerdere aanleg names.
			const eigen = uitkomstVan(
				props.outcome,
				(bak('APPEAL_OF', 'outbound', 'judgments')?.items?.[0]?.meta as Record<string, unknown>)
					?.procedure_type
			);
			const gang: Laag[] =
				eerder.length + later.length > 0
					? [
							...eerder,
							{
								soort: 'Deze uitspraak',
								naam: 'deze uitspraak',
								kort: 'deze',
								huidig: true,
								...(eigen ? { uitkomst: eigen } : {})
							},
							...later
						]
					: [];
			const procesgang: Regel[] = gang.length
				? [
						{
							id: 'procesgang',
							label: 'Procesgang',
							lagen: gang,
							laad: eerder.at(-1)?.ref
								? async () => [...(await eerdereAanleg(eerder.at(-1)!.ref!.key)), ...gang]
								: undefined
						}
					]
				: [];
			// A translation the Rechtspraak published under its own ECLI has no instances of its
			// own: it names its original (`translation_of`, a source value), and the procesgang
			// is the original's, asked when the band is there (audit L4).
			const origineel = textOf(props.translation_of);
			const origineelKey = origineel ? ecliKey(origineel) : null;
			const vertaling: Regel[] =
				origineelKey && !gang.length
					? [
							{
								id: 'vertaling',
								label: 'Vertaling van',
								lagen: [
									{
										soort: 'Origineel',
										naam: origineel!,
										ref: { collection: 'judgments', key: origineelKey }
									}
								],
								laad: async () => {
									const l = await getNodeFirst('judgments', origineelKey).catch(() => null);
									return l?.node
										? [laagVan({ ...l.node, collection: 'judgments' } as Neighbor, 'Origineel')]
										: [];
								}
							},
							{
								id: 'procesgang',
								label: 'Procesgang',
								lagen: [],
								laad: () => procesgangVan(origineelKey)
							}
						]
					: [];
			const beroep = bak('APPEAL_OF', 'inbound', 'judgments');
			return {
				regels: [
					...vertaling,
					...regel(
						'conclusie-bij',
						'Conclusie bij',
						eerste('ADVISES_ON', 'outbound', 'judgments', 'Arrest')
					),
					// The conclusie of the A-G or P-G stands in the reader's status line
					// (conclusieVan), not in the band (concept 21, Thijs 10 Oct).
					...procesgang
				],
				naast: [],
				// More than one appeal against it: the line names the first, the group all.
				onder:
					beroep && beroep.total > 1
						? groep('beroep', 'Hoger beroep of cassatie', 'APPEAL_OF', 'inbound', 'judgments')
						: []
			};
		}
		case 'documents': {
			// A motie or amendement is ingediend bij its dossier, another stuk is in it; a
			// stenogram records its debat and a bijlage goes with its brief once the data has
			// them (#351: MADE_IN, ACCOMPANIES). A stuk at a bill stands in one chain with it,
			// "Dossier: 34372 … › Voorstel van wet, nr. 2" (concept 21, Thijs 10 Oct); its own
			// bijlagen are in the reader's status line, not in the band.
			const ingediend = /motie|amendement/i.test(textOf(props.kind) ?? '');
			const dossier = eerste('PART_OF', 'outbound', 'dossiers', 'Dossier');
			const wetsvoorstel = bijWetsvoorstel()[0];
			const label = ingediend ? 'Ingediend bij' : 'Dossier';
			const metWetsvoorstel: Regel[] =
				dossier.length && wetsvoorstel?.laad
					? [
							{
								id: 'dossier',
								label,
								lagen: dossier,
								laad: (signal) =>
									wetsvoorstel.laad!(signal).then((ls) => [
										...dossier,
										// After its dossier the bill needs no dossier number of its own.
										...ls.map((l) => ({ ...l, naam: zonderKamerstuk(l.naam) }))
									])
							}
						]
					: [...regel('dossier', label, dossier), ...(wetsvoorstel ? [wetsvoorstel] : [])];
			return {
				regels: [
					...metWetsvoorstel,
					// A motie is submitted in its debate (`meta.reason` `ingediend`, API 0.79.55), a
					// stenogram is the record of it.
					...regel(
						'debat',
						(bak('MADE_IN', 'outbound', 'activities')?.items?.[0]?.meta as Record<string, unknown>)
							?.reason === 'ingediend'
							? 'Ingediend in'
							: 'Verslag van',
						eerste('MADE_IN', 'outbound', 'activities', 'Activiteit')
					),
					...regel('brief', 'Bijlage bij', eerste('ACCOMPANIES', 'outbound', 'documents', 'Brief')),
					...biedtAan()
				],
				naast: [],
				onder: []
			};
		}
		case 'dossiers': {
			// The Kamer it is in. What the bill amends and implements stands in the reader, under
			// the title, from the dossier's detail (concept 21, Thijs 10 Oct: not above the title).
			// The label names the Kamer whose data holds the dossier (`TK`); the Eerste Kamer
			// dealt with it too where the dossier's own detail says so, by its papers there
			// (`senate`) or its outcome there (`ek_outcome`), source values (UX-toets 10 Oct:
			// 36600-VII "Behandeld in: Tweede Kamer" while the Eerste Kamer adopted it).
			const kamers = kamer();
			// The dossier to ask: its number, else its key (a lookup, not a name).
			const sleutel = light?.node.key ?? null;
			const nummer = dossierNummer(props) ?? sleutel;
			return {
				regels: [
					{
						id: 'kamer',
						label: 'Behandeld in',
						lagen: kamers,
						laad: nummer
							? () =>
									getDossier(nummer)
										.then((d) => metEersteKamer(kamers, d))
										.catch(() => kamers)
							: undefined
					}
				],
				naast: [],
				onder: []
			};
		}
		case 'cases':
			return {
				regels: regel('dossier', 'Dossier', eerste('PART_OF', 'outbound', 'dossiers', 'Dossier')),
				naast: [],
				onder: []
			};
		case 'members': {
			// A lid in its fracties, each with its period from the lid's own memberships
			// ("D66, sinds 2023"; "VVD, 2017–2021"), the current one first (Thijs, 9 Oct).
			const periodes = fractiePeriodes(props.faction_memberships);
			const fracties = bak('MEMBER_OF', 'outbound', 'factions');
			const regels: Regel[] = periodes.length
				? [
						{
							id: 'fractie',
							label: periodes.length > 1 ? 'Fracties' : 'Fractie',
							los: true,
							lagen: periodes.map((f) => ({
								soort: 'Fractie',
								// The period on a phone too: it is what Thijs asked for.
								naam: `${f.naam}, ${f.periode}`,
								ref: refOf('factions', f.key, {})
							}))
						}
					]
				: fracties?.total === 1
					? regel('fractie', 'Fractie', eerste('MEMBER_OF', 'outbound', 'factions', 'Fractie'))
					: [];
			return {
				regels,
				naast: [],
				onder: []
			};
		}
		case 'factions':
			return {
				regels: regel('kamer', 'Kamer', kamer()),
				naast: [],
				onder: []
			};
		case 'committees':
			return {
				regels: regel('kamer', 'Kamer', kamer()),
				naast: [],
				onder: []
			};
		case 'cabinets':
			return {
				regels: [],
				naast: [],
				onder: []
			};
		case 'activities': {
			// Every dossier on its agenda side by side, and the activity it took the place of,
			// from the activity's own answer (`/api/activities/{key}`, one cheap request); the
			// light node has the first dossier only.
			const key = light?.node.key;
			const activiteit = key ? () => getActivity(key) : null;
			const over = eerste('ABOUT', 'outbound', 'dossiers', 'Dossier');
			return {
				regels: [
					...regel(
						'commissie',
						'Commissie',
						eerste('LED_BY', 'outbound', 'committees', 'Commissie')
					),
					{
						id: 'dossier',
						label: 'Over',
						lagen: over,
						los: true,
						laad: activiteit
							? async () => {
									const ds = (await activiteit()).dossiers ?? [];
									return ds.length ? ds.map(dossierLaag) : over;
								}
							: undefined
					},
					...(activiteit
						? [
								{
									id: 'verplaatst',
									label: 'Verplaatst van',
									lagen: [],
									los: true,
									laad: async () =>
										((await activiteit()).moved_from ?? []).map(
											(m): Laag => ({
												soort: 'Activiteit',
												naam: langeDatum(m.date) || 'een eerdere datum',
												ref: { collection: 'activities', key: m.key }
											})
										)
								}
							]
						: [])
				],
				naast: [],
				onder: []
			};
		}
		case 'decisions':
			return {
				regels: regel('dossier', 'Over', eerste('ABOUT', 'outbound', 'dossiers', 'Dossier')),
				naast: [],
				onder: []
			};
		case 'commitments':
			return {
				// Where it was made stands in the reader's status line, in the Kamer's words
				// ("Toegezegd in het wetgevingsoverleg van 23 maart 2026"): once, not here too.
				regels: regel('dossier', 'Over', eerste('ABOUT', 'outbound', 'dossiers', 'Dossier')),
				naast: [],
				onder: []
			};
		case 'instruments':
			return {
				regels: regel(
					'wetsvoorstel',
					'Wetsvoorstel',
					eerste('LEGISLATED_IN', 'outbound', 'dossiers', 'Dossier')
				),
				naast: [],
				onder: []
			};
		default:
			return LEEG;
	}
}

/** A dossier on an agenda as a layer, as `laagVan` names one: "Kamerstuk 36764 Cyberbeveiligingswet". */
function dossierLaag(d: {
	number: string;
	short_title?: string | null;
	title?: string | null;
}): Laag {
	const label = kamerstukNummer(d.number);
	const titel = dossierName(d);
	return {
		soort: 'Dossier',
		naam: titel !== d.number ? `${label} ${titel}` : label,
		ref: { collection: 'dossiers', key: d.number, number: d.number },
		vol: d.title?.trim() || undefined
	};
}

/**
 * The instances before an eerdere aanleg, the earliest first: up to three steps down
 * `APPEAL_OF`, each a light node (cached), each asked only after the one before.
 */
async function eerdereAanleg(key: string): Promise<Laag[]> {
	const keten: Laag[] = [];
	let k = key;
	for (let i = 0; i < 3; i++) {
		const light = await getNodeFirst('judgments', k).catch(() => null);
		const n = light?.neighbors.buckets?.find(
			(b) =>
				b.relation === 'APPEAL_OF' && b.direction === 'outbound' && b.collection === 'judgments'
		)?.items?.[0];
		if (!n) break;
		keten.unshift(laagVan(n, 'Eerdere aanleg'));
		k = n.key;
	}
	return keten;
}

/** An ECLI as the key of its judgment: `ECLI:NL:HR:2019:2006` is `ecli_nl_hr_2019_2006`. */
export const ecliKey = (ecli: string) => ecli.trim().toLowerCase().replaceAll(':', '_');

const appeal = (light: NodeGraph | null, direction: 'inbound' | 'outbound') =>
	light?.neighbors.buckets?.find(
		(b) => b.relation === 'APPEAL_OF' && b.direction === direction && b.collection === 'judgments'
	)?.items?.[0];

/**
 * The procesgang of another judgment, with that judgment as a link in its place: for a
 * translation, its original's. Its light node and those before it, cached.
 */
async function procesgangVan(key: string): Promise<Laag[]> {
	const light = await getNodeFirst('judgments', key).catch(() => null);
	if (!light?.node) return [];
	const eerder = appeal(light, 'outbound');
	const later = appeal(light, 'inbound');
	if (!eerder && !later) return [];
	const zelf = laagVan({ ...light.node, collection: 'judgments' } as Neighbor, 'Het origineel');
	return [
		...(eerder ? [...(await eerdereAanleg(eerder.key)), laagVan(eerder, 'Eerdere aanleg')] : []),
		zelf,
		...(later ? [laagVan(later, 'Hoger beroep of cassatie')] : [])
	];
}

/**
 * The ids of the instances before a judgment's eerdere aanleg (the Rechtbank before the
 * Hof), which its procesgang names but no bucket of its own holds: Verbonden does not list
 * them again under what the judgment cites (Thijs, 9 Oct). The same cached light nodes as
 * the band's line.
 */
export async function procesgangIds(key: string): Promise<string[]> {
	const light = await getNodeFirst('judgments', key).catch(() => null);
	// A translation: its original's procesgang, the original included.
	const origineel = textOf(
		(light?.node as { props?: Record<string, unknown> } | undefined)?.props?.translation_of
	);
	if (origineel && !appeal(light, 'outbound') && !appeal(light, 'inbound'))
		return (await procesgangVan(ecliKey(origineel))).flatMap((l) =>
			l.ref ? [`${l.ref.collection}/${l.ref.key}`] : []
		);
	const eerder = light?.neighbors.buckets?.find(
		(b) => b.relation === 'APPEAL_OF' && b.direction === 'outbound' && b.collection === 'judgments'
	)?.items?.[0];
	if (!eerder) return [];
	const keten = await eerdereAanleg(eerder.key);
	return keten.flatMap((l) => (l.ref ? [`${l.ref.collection}/${l.ref.key}`] : []));
}

/**
 * The ids the band's lazy kern lines name, for Verbonden not to list them again: the
 * procesgang of a uitspraak, what a dossier's bill amends and implements (`legal_effect`,
 * from the detail the reader asks already).
 */
export async function lazeKernIds(
	collection: Collection,
	key: string,
	props: Record<string, unknown>
): Promise<string[]> {
	if (collection === 'judgments') return procesgangIds(key);
	if (collection !== 'dossiers') return [];
	const nummer = dossierNummer(props) ?? key;
	const d = await getDossier(nummer).catch(() => null);
	const e = d?.legal_effect;
	return [...(e?.amends ?? []), ...(e?.implements ?? [])].map((w) => `instruments/${w.key}`);
}

/**
 * The buckets of the kern per kind of bron: what the lines of the band read. Verbonden leaves
 * a group out that reads only these (Thijs, 9 Oct: "dubbelop"); Verbonden is the context.
 */
export const KERN: Partial<Record<Collection, Bak[]>> = {
	articles: [{ relation: 'PART_OF', direction: 'outbound', collection: 'instruments' }],
	judgments: [
		{ relation: 'APPEAL_OF', direction: 'outbound', collection: 'judgments' },
		{ relation: 'APPEAL_OF', direction: 'inbound', collection: 'judgments' },
		{ relation: 'ADVISES_ON', direction: 'inbound', collection: 'judgments' },
		{ relation: 'ADVISES_ON', direction: 'outbound', collection: 'judgments' }
	],
	documents: [
		{ relation: 'PART_OF', direction: 'outbound', collection: 'dossiers' },
		{ relation: 'MADE_IN', direction: 'outbound', collection: 'activities' },
		{ relation: 'ACCOMPANIES', direction: 'outbound', collection: 'documents' },
		// The status line of a motie or amendement: "Vervangt nr. 19", "Vervangen door nr. 31".
		{ relation: 'REVISES', direction: 'outbound', collection: 'documents' },
		{ relation: 'REVISES', direction: 'inbound', collection: 'documents' }
	],
	cases: [{ relation: 'PART_OF', direction: 'outbound', collection: 'dossiers' }],
	members: [{ relation: 'MEMBER_OF', direction: 'outbound', collection: 'factions' }],
	activities: [
		{ relation: 'LED_BY', direction: 'outbound', collection: 'committees' },
		{ relation: 'ABOUT', direction: 'outbound', collection: 'dossiers' }
	],
	decisions: [{ relation: 'ABOUT', direction: 'outbound', collection: 'dossiers' }],
	commitments: [
		{ relation: 'MADE_IN', direction: 'outbound', collection: 'activities' },
		{ relation: 'ABOUT', direction: 'outbound', collection: 'dossiers' }
	],
	instruments: [{ relation: 'LEGISLATED_IN', direction: 'outbound', collection: 'dossiers' }]
};

/**
 * Whether a group of Verbonden reads only the kern: every bucket it matches is in `KERN`,
 * and it has no loader of its own.
 */
export function isKernGroep(
	collection: Collection,
	g: { load?: string; match?: readonly Bucket[] }
): boolean {
	const kern = KERN[collection] ?? [];
	if (g.load || !g.match?.length) return false;
	const lijst = <T>(v: T | T[]) => (Array.isArray(v) ? v : [v]);
	return g.match.every((m) =>
		lijst(m.relation).every((relation) =>
			lijst(m.collection).every((coll) =>
				kern.some(
					(k) => k.relation === relation && k.direction === m.direction && k.collection === coll
				)
			)
		)
	);
}

/**
 * Groups that are the bron's own content, not its context: a law's articles are its table
 * of contents and its text (Thijs, 9 Oct: "overdreven als we al een inhoudsopgave hebben").
 * Verbonden leaves them out; the table and an export keep them.
 */
export const INHOUD: Partial<Record<Collection, string[]>> = {
	instruments: ['articles'],
	// A fractie's reader lists all its leden (Thijs, 10 Oct: "Leden is hier nu ook dubbelop").
	// A commissie names only its officers and a kabinet counts its bewindspersonen: their
	// lists stay in Verbonden.
	factions: ['members'],
	// A lid's reader lists its commissies; a bewindspersoon's also the dossiers it signed in
	// (BewindspersoonOverzicht). UX-toets 10 Oct, #16: "Commissies 20" stood twice.
	members: ['committees']
};
/** Groups the reader lists only where its props say so: a lid with a post in a kabinet. */
const INHOUD_ALS: Partial<
	Record<Collection, Record<string, (props: Record<string, unknown>) => boolean>>
> = {
	members: {
		dossiers: (props) =>
			Array.isArray(props.government_functions) && props.government_functions.length > 0
	}
};
export const isInhoudGroep = (
	collection: Collection,
	g: { id: string },
	props: Record<string, unknown> = {}
) =>
	(INHOUD[collection]?.includes(g.id) ?? false) ||
	(INHOUD_ALS[collection]?.[g.id]?.(props) ?? false);

/** Whether a band has anything to show. */
export const heeftIets = (b: Behoort) => b.regels.length + b.naast.length + b.onder.length > 0;

/** The context through which a reader's frame learns which bron its band is for. */
export const BEHOORT_KEY = Symbol('behoort-bij');
