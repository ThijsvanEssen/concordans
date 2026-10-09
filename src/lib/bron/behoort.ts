// Where a bron stands, for the band "Behoort bij" above every reader: the kern, the relations
// without which the bron does not read (Procesgang, Ingediend bij, Wet), as lines in the
// reading column; under them the groups of its context, folded. The lines follow
// docs/hierarchie.md ("Kern of context"); a layer the data lacks is left out without a word.
// Thijs, 9 Oct: "maak het consistent en klikbaar", and the conclusie and eerdere aanleg of an
// arrest are "vrij cruciale info", not extra data.
import type { Bucket, NodeGraph, Neighbor } from '$lib/api/nodes';
import { getNodeFirst } from '$lib/api/records';
import { getDossier } from '$lib/components/parliamentary/data';
import { refOf, type BronRef } from '$lib/bron/href';
import { shortDossierTitle } from '$lib/graph/types';
import { deelIds, layersOf } from '$lib/text/division';
import { langeDatum } from '$lib/text/datum';
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
						aangebodenVan(rows).map((r) => stukLaag(r, text(r.props?.kind) ?? 'Stuk', new Set()))
					)
			}
		];
	};
	const kamer = (): Laag[] => {
		// The Kamer in props, else in the bron's label (a dossier node: `TK`), a source value.
		const label = (light?.node as { labels?: string[] } | undefined)?.labels?.find(
			(l) => l === 'TK' || l === 'EK'
		);
		const k = KAMER[(text(props.chamber) ?? label ?? '').toUpperCase()];
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
			// An eerdere aanleg the source names but the data lacks (`unresolved_appeal_targets`)
			// stands in the line as text: "Rechtbank Gelderland, 9 juli 2025, 24/6811".
			const nietInGegevens: Laag[] = (
				Array.isArray(props.unresolved_appeal_targets)
					? (props.unresolved_appeal_targets as Record<string, unknown>[])
					: []
			).map((t) => {
				const court = text(t.court) ?? '';
				const naam = [
					court.charAt(0).toUpperCase() + court.slice(1),
					text(t.date) ? langeDatum(text(t.date)!) : null,
					text(t.case_number)
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
							laad: eerder.at(-1)?.ref
								? async () => [...(await eerdereAanleg(eerder.at(-1)!.ref!.key)), ...gang]
								: undefined
						}
					]
				: [];
			// A translation the Rechtspraak published under its own ECLI has no instances of its
			// own: it names its original (`translation_of`, a source value), and the procesgang
			// is the original's, asked when the band is there (audit L4).
			const origineel = text(props.translation_of);
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
					...bijWetsvoorstel(),
					...biedtAan()
				],
				naast: [],
				// The bijlagen of a brief are its kern: a brief is read with them.
				onder: groep('bijlagen', 'Bijlagen', 'ACCOMPANIES', 'inbound', 'documents')
			};
		}
		case 'dossiers': {
			// What the bill does to the law, from the dossier's detail (API 0.79.30,
			// `legal_effect`), which the dossier reader asks already (cached): "Wijzigt: Wft,
			// Wta; Implementeert: Richtlijn (EU) 2023/2864" (Thijs, 9 Oct). Shown once it is in.
			const nummer = text(props.number) ?? text(props.label) ?? light?.node.key ?? null;
			const effect = (soort: 'amends' | 'implements') => async () => {
				if (!nummer) return [];
				const d = await getDossier(nummer).catch(() => null);
				return (d?.legal_effect?.[soort] ?? []).map(
					(w): Laag => ({
						soort: soort === 'amends' ? 'Wet' : 'EU-handeling',
						naam: w.name ?? w.short ?? w.key,
						kort: w.short ?? undefined,
						ref: { collection: 'instruments', key: w.key },
						vol: (w.basis ?? []).includes('staatsblad')
							? `${w.name ?? w.key}, in het Staatsblad`
							: `${w.name ?? w.key}, volgens het wetsvoorstel`
					})
				);
			};
			return {
				regels: [
					...regel('kamer', 'Behandeld in', kamer()),
					{ id: 'wijzigt', label: 'Wijzigt', lagen: [], los: true, laad: effect('amends') },
					{
						id: 'implementeert',
						label: 'Implementeert',
						lagen: [],
						los: true,
						laad: effect('implements')
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
				onder: []
			};
		case 'decisions':
			return {
				regels: regel('dossier', 'Over', eerste('ABOUT', 'outbound', 'dossiers', 'Dossier')),
				naast: [],
				onder: []
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
				onder: []
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
	const origineel = text(
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
	const nummer = text(props.number) ?? text(props.label) ?? key;
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
		{ relation: 'ACCOMPANIES', direction: 'outbound', collection: 'documents' }
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
	factions: ['members']
};
export const isInhoudGroep = (collection: Collection, g: { id: string }) =>
	INHOUD[collection]?.includes(g.id) ?? false;

/** Whether a band has anything to show. */
export const heeftIets = (b: Behoort) => b.regels.length + b.naast.length + b.onder.length > 0;

/** The context through which a reader's frame learns which bron its band is for. */
export const BEHOORT_KEY = Symbol('behoort-bij');
