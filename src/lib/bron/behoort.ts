// Where a bron stands, for the band "Behoort bij" above every reader: the kern, the relations
// without which the bron does not read (Procesgang, Ingediend bij, Wet), as lines in the
// reading column; under them the groups of its context, folded. The lines follow
// docs/hierarchie.md ("Kern of context"); a layer the data lacks is left out without a word.
// Thijs, 9 Oct: "maak het consistent en klikbaar", and the conclusie and eerdere aanleg of an
// arrest are "vrij cruciale info", not extra data.
import type { NodeGraph, Neighbor } from '$lib/api/nodes';
import { getNodeFirst } from '$lib/api/records';
import { refOf, type BronRef } from '$lib/bron/href';
import { shortDossierTitle } from '$lib/graph/types';
import { deelIds, layersOf } from '$lib/text/division';
import { fractiePeriodes } from './fractie-periode';
import { describe, type Row } from '$lib/verbonden/rows';
import { isBijWetsvoorstel, naastHetStuk, stukkenInDezelfdeZaak, wetsvoorstelVan } from './zaak';
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

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

const norm = (x: string) => x.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * A paper of a zaak by its kind and number, "Geleidende brief, Kamerstuk 37027, nr. 1", where
 * its title is the one its zaak shares (the bill's, on every paper of it): that says nothing
 * of what it is. A letter with a title of its own keeps it. The title in full on hover.
 */
function stukLaag(r: Row, soort: string, gedeeld: Set<string>): Laag {
	const naam = r.context && gedeeld.has(norm(r.title)) ? r.context : r.title;
	return { soort, naam, ref: r.ref, vol: naam === r.title ? undefined : r.title };
}

/** The titles more than one paper carries, this stuk's own among them. */
function gedeeldeTitels(rows: Row[], eigen: string | null): Set<string> {
	const tel = new Map<string, number>();
	for (const t of [...rows.map((r) => r.title), ...(eigen ? [eigen] : [])])
		tel.set(norm(t), (tel.get(norm(t)) ?? 0) + 1);
	return new Set([...tel].filter(([, n]) => n > 1).map(([t]) => t));
}

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
	if (n.collection === 'judgments') return { soort, naam: vol, ref, kort: instantie(vol) };
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
	 * The other papers of the stuk's zaak (the Kamer's case), the substance first: no one
	 * bucket, so asked when opened, its count not known before ($lib/bron/zaak). Only where
	 * the stuk has a zaak; a zaak that holds only the stuk lists nothing.
	 */
	const inDezelfdeZaak = (): Groep[] => {
		const key = light?.node.key;
		if (!key || !(bak('PART_OF', 'outbound', 'cases')?.total ?? 0)) return [];
		return [
			{
				id: 'zaak',
				label: 'In dezelfde zaak',
				aantal: null,
				laad: (signal) =>
					stukkenInDezelfdeZaak({ key }, signal).then((zaak) => {
						// The title the zaak shares, counted over all its papers.
						const gedeeld = gedeeldeTitels(zaak.rows, text(props.title));
						return naastHetStuk(props.kind, zaak).rows.map((r) =>
							stukLaag(r, text(r.props?.kind) ?? 'Stuk', gedeeld)
						);
					})
			}
		];
	};
	/**
	 * A paper that changes or explains a bill (nota van wijziging, memorie van toelichting,
	 * nader rapport, nota naar aanleiding van het verslag) belongs with it: the voorstel van
	 * wet of its zaak, the text it is about. Found when the zaak's papers come in.
	 */
	const bijWetsvoorstel = (): Regel[] => {
		const key = light?.node.key;
		const soort = text(props.kind) ?? '';
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
	const kamer = (): Laag[] => {
		const k = KAMER[text(props.chamber)?.toUpperCase() ?? ''];
		return k ? [{ soort: 'Kamer', naam: k }] : [];
	};

	/** A line where it names something. */
	const regel = (id: string, label: string, lagen: Laag[]): Regel[] =>
		lagen.length > 0 ? [{ id, label, lagen }] : [];

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
			return { regels: regel('wet', 'Wet', [...wet, ...deel]), naast: [], onder: [] };
		}
		case 'judgments': {
			// The procesgang: eerdere aanleg › this uitspraak › hoger beroep or cassatie, the
			// instances before the eerdere aanleg asked one by one; and the conclusie of the A-G
			// or P-G. A conclusie names the arrest it is for.
			const eerder = eerste('APPEAL_OF', 'outbound', 'judgments', 'Eerdere aanleg');
			const later = eerste('APPEAL_OF', 'inbound', 'judgments', 'Hoger beroep of cassatie');
			const gang: Laag[] =
				eerder.length + later.length > 0
					? [
							...eerder,
							{ soort: 'Deze uitspraak', naam: 'deze uitspraak', kort: 'deze', huidig: true },
							...later
						]
					: [];
			const procesgang: Regel[] = gang.length
				? [
						{
							id: 'procesgang',
							label: 'Procesgang',
							lagen: gang,
							laad: eerder[0]?.ref
								? async () => [...(await eerdereAanleg(eerder[0].ref!.key)), ...gang]
								: undefined
						}
					]
				: [];
			const beroep = bak('APPEAL_OF', 'inbound', 'judgments');
			return {
				regels: [
					...regel(
						'conclusie-bij',
						'Conclusie bij',
						eerste('ADVISES_ON', 'outbound', 'judgments', 'Arrest')
					),
					...procesgang,
					...regel(
						'conclusie',
						'Conclusie',
						eerste('ADVISES_ON', 'inbound', 'judgments', 'Conclusie').map((l) => ({
							...l,
							// "Conclusie P-G Langemeijer en Wissink" after the term Conclusie.
							naam: l.naam.replace(/^Conclusie\s+/i, '')
						}))
					)
				],
				naast: [
					...groep('ook', 'Ook gepubliceerd als', 'SAME_AS', 'outbound', 'judgments'),
					...groep('samenhang', 'Samenhang met', 'RELATED_TO', 'outbound', 'judgments')
				],
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
			// them (#351: MADE_IN, ACCOMPANIES).
			const ingediend = /motie|amendement/i.test(text(props.kind) ?? '');
			return {
				regels: [
					...regel(
						'dossier',
						ingediend ? 'Ingediend bij' : 'Dossier',
						eerste('PART_OF', 'outbound', 'dossiers', 'Dossier')
					),
					...regel(
						'debat',
						'Verslag van',
						eerste('MADE_IN', 'outbound', 'activities', 'Activiteit')
					),
					...regel('brief', 'Bijlage bij', eerste('ACCOMPANIES', 'outbound', 'documents', 'Brief')),
					...bijWetsvoorstel()
				],
				naast: inDezelfdeZaak(),
				onder: groep('bijlagen', 'Bijlagen', 'ACCOMPANIES', 'inbound', 'documents')
			};
		}
		case 'dossiers':
			return {
				regels: regel('kamer', 'Behandeld in', kamer()),
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
				regels: regel('dossier', 'Dossier', eerste('PART_OF', 'outbound', 'dossiers', 'Dossier')),
				naast: [],
				onder: groep('stukken', 'Stukken', 'PART_OF', 'inbound', 'documents')
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
				naast: [
					...(!periodes.length && fracties && fracties.total > 1
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
				regels: regel('kamer', 'Kamer', kamer()),
				naast: [],
				onder: groep('leden', 'Leden', 'MEMBER_OF', 'inbound', 'members')
			};
		case 'committees':
			return {
				regels: regel('kamer', 'Kamer', kamer()),
				naast: [],
				onder: [
					...groep('leden', 'Leden', 'MEMBER_OF', 'inbound', 'members'),
					...groep('activiteiten', 'Activiteiten', 'LED_BY', 'inbound', 'activities')
				]
			};
		case 'cabinets':
			return {
				regels: [],
				naast: [],
				onder: groep('bewindspersonen', 'Bewindspersonen', 'SERVED_IN', 'inbound', 'members')
			};
		case 'activities':
			return {
				regels: [
					...regel(
						'commissie',
						'Commissie',
						eerste('LED_BY', 'outbound', 'committees', 'Commissie')
					),
					...regel('dossier', 'Over', eerste('ABOUT', 'outbound', 'dossiers', 'Dossier'))
				],
				naast: [],
				onder: [
					...groep('stukken', 'Stukken bij deze activiteit', 'MADE_IN', 'inbound', 'documents'),
					...groep('toezeggingen', 'Toezeggingen', 'MADE_IN', 'inbound', 'commitments')
				]
			};
		case 'decisions':
			return {
				regels: regel('dossier', 'Over', eerste('ABOUT', 'outbound', 'dossiers', 'Dossier')),
				naast: [],
				onder: groep('fracties', 'Stem per fractie', 'VOTED', 'inbound', 'factions')
			};
		case 'commitments':
			return {
				regels: [
					...regel('debat', 'Gedaan in', eerste('MADE_IN', 'outbound', 'activities', 'Activiteit')),
					...regel('dossier', 'Over', eerste('ABOUT', 'outbound', 'dossiers', 'Dossier'))
				],
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
				onder: [
					...groep('artikelen', 'Artikelen', 'PART_OF', 'inbound', 'articles'),
					...groep('versies', 'Versies', 'VERSION_OF', 'inbound', 'instrument_versions')
				]
			};
		default:
			return LEEG;
	}
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

/** Whether a band has anything to show. */
export const heeftIets = (b: Behoort) => b.regels.length + b.naast.length + b.onder.length > 0;

/** The context through which a reader's frame learns which bron its band is for. */
export const BEHOORT_KEY = Symbol('behoort-bij');
