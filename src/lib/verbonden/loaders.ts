// The groups of the panel Verbonden that no edge of the selected bron fills. One
// function per `Loader` of the group table; each returns rows, and a total where
// the API gives one.
import { formatCount } from '$lib/text/getal';
import { isBill, motionOrAmendment } from '$lib/text/document-kind';
import { NL } from '$lib/text/collator';
import { plural, textOf } from '$lib/text/words';
import { citationRecord } from '$lib/text/citation-record';
import { stuksoortOf } from '$lib/bron/rubrieken';
import { naamVan, naamVanId } from '$lib/bron/menselijk';
import { ifExists, report } from '$lib/api/errors';
import { geteld } from '$lib/api/decisions';
import type { Schema } from '$lib/api/types';
import { getCommittee } from '$lib/api/committees';
import { MINISTRY_KEYS, choiceOf } from '$lib/util/choice';
import { getInstruments } from '$lib/api/instruments';
import { getCommitments } from '$lib/api/commitments';
import { getFacetedList } from '$lib/api/lists';
import { OPEN_STATUS } from '$lib/components/explore/index/government';
import { numberOf } from '$lib/components/parliamentary/dossier-number';
import { isInternational, parseNodeId } from '$lib/vocabulary';
import { refOf } from '$lib/bron/ref';
import { naastHetStuk, stukkenInDezelfdeZaak } from './zaak';
import { loadDossierHub, type DossierHub } from './dossier-hub';
import { explanatoryDocuments } from './explanatory-documents';
import { rowsOfCitedBy } from './cited-by';
import { isStrafGroep } from './cited-outcome';
import { CITED_BY_PAGE, LAW_JUDGMENTS } from '$lib/api/first-pages';
import { getArticleDetail, getDelegated, getLawBasis, getLawDelegated } from '$lib/api/articles';
import {
	grondslagArtikelen,
	medeOpGrondVan,
	type Grondslag,
	type Regeling,
	type WetRegeling
} from '$lib/text/delegaties';
import { kindName } from '$lib/text/law-kind';
import { abortable, getAmendedBy, getDecision, getMemberDossiers, once } from '$lib/api/records';
import {
	getCitedBy,
	getCommitteeActivities,
	getDossiersOfNumber,
	getEuLinks,
	getFactionDossiers,
	getInstrumentDossiers,
	getInstrumentJudgments,
	getLegislativeHistory,
	getRelatedInstruments,
	getRelationshipsWithAard,
	getTouchedInstruments
} from '$lib/api/verbonden';
import { lawArticleList } from '$lib/api/law-articles';
import { buildGroups, ditVan, EUROPEAN, matches, type Loader, type Match } from './groups';
import { courtOfTier, filterGroupOf, tiersOfCourt, type Court, type CutBy } from './filter';
import { instrumentMetaStore } from '$lib/api/instrument-cache';
import { lawName } from '$lib/text/instrument-meta';
import { getJudgmentDetail } from '$lib/api/judgments';
import { aanhalingIn } from './passage';
import { legUit, overwegingVanNoot, type Uitspraak } from '$lib/bron/overweging';
import { metVoetnoot } from '$lib/text/voetnoten';
import { bucketKey, getBuckets } from '$lib/api/nodes';
import { lawIdOf } from '$lib/graph/types';
import { get } from 'svelte/store';
import { paragraphCite } from '$lib/text/ecli';
import { articleName, articleRef, withBook } from '$lib/text/bw';
import { korteDatum } from '$lib/text/datum';
import { anchorLabel, lidAnchor, parseAnchor } from '$lib/text/anchor';
import { anchorOf, parseQualifier } from '$lib/text/qualifier';
import { aardOf, historyRow, uniqueRows, rowOfNeighbor, unresolvedRows, type Row } from './rows';
import { describeBron, describeBronShort } from '$lib/bron/describe';
import { activityLine, rolesLine, citedLine } from './lines';
import { type Neighbor } from '$lib/api/nodes';
import { isDerived, lidOfMatch, plaatsVanMeta, positionsLabel } from './edge-meta';

/** What an implementation rests on (API 0.67), in words: EUR-Lex, the considerans, or both. */
const BASIS: Record<string, string> = {
	national_implementing_measure: 'uitvoeringsmaatregel volgens EUR-Lex',
	considerans: 'volgens de considerans'
};
export const basesLine = (bases: readonly string[] | null | undefined): string | null =>
	(bases ?? []).map((b) => BASIS[b] ?? b).join(', ') || null;

/**
 * What an implementation rests on, with the measures EUR-Lex names (`via`, API 0.76, BE-58).
 * A measure that also changes the law (`amending`, the publications of its AMENDS edges)
 * is a change to implement the act: "gewijzigd ter implementatie door Stb. 2013, 102".
 * Another, such as the law's own publication, is named as EUR-Lex has it, without a claim.
 */
export function implementationLine(
	link: {
		bases?: readonly string[] | null;
		via?: readonly { id: string; citation: string }[] | null;
	},
	amending: ReadonlySet<string>
): string | null {
	const via = link.via ?? [];
	if (via.length === 0) return basesLine(link.bases);
	const changed = via.filter((m) => amending.has(m.id));
	const other = via.filter((m) => !changed.includes(m));
	const cite = (ms: typeof via) => ms.map((m) => m.citation).join(' en ');
	return (
		[
			changed.length > 0 ? `gewijzigd ter implementatie door ${cite(changed)}` : null,
			other.length > 0 ? `uitvoeringsmaatregel ${cite(other)} volgens EUR-Lex` : null,
			link.bases?.includes('considerans') ? BASIS.considerans : null
		]
			.filter(Boolean)
			// A citation has a comma of its own (`Stb. 2013, 102`): the parts take a semicolon.
			.join('; ')
	);
}

/**
 * The judgments that cite an article or a law: newest first, or the most cited first (an
 * article: by the judgments citing them, API 0.73 BE-42; a law: by its articles they cite,
 * API 0.74 BE-47), so that the standard judgments stand on top (UX-15).
 */
export type JudgmentOrder = 'date' | 'cited';

/** What the reader chose for a loader: the order of the judgments, and of a law one year (BE-51). */
export type LoaderOptions = {
	order: JudgmentOrder;
	year: number | null;
	court: Court | null;
	/** A main area of law (API 0.80.7). */
	area: string | null;
};

export const DEFAULT_LOADER_OPTIONS: LoaderOptions = {
	order: 'date',
	year: null,
	court: null,
	area: null
};

/** The main areas of law an API counts, most first, without the judgments that name none. */
const areasOf = (
	facet: readonly { value?: string | null; count: number }[] | null | undefined
): { area: string; count: number }[] =>
	(facet ?? []).flatMap((f) => (f.value ? [{ area: f.value, count: f.count }] : []));

/**
 * The order a bron's groups start in: the judgments that cite an article the most cited first,
 * so the three a closed group shows are the standard judgments (besluit 32). A law's stay
 * newest first: the API's other order of a law (by the articles cited) takes over 30 s for
 * the Awb.
 */
export const startOptions = (collection: string): LoaderOptions =>
	collection === 'articles'
		? { ...DEFAULT_LOADER_OPTIONS, order: 'cited' }
		: DEFAULT_LOADER_OPTIONS;

export type LoaderContext = {
	node: Schema<'BaseNodeDTO'>;
	neighbors: Neighbor[];
	/** What the database holds per bucket; see `bucketTotals`. */
	totals: Map<string, number>;
	/**
	 * The rows of these buckets, up to 200 each: from `neighbors` where the node is whole,
	 * else asked bucket by bucket, so a kind can start from five per bucket.
	 */
	buren: (match: Match[]) => Promise<Neighbor[]>;
	signal: AbortSignal;
	options: LoaderOptions;
};

export type Loaded = {
	rows: Row[];
	total?: number;
	/** The places the bronnen name the selected one, where rows bundle several. */
	mentions?: number;
	/** Judgments another group shows, by its id: the ECHR's that cite an article (API 0.73). */
	judgmentsOf?: Record<string, { rows: Row[]; total: number }>;
	/** The years of all of a group's bronnen, where the API counts them (not only the rows). */
	years?: { year: number; count: number }[];
	/** The judgments per rechter, where the API counts them over the whole group. */
	courts?: Partial<Record<Court, number>>;
	/** The judgments per main area of law, where the API counts them over the whole group. */
	areas?: { area: string; count: number }[];
	/** The criteria of the filter the loader asked of the API: its total holds under them. */
	cutBy?: CutBy[];
	/** The rest of the rows, asked when the group is opened, the table or an export. */
	meer?: () => Promise<Loaded>;
	/** The rows with a page more, asked by "Meer laden" only: where the API holds more. */
	page?: () => Promise<Loaded>;
	/** Rows are missing that the API has (a further page failed): no total, shown as `12+`. */
	capped?: boolean;
};

/**
 * The ECHR judgments that cite an article, from its treaty's international links (HUDOC
 * names the article a judgment applies): all of them, not the few in the node response.
 */
async function echrJudgments(bwb: string, articleKey: string, signal: AbortSignal): Promise<Row[]> {
	const data = await abortable(ifExists(getEuLinks(bwb)), signal);
	return (data?.international ?? [])
		.filter((l) => l.judgment && l.own_article?.key === articleKey)
		.map((l) => {
			const j = l.judgment!;
			const props = { ecli: j.ecli };
			return {
				ref: { collection: 'judgments' as const, key: j.key },
				...describeBronShort('judgments', j.key, j.display_name, props, j.cite),
				filterGroup: filterGroupOf('judgments', j.key, props, 'REFERS_TO'),
				relation: 'REFERS_TO' as const,
				direction: 'inbound' as const,
				confidence: l.confidence ?? null,
				props
			};
		});
}

// The four dossier groups read one hub, one request; a failed or broken-off one is asked
// again (Opnieuw).
const hubOf = ({ node, neighbors, signal }: LoaderContext): Promise<DossierHub> => {
	const number = textOf(node.props?.label) ?? '';
	return abortable(
		once(`dossier-hub/${number}`, () => loadDossierHub(number, neighbors)),
		signal
	);
};

/**
 * The rows of the node's own buckets, where no route of the API says more of them: the
 * activities of a vote, the articles that refer to an article (with their aard from its
 * detail).
 */
async function uitBuren({ buren }: LoaderContext, match: Match[]): Promise<Row[]> {
	return (await buren(match))
		.filter((n) => match.some((m) => matches(m, n)))
		.map(rowOfNeighbor)
		.filter((r): r is Row => r !== null);
}

const bwbOf = (node: Schema<'BaseNodeDTO'>) =>
	typeof node.props?.bwb_id === 'string' ? node.props.bwb_id : null;

const articleNumberOf = (node: Schema<'BaseNodeDTO'>) =>
	typeof node.props?.article_number === 'string' ? node.props.article_number : null;

/**
 * The article and lid a stub `{law}_{article}_{lid}` stands for, or null for a stub
 * of a whole article.
 */
function lidOfStub(key: string, props: Record<string, unknown> | null | undefined) {
	const law = lawIdOf(props);
	const number = textOf(props?.article_number);
	if (!law || !number) return null;
	const own = `${law}_${number}`.toLowerCase().replace(/[:.\s-]/g, '_');
	const lid = key.toLowerCase().startsWith(`${own}_`) ? key.slice(own.length + 1) : null;
	return lid && /^\d+[a-z]*$/i.test(lid) ? { key: key.slice(0, own.length), lid } : null;
}

/** The votes of the Tweede Kamer on a dossier read at once: one page of the decision browser. */
const DECISIONS_SHOWN = 100;

/** The dossiers of a lid or fractie read at once: about 0.7 KB each. */
const DOSSIERS_SHOWN = 100;

/** The laws, open dossiers and open toezeggingen of a ministry read at once. */
const MINISTRY_SHOWN = 50;

/** The pages of `cited-by` read at most (CITED_BY_PAGE passages each). */
const CITED_BY_PAGES = 5;

/** The activities of a committee read at once: about 0.2 KB each. */
const ACTIVITIES_SHOWN = 200;

/** The articles of a law read at once, in the law's order, without their text. */
const ARTICLES_SHOWN = 100;
/** The publications that change a law the group shows; the rest are counted. */
const AMENDED_SHOWN = 30;

/** The judgments of a law read at once: about 1.2 KB each, for the articles they cite. */
const JUDGMENTS_SHOWN = LAW_JUDGMENTS;

/** The European and international links of a law read at once, per kind. */
const EU_LINKS_SHOWN = 50;
/** The most `eu-links` gives in one answer. */
const EU_LINKS_MAX = 2000;
/** The laws connected to a law by the references between their articles, read at once. */
const RELATED_SHOWN = 50;
/** The most `related-instruments` gives in one answer. */
const RELATED_MAX = 500;

/** The laws of a dossier whose own verbindingen are read for the international group. */
const MAX_LAWS = 3;

/**
 * The European and international instruments of the first `upto` laws of a dossier, and the
 * next `MAX_LAWS` laws by "Volgende" where there are more: no law is left unread silently.
 * Their European buckets, not their whole nodes (Wetboek van Strafrecht: 2 MB).
 */
async function internationalOfLaws(
	laws: readonly { ref: { key: string } }[],
	signal: AbortSignal,
	upto: number
): Promise<Loaded> {
	const found = await Promise.all(
		laws
			.slice(0, upto)
			.map((law) => getBuckets('instruments', law.ref.key, EUROPEAN.match ?? [], signal))
	);
	const rows = new Map<string, Row>();
	for (const neighbors of found) {
		const group = buildGroups('instruments', neighbors).find((g) => g.id === 'international');
		for (const row of group?.rows ?? []) rows.set(row.ref.key, { ...row, relation: undefined });
	}
	return {
		rows: [...rows.values()],
		page: laws.length > upto ? () => internationalOfLaws(laws, signal, upto + MAX_LAWS) : undefined
	};
}

/** The laws a member or a fractie has worked on, with the number of their documents. */
async function touched(
	who: 'members' | 'factions',
	key: string,
	signal: AbortSignal
): Promise<Loaded> {
	const found = await abortable(getTouchedInstruments(who, key), signal);
	return {
		rows: found.items.map((i) => ({
			ref: { collection: 'instruments', key: i.key },
			title: i.citation_title ?? i.title ?? naamVan('instruments', i),
			context: `${formatCount(i.count)} ${plural(i.count, 'stuk', 'stukken')}`,
			filterGroup: filterGroupOf('instruments', i.key, { bwb_id: i.bwb_id })
		}))
	};
}

/** The dossiers a lid or a fractie signed in, newest first, with their roles there. */
async function actorDossiers(
	who: 'members' | 'factions',
	key: string,
	signal: AbortSignal
): Promise<Loaded> {
	// A lid's dossiers are one record with the head of a bewindspersoon (`getMemberDossiers`).
	const found = await abortable(
		who === 'members'
			? getMemberDossiers(key, DOSSIERS_SHOWN)
			: getFactionDossiers(key, DOSSIERS_SHOWN),
		signal
	);
	// A lid who signed as more than a Kamerlid (a bewindspersoon) has each dossier say as what.
	const distinguish = found.items.some((d) =>
		((d as { capacities?: string[] }).capacities ?? []).some((c) => c !== 'kamerlid')
	);
	return {
		total: found.total,
		rows: found.items.map((d) => ({
			ref: { collection: 'dossiers' as const, key: d.key, number: d.number },
			...describeBron('dossiers', d.key, d.title, {
				title: d.title,
				short_title: d.short_title ?? null,
				label: d.number
			}),
			dossier: { number: d.number, title: d.title, short_title: d.short_title ?? null },
			context: rolesLine(d, distinguish),
			filterGroup: 'dossiers' as const,
			relation: 'AUTHORED' as const,
			direction: 'outbound' as const
		}))
	};
}

/** The pages of references with an aard a law loads at most: 1000 references. */
const AARD_PAGE = 200;
const AARD_PAGES = 5;

/**
 * A regulation issued under the article, as a row of Verbonden. Its line says its kind and
 * its grondslag (`AMvB op grond van lid 1 en 7`, hoe.ts), whether the Gelet op only names
 * the article (`basis_kind`), the articles that work it out (`referring`); the meta line
 * when it took effect.
 */
export function regelingRow(
	r: Pick<Regeling, 'instrument' | 'kind' | 'date_in_force'> &
		Partial<Pick<Regeling, 'basis_kind' | 'articles' | 'leden'>>
): Row {
	const i = r.instrument;
	const props = {
		bwb_id: i.bwb_id,
		citation_title: i.citation_title,
		title: i.title,
		kind: r.kind
	};
	return {
		ref: { collection: 'instruments', key: i.key },
		...describeBron('instruments', i.key, i.display_name, props),
		// The kind stands in the line (`AMvB op grond van`), not again under it.
		context: null,
		// Its day, not its BWB id: `in werking 15 aug. 2026` (Thijs, 13 Oct).
		identifier: r.date_in_force ? `in werking ${korteDatum(r.date_in_force)}` : null,
		date: r.date_in_force ?? null,
		lid: r.leden?.length === 1 ? r.leden[0] : null,
		filterGroup: filterGroupOf('instruments', i.key, props, 'BASED_ON'),
		relation: 'BASED_ON',
		direction: 'inbound',
		props,
		edge: {
			leden: r.leden ?? [],
			basis_kind: r.basis_kind ?? null,
			referring: r.articles ?? []
		}
	};
}

/** Articles once each, in their law's order: `2`, `3`, `17`, `18`. */
const opNummer = <A extends { article_number?: string | null }>(xs: readonly A[]): A[] =>
	[...new Map(xs.filter((a) => a.article_number).map((a) => [a.article_number, a])).values()].sort(
		(a, b) => NL.compare(a.article_number!, b.article_number!)
	);

/**
 * A regulation issued under the law, as a row of Verbonden: as one under an article
 * (regelingRow), its place the articles of the law its Gelet op names with their leden,
 * `art. 3, 16 lid 1 en 7`, a BW article with its book (`bwb` the law's id); its articles that
 * work them out; the other laws it rests on, under it. A map lists the same rows under a
 * kept law (map/verbonden.ts).
 */
export function wetRegelingRow(r: WetRegeling, bwb?: string | null): Row {
	const row = regelingRow({
		instrument: r.instrument,
		kind: r.kind,
		date_in_force: r.date_in_force,
		basis_kind: r.basis_kind
	});
	return {
		...row,
		context: medeOpGrondVan((r.also_based_on ?? []).map((w) => w.instrument)),
		position: grondslagArtikelen(r.articles, bwb),
		edge: {
			...row.edge,
			referring: opNummer((r.articles ?? []).flatMap((a) => a.referring ?? []))
		}
	};
}

/**
 * A regulation issued under a regulation under the law (`sub_delegated`), as a row under
 * that one: `Ministeriële regeling op grond van art. 19, 23, 28 Cyberbeveiligingsbesluit`.
 */
function onderRegelingRow(
	s: NonNullable<WetRegeling['sub_delegated']>[number],
	boven: WetRegeling
): Row {
	const row = regelingRow({
		instrument: s.instrument,
		kind: s.kind,
		date_in_force: s.date_in_force,
		basis_kind: s.basis_kind
	});
	const grondslag: Grondslag = {
		richting: 'via',
		kind: s.kind,
		basis: s.basis_kind,
		articles: s.articles ?? [],
		bwb: boven.instrument.bwb_id,
		wet: boven.instrument.citation_title ?? naamVan('instruments', boven.instrument)
	};
	return { ...row, onder: boven.instrument.key, edge: { ...row.edge, grondslag } };
}

/**
 * The regulations issued under a law, as rows, each regulation issued under one of them in
 * turn right under it: empty where it has none or the API says nothing. A regulation under
 * two of them stands under the first.
 */
export async function wetRegelingen(bwb: string): Promise<{ total: number; rows: Row[] }> {
	const found = await getLawDelegated(bwb);
	const items = found?.items ?? [];
	const eigen = new Set(items.map((r) => r.instrument.key));
	const gezien = new Set<string>();
	const rows = items.flatMap((r) => [
		wetRegelingRow(r, bwb),
		...(r.sub_delegated ?? [])
			.filter((s) => !eigen.has(s.instrument.key) && !gezien.has(s.instrument.key))
			.map((s) => (gezien.add(s.instrument.key), onderRegelingRow(s, r)))
	]);
	return { total: (found?.total ?? 0) + gezien.size, rows };
}

/**
 * A law the preamble of this regulation names (`/basis`), as a row of the group Grondslag:
 * `Op grond van art. 3, 16 lid 1 en 7`, the articles of this regulation that work it out.
 */
export function basisRow(b: Schema<'InstrumentBasisItem'>): Row {
	const i = b.instrument;
	const props = {
		bwb_id: i.bwb_id,
		citation_title: i.citation_title,
		title: i.title,
		kind: b.kind
	};
	const grondslag: Grondslag = {
		richting: 'outbound',
		basis: b.basis_kind,
		articles: b.articles ?? [],
		bwb: i.bwb_id
	};
	return {
		ref: { collection: 'instruments', key: i.key },
		...describeBron('instruments', i.key, i.display_name, props),
		context: kindName(b.kind),
		identifier: null,
		filterGroup: filterGroupOf('instruments', i.key, props),
		relation: 'BASED_ON',
		direction: 'outbound',
		props,
		edge: {
			grondslag,
			basis_kind: b.basis_kind ?? null,
			referring: opNummer((b.articles ?? []).flatMap((a) => a.referring ?? []))
		}
	};
}

/**
 * A law connected to this one (`bwb`) by the references between their articles, as a row:
 * its grondslag where one is issued under the other (`basis`), else how many articles in
 * force refer which way (`17 artikelen verwijzen naar deze wet`, hoe.ts), never its BWB id;
 * `dit` the selected law by its kind (`dit besluit`). Opened, it lists the references
 * (`.../references/{other}`). Verbonden and a map list the same rows.
 */
export function wetRijVanRelated(
	i: Schema<'InstrumentRelatedItem'>,
	bwb?: string | null,
	dit?: string | null
): Row {
	const props = {
		bwb_id: i.bwb_id,
		celex: i.celex,
		citation_title: i.citation_title,
		kind: i.kind
	};
	const b = i.basis;
	const grondslag: Grondslag | null = b
		? {
				richting:
					b.direction === 'via' ? 'via' : b.direction === 'outbound' ? 'outbound' : 'inbound',
				kind: i.kind,
				articles: b.articles ?? [],
				// The articles are of this law (inbound), of the other (outbound), or of `via`.
				bwb: b.direction === 'via' ? b.via?.bwb_id : b.direction === 'outbound' ? i.bwb_id : bwb,
				wet:
					b.direction === 'via' && b.via
						? (b.via.citation_title ?? naamVan('instruments', b.via))
						: null
			}
		: null;
	return {
		ref: { collection: 'instruments', key: i.key },
		title: i.citation_title ?? naamVan('instruments', i),
		context: grondslag ? null : kindName(i.kind),
		// Its day as a regulation's: `in werking 1 okt. 2024` (regelingRow).
		identifier: i.date_in_force ? `in werking ${korteDatum(i.date_in_force)}` : null,
		date: i.date_in_force ?? null,
		filterGroup: filterGroupOf('instruments', i.key, props),
		relation: 'REFERS_TO',
		// Which way its articles refer, as the API says; both ways count as towards this law.
		direction: i.direction === 'outbound' ? 'outbound' : 'inbound',
		edge: {
			inbound_count: i.inbound_count,
			outbound_count: i.outbound_count,
			grondslag,
			dit: dit ?? null,
			van: bwb ?? null
		},
		props
	};
}

export const LOADERS: Record<Loader, (ctx: LoaderContext) => Promise<Loaded>> = {
	// The wet that came from the dossier and its publication. The laws it changes stand once,
	// above the reader (Wijzigt) and under Gewijzigde artikelen (Thijs, 10 Oct: "single count").
	'dossier-laws': async (ctx) => ({
		rows: (await hubOf(ctx)).laws.filter((r) => r.relation === 'LEGISLATED_IN')
	}),
	// The votes of the Tweede Kamer on the dossier's zaken but its amendementen: the reader
	// lists those with their votes (Amendementen). One page of the decision browser, newest
	// first; its count per kind gives the total (Thijs, 10 Oct: "everything other then
	// amendments can stay, if it is only amendments: remove").
	'dossier-decisions-tk': async ({ node, signal }) => {
		const label = textOf(node.props?.label);
		if (!label) return { rows: [] };
		// Its total is the count per kind: the counted answer (API 0.79.41, decisions.ts).
		const page = await geteld({ dossier: label, chamber: 'TK', limit: DECISIONS_SHOWN }, signal);
		const rows = page.items
			.filter((d) => motionOrAmendment(d.kind) !== 'amendement')
			.map(
				(d): Row => ({
					ref: { collection: 'decisions', key: d.key },
					...describeBron('decisions', d.key, d.display_name, { ...d }),
					filterGroup: filterGroupOf('decisions', d.key, { ...d }),
					relation: 'ABOUT',
					direction: 'inbound',
					props: { ...d }
				})
			);
		const kinds = page.facets?.kind;
		const total = kinds
			? kinds
					.filter((k) => motionOrAmendment(k.value) !== 'amendement')
					.reduce((n, k) => n + k.count, 0)
			: rows.length;
		return { rows, total };
	},
	'dossier-committees': async (ctx) => ({
		rows: (await hubOf(ctx)).committees
	}),
	'dossier-documents-tk': async (ctx) => {
		const hub = await hubOf(ctx);
		return { rows: hub.tweedeKamer, total: hub.tkTotal };
	},
	'dossier-documents-ek': async (ctx) => ({
		rows: (await hubOf(ctx)).eersteKamer
	}),

	// The other dossiers of the number, in the order of the Kamer.
	// The papers of the same zaak, the substance first (./zaak).
	'document-same-case': async ({ node, buren, signal }) =>
		naastHetStuk(
			node.props?.kind,
			await stukkenInDezelfdeZaak(
				node,
				signal,
				await buren([{ relation: 'PART_OF', direction: 'outbound', collection: 'cases' }])
			)
		),

	'dossier-same-number': async ({ node, signal }) => {
		const label = textOf(node.props?.label);
		if (!label || !node.props?.same_number_count) return { rows: [] };
		const found = await abortable(getDossiersOfNumber(numberOf(label)), signal);
		return {
			rows: found.items
				.filter((d) => d.number !== label)
				.map((d) => ({
					ref: { collection: 'dossiers', key: d.key, number: d.number },
					...describeBron('dossiers', d.key, d.title, {
						title: d.title,
						short_title: d.short_title ?? null,
						label: d.number
					}),
					dossier: { number: d.number, title: d.title, short_title: d.short_title ?? null },
					filterGroup: 'dossiers' as const
				}))
		};
	},

	// TODO(backend B1, B9): the European and international instruments of a dossier are
	// those of its laws, read from the node of each law.
	'dossier-international': async (ctx) => {
		const { laws } = await hubOf(ctx);
		// A law the dataset lacks (`missing`: named in the title, not loaded) has no node to ask.
		return internationalOfLaws(
			laws.filter((law) => !law.missing),
			ctx.signal,
			MAX_LAWS
		);
	},

	'article-explanatory': async ({ node }) => {
		const bwb = bwbOf(node);
		const number = articleNumberOf(node);
		return { rows: bwb && number ? await explanatoryDocuments(bwb, number) : [] };
	},

	// The regulations issued under an article, from `.../delegated`: its kind and the day it
	// took effect, the lid its Gelet op names.
	'article-delegated': async ({ node }) => {
		const bwb = bwbOf(node);
		const number = articleNumberOf(node);
		const found = bwb && number ? await getDelegated(bwb, number) : null;
		return { total: found?.total ?? 0, rows: (found?.items ?? []).map(regelingRow) };
	},

	// The judgments that cite an article, each at the overweging that does (`cited-by`),
	// counted as the API counts them: passages and judgments (`judgment_total`, 0.62).
	'article-judgments': async ({ node, signal, options }) => {
		const bwb = bwbOf(node);
		const number = articleNumberOf(node);
		if (!bwb || !number) return { rows: [] };
		const sort = options.order === 'cited' ? ('citation_count' as const) : ('date_desc' as const);
		// The year and the rechter of the bronfilter are asked of the API: its totals and its
		// facets then count the whole group, not the page that was loaded.
		const tier = options.court ? tiersOfCourt(options.court) : undefined;
		const query = {
			limit: CITED_BY_PAGE,
			sort,
			...(options.year ? { year: String(options.year) } : {}),
			...(options.area ? { subject_area: options.area } : {}),
			...(tier?.length ? { tier: tier as Schema<'Tier'>[] } : {})
		};
		const page = (offset: number) =>
			abortable(getCitedBy(bwb, number, { ...query, offset }), signal);
		const data = await ifExists(page(0));
		if (!data) return { rows: [] };
		// An API without facets (before 0.81) ignores year and tier: the filter then cuts the rows.
		const counted = data.facets != null;
		const years = (data.facets?.year ?? []).flatMap((f) =>
			f.value ? [{ year: Number(f.value), count: f.count }] : []
		);
		const courts: Partial<Record<Court, number>> = {};
		for (const f of data.facets?.tier ?? []) {
			const c = courtOfTier(f.value);
			if (c) courts[c] = (courts[c] ?? 0) + f.count;
		}
		const facets = counted
			? {
					years,
					courts,
					areas: areasOf(data.facets?.subject_area),
					cutBy: ['jaar', 'rechter', 'area'] as CutBy[]
				}
			: {};
		// The ECHR judgments are no passage (HUDOC names the article, not the place): they
		// stand in Europees en internationaal, not here (BE-9).
		const judgmentsOf =
			data.echr_judgment_total > 0
				? {
						international: {
							// Another group's rows: this group stands without them.
							rows: await echrJudgments(bwb, node.key, signal).catch(
								(e) => (report('Verbonden: EHRM-uitspraken', e), [])
							),
							total: data.echr_judgment_total
						}
					}
				: undefined;
		const straf = isStrafGroep(options.area, data.facets?.subject_area, data.judgment_total);
		// One row per judgment; each overweging that cites the article is a mention.
		const loaded = (items: typeof data.items): Loaded => ({
			rows: rowsOfCitedBy(items, options.order === 'cited', straf),
			total: data.judgment_total,
			mentions: data.total,
			judgmentsOf,
			...facets,
			// A page of passages more by "Meer laden", where the API has judgments still (T11:
			// 3.556 counted, 705 shown).
			page:
				items.length < data.total && judgments(items) < data.judgment_total
					? async () => {
							const next = await page(items.length);
							return next.items.length
								? loaded([...items, ...next.items])
								: { ...loaded(items), page: undefined };
						}
					: undefined
		});
		const first = [...data.items];
		const judgments = (items: typeof first) => new Set(items.map((item) => item.judgment.key)).size;
		const complete = (items: typeof first) =>
			items.length >= data.total ||
			items.length >= CITED_BY_PAGE * CITED_BY_PAGES ||
			judgments(items) >= data.judgment_total;
		// The first page now; the others when the group is opened (Thijs, 9 Oct: "alles zo lazy
		// mogelijk"). 3:4 Awb on prod: five pages, 1 MB, the last after 6 s.
		return {
			...loaded(first),
			meer: complete(first)
				? undefined
				: async () => {
						// The passages page by page, one after the other, until every judgment is in:
						// 6:162 BW has 624 passages in 250 judgments, the first 200 only in 119.
						const items = [...first];
						while (!complete(items)) {
							const next = await page(items.length);
							if (next.items.length === 0) break;
							items.push(...next.items);
						}
						return loaded(items);
					}
		};
	},

	// The articles that refer to this one: the node's own edges, with the lid they name and the
	// aard of the reference from the article's detail (`downstream_implications`); without it,
	// the lid read from the phrase. The edge of the node carries no aard (B6).
	'article-cited-by': async (ctx) => {
		const { node, totals, signal } = ctx;
		const bwb = bwbOf(node);
		const number = articleNumberOf(node);
		const [fromNode, detail] = await Promise.all([
			uitBuren(ctx, [
				{ relation: ['REFERS_TO', 'BASED_ON'], direction: 'inbound', collection: 'articles' }
			]),
			bwb && number ? ifExists(abortable(getArticleDetail(bwb, number), signal)) : null
		]);
		const total =
			(totals.get(bucketKey('REFERS_TO', 'articles', 'inbound')) ?? 0) +
				(totals.get(bucketKey('BASED_ON', 'articles', 'inbound')) ?? 0) || undefined;
		const byKey = new Map(fromNode.map((r) => [r.ref.key, r]));
		for (const rel of detail?.downstream_implications ?? []) {
			const t = rel.target_article;
			const row = byKey.get(t.key) ?? {
				ref: { collection: 'articles' as const, key: t.key },
				title: naamVan('articles', t),
				context: null,
				filterGroup: filterGroupOf('articles', t.key, { bwb_id: t.bwb_id, celex: t.celex }),
				relation: 'REFERS_TO' as const,
				direction: 'inbound' as const,
				props: { ...t }
			};
			byKey.set(t.key, {
				...row,
				lid: rel.leden?.[0] ?? row.lid ?? lidOfMatch(rel.text),
				aard: aardOf(rel.semantic_type, rel.semantic_confidence) ?? row.aard ?? null,
				match: rel.text ?? row.match ?? null,
				edgeId: rel.edge_id ?? row.edgeId ?? null,
				confidence: rel.confidence ?? row.confidence ?? null,
				derived: rel.confidence != null ? isDerived(rel.confidence) : row.derived
			});
		}
		return { rows: [...byKey.values()], total };
	},

	// The changes of an article, enacted and proposed, each with its dossier and date
	// (`legislative-history`).
	'article-changes': async ({ node, signal }) => {
		const bwb = bwbOf(node);
		const number = articleNumberOf(node);
		const found =
			bwb && number ? await ifExists(abortable(getLegislativeHistory(bwb, number), signal)) : null;
		return {
			total: found?.total ?? 0,
			rows: uniqueRows(
				(found?.entries ?? []).flatMap((e) => {
					const row = historyRow(e);
					return row ? [row] : [];
				})
			)
		};
	},

	// The European and international instruments of a law (`eu-links`).
	'instrument-international': ({ node, signal }) => euLinks(node, signal, EU_LINKS_SHOWN),

	// TODO(backend B7): the lid a judgment cites is not a field. Where the citation
	// pipeline made a stub article `{law}_{article}_{lid}`, the lid is in the key; else it
	// is read from the citation spans of the paragraphs.
	'judgment-articles': async ({ node, buren, signal }) => {
		const ecli = typeof node.props?.ecli === 'string' ? node.props.ecli : node.key;
		const match: Match = { relation: 'REFERS_TO', direction: 'outbound', collection: 'articles' };
		const [detail, neighbors] = await Promise.all([
			ifExists(abortable(getJudgmentDetail(ecli), signal)),
			buren([match])
		]);
		const fromSpans = new Map<string, string>();
		let uitspraak: Uitspraak | null = null;
		// Where the judgment cites each article: its overwegingen, from the detail asked anyway
		// (Thijs, 10 Oct: the r.o. in the row). The edge's `paragraphs` take over once the API
		// gives them.
		const overwegingen = new Map<string, string[]>();
		for (const p of detail?.judgment.paragraphs ?? []) {
			for (const c of p.citations ?? []) {
				if (c.target.collection !== 'articles') continue;
				if (p.number) {
					const of = overwegingen.get(c.target.key) ?? [];
					if (!of.includes(p.number)) overwegingen.set(c.target.key, [...of, p.number]);
				}
				if (fromSpans.has(c.target.key) || c.end == null) continue;
				const anchor = anchorOf(parseQualifier(c.text ?? '', p.text.slice(c.end, c.end + 80)));
				if (anchor) fromSpans.set(c.target.key, anchor);
			}
		}
		const cited = neighbors.filter((n) => matches(match, n));
		const names = get(instrumentMetaStore);
		const rows = new Map<string, Row>();
		for (const n of cited) {
			const stub = n.props?.stub ? lidOfStub(n.key, n.props) : null;
			const key = stub ? stub.key : n.key;
			const at = stub ? lidAnchor(stub.lid) : fromSpans.get(n.key);
			const row = rowOfNeighbor(n);
			if (!row) continue;
			if (n.props?.stub) {
				const real = stub ? cited.find((c) => c.key === key) : n;
				const lawId = lawIdOf(n.props);
				const law = lawId ? names.get(lawId) : null;
				const number = textOf(n.props.article_number) || key.slice(key.indexOf('_') + 1);
				row.ref = { collection: 'articles', key };
				// As the API names an article: `Artikel 3 Regeling …`, from its citation record.
				const title = lawName(law, '');
				row.title =
					real?.display_name ??
					(title
						? citationRecord({
								kind: 'article',
								bwbId: lawId,
								articleNumber: number,
								shortTitle: law?.shortTitle ?? null,
								citationTitle: title
							}).heading
						: (articleName(lawId, number) ?? number));
				row.derived = false;
			}
			if (at) {
				row.at = at;
				row.position = anchorLabel(at);
				// rowOfNeighbor only reads the lid for an inbound relation; this one is
				// outbound (judgment → article), so the anchor is the only source of it.
				const place = parseAnchor(at);
				if (place?.kind === 'part' && place.lid) row.lid = place.lid;
				if (!stub) row.derived = true;
			}
			// Its places as this judgment cites them (`onder 3` in a conclusion): the edge's
			// paragraphs, else the overwegingen of the detail.
			const ro = plaatsVanMeta(n.meta, ecli).position;
			const uitDetail = overwegingen.get(n.key);
			if (ro) row.position = ro;
			else if (uitDetail?.length)
				row.position = positionsLabel(uitDetail.map((nr) => paragraphCite(ecli, nr)));
			// The passage that cites it, from the citations the API found in the paragraphs the reader
			// has loaded (Thijs, 13 Oct): the words of the span, so `art. 3:305a BW` for `305a`.
			const aangehaald = detail?.cited_articles?.find(
				(c) => c.article.key === n.key || c.article.key === key
			);
			const passage = aangehaald
				? aanhalingIn(aangehaald, detail?.judgment.paragraphs ?? [], [n.key, key])
				: null;
			if (passage) {
				row.snippet = passage.snippet;
				row.match = passage.match;
				row.passageAt = passage.at;
				if (passage.noot && detail) {
					// In a note: the overweging that refers to it, and the note with it (`r.o. 5.7.6
					// (voetnoot 35)`), so the line, its card and Lees open the note.
					uitspraak ??= legUit(detail.judgment);
					const r = overwegingVanNoot(uitspraak, passage.noot);
					if (r) {
						row.passageAt = r.at;
						row.noot = { id: r.id, label: passage.noot };
						row.position = metVoetnoot(r.num ? paragraphCite(ecli, r.num) : null, passage.noot);
					}
				}
			}
			const id = `${key}#${at ?? ''}`;
			if (!rows.has(id)) rows.set(id, row);
		}
		// Then the articles of laws the dataset lacks: Artikel 3 Opiumwet (API 0.70).
		return {
			rows: [...rows.values(), ...unresolvedRows(detail?.judgment.unresolved_citations ?? [])]
		};
	},

	// The references from this law's articles that carry an aard (voorwaarde,
	// uitzondering, definitie, procedure, reikwijdte, delegatie): one row per reference,
	// the citing article as the bron. A plain cross-reference is left out.
	'instrument-aard': async ({ node, signal }) => {
		const bwb = bwbOf(node);
		if (!bwb) return { rows: [] };
		// Every aard but the plain cross-reference, a page of 200 at a time.
		const page = (offset: number) =>
			abortable(getRelationshipsWithAard(bwb.toUpperCase(), AARD_PAGE, offset), signal);
		const first = await page(0);
		// A further page that fails leaves the group with what came, marked as more to come.
		const rest = await Promise.all(
			Array.from({ length: Math.min(Math.ceil(first.total / AARD_PAGE), AARD_PAGES) - 1 }, (_, i) =>
				page((i + 1) * AARD_PAGE).catch((e) => {
					report('Verbonden instrument-aard', e);
					return null;
				})
			)
		);
		const found = [first, ...rest];
		const partial = rest.includes(null);
		const rows = new Map<string, Row>();
		for (const r of found.flatMap((f) => f?.relationships ?? [])) {
			const from = r.source_article;
			const to = r.target_article;
			if (!from || rows.has(r.edge_id)) continue;
			const sameLaw = to?.bwb_id && to.bwb_id === from.bwb_id;
			// The article it refers to as it is cited, a BW one with its book: `art. 7:50a`,
			// `art. 6:214 BW` (hoe.ts: `Verwijst naar art. 7:50a, als voorwaarde`).
			const target = to
				? sameLaw && to.article_number
					? articleRef(to.bwb_id, to.article_number)
					: to.display_name
						? withBook(to.display_name).replace(/^Artikel /, 'art. ')
						: to.article_number
							? articleRef(to.bwb_id, to.article_number)
							: null
				: null;
			rows.set(r.edge_id, {
				ref: { collection: 'articles', key: from.key },
				title: articleName(from.bwb_id ?? bwb, from.article_number) ?? naamVan('articles', from),
				context: null,
				edge: target ? { doel: target } : {},
				filterGroup: 'artikelen',
				// The aard says how sure it is; the reference itself is in the BWB (1.0).
				aard: aardOf(r.semantic_type, r.semantic_confidence),
				relation: 'REFERS_TO',
				direction: 'outbound',
				edgeId: r.edge_id,
				confidence: r.confidence ?? null,
				derived: isDerived(r.confidence)
			});
		}
		const order = (row: Row) => row.title;
		return {
			rows: [...rows.values()].sort(
				(a, b) => (a.aard ?? '').localeCompare(b.aard ?? '', 'nl') || NL.compare(order(a), order(b))
			),
			...(partial ? { capped: true } : { total: first.total })
		};
	},

	// The regulations whose Gelet op names an article of the law (`/delegated`, API 0.79.52),
	// each with those issued under it in turn (`sub_delegated`, 0.79.55).
	'instrument-delegated': async ({ node, signal }) => {
		const bwb = bwbOf(node);
		return bwb ? abortable(wetRegelingen(bwb), signal) : { rows: [] };
	},

	// The laws the preamble of this regulation names (`/basis`): its grondslag. Asked only
	// where the node counts BASED_ON edges of its own.
	'instrument-basis': async ({ node, totals, signal }) => {
		const bwb = bwbOf(node);
		if (!bwb || totals.get(bucketKey('BASED_ON', 'articles', 'outbound')) === 0)
			return { rows: [] };
		const found = await abortable(getLawBasis(bwb), signal);
		return { total: found?.total ?? 0, rows: (found?.items ?? []).map(basisRow) };
	},

	// The laws whose articles refer to this law's articles, or the other way round, which way
	// counted on the row (`17 artikelen verwijzen naar deze wet`, hoe.ts). One issued under the
	// other (`basis`) stands under Uitvoeringsregelingen or Grondslag, and not here again.
	'instrument-related': ({ node, signal }) => relatedLaws(node, signal, RELATED_SHOWN),

	'instrument-dossiers': async ({ node, signal }) => {
		const bwb = bwbOf(node);
		if (!bwb) return { rows: [] };
		const found = await abortable(getInstrumentDossiers(bwb), signal);
		return {
			total: found.total,
			rows: found.items.map((d) => ({
				ref: { collection: 'dossiers', key: d.key, number: d.dossier_number },
				...describeBron('dossiers', d.key, d.display_name, {
					title: d.title,
					label: d.dossier_number,
					short_title: d.short_title ?? null
				}),
				dossier: { number: d.dossier_number, title: d.title, short_title: d.short_title ?? null },
				filterGroup: 'dossiers' as const,
				relation: 'LEGISLATED_IN',
				direction: 'outbound',
				// The dossier that made the law, or one whose publication amended it.
				edge: { via: d.via, publication: d.publication ?? null }
			}))
		};
	},

	'instrument-amended-by': ({ node, signal }) => amendingPublications(node, signal, AMENDED_SHOWN),

	// The pending proposals to change this law, newest first (API 0.79.55): the same answer
	// as the publications above, asked once.
	'instrument-proposals': async ({ node, signal }) => {
		const bwb = bwbOf(node);
		if (!bwb) return { rows: [] };
		const found = await abortable(getAmendedBy(bwb), signal);
		return {
			total: found.proposals_total,
			rows: (found.proposals ?? []).map((p): Row => {
				const dossier = p.dossiers?.[0];
				// Its own subject, without the citation and kind the display name opens with
				// ("Kamerstuk 35501, nr. 49. Amendement: …"); a bill by the name of its dossier.
				const onderwerp = (p.display_name ?? '')
					.replace(/^Kamerstuk [^.]+?, nr\. [^.]+\.\s*/, '')
					.replace(/^[^:]{1,60}:\s*/, '');
				const props = {
					kind: p.kind ?? null,
					title: onderwerp || null,
					sequence: p.number ?? null,
					dossier_number: dossier?.number ?? null,
					dossier_short_title: dossier?.short_title ?? null,
					date: p.date ?? null,
					outcome: p.outcome ?? null
				};
				const wetsvoorstel = isBill(p.kind) && !!dossier;
				// A bill: titled by its dossier's name, its kind and number under it.
				const stuk = describeBron('documents', p.key, p.display_name ?? null, {
					...props,
					title: null,
					dossier_short_title: null
				}).title;
				return {
					ref: { collection: 'documents' as const, key: p.key },
					...describeBron('documents', p.key, p.display_name ?? null, props),
					...(wetsvoorstel && dossier
						? {
								title: dossier.short_title?.trim() || dossier.title?.trim() || stuk,
								context: stuk,
								dossier: {
									number: dossier.number,
									title: dossier.title ?? null,
									short_title: dossier.short_title ?? null
								}
							}
						: {}),
					filterGroup: filterGroupOf('documents', p.key, props, 'AMENDS'),
					stuksoort: stuksoortOf(props, 'AMENDS'),
					relation: 'AMENDS' as const,
					direction: 'inbound' as const,
					props
				};
			})
		};
	},

	// What a vote was on: the Kamerstuk itself (`primary_document` of the decision, the reader's
	// own answer), which opens on its text in place, then the activity; the zaak only where the
	// vote names no stuk (a bill, a vote of the Eerste Kamer).
	'decision-subject': async (ctx) => {
		const { node, signal } = ctx;
		const [d, rows] = await Promise.all([
			ifExists(abortable(getDecision(node.key), signal)),
			uitBuren(ctx, [
				{
					relation: ['ABOUT', 'MADE_IN'],
					direction: 'outbound',
					collection: ['documents', 'cases', 'activities']
				}
			])
		]);
		const p = d?.primary_document;
		if (!p) return { rows };
		const props = {
			kind: p.kind ?? null,
			title: p.title ?? null,
			sequence: p.number ?? null,
			dossier_number: p.dossier_number ?? null,
			date: p.date ?? null,
			dictum: d.dictum ?? null
		};
		const stuk: Row = {
			ref: { collection: 'documents', key: p.key },
			...describeBron('documents', p.key, p.title ?? null, props),
			filterGroup: filterGroupOf('documents', p.key, props, 'ABOUT'),
			stuksoort: stuksoortOf(props, 'ABOUT'),
			relation: 'ABOUT',
			direction: 'outbound',
			props
		};
		return {
			rows: [stuk, ...rows.filter((r) => r.ref.collection === 'activities')]
		};
	},

	// The articles of this law in the law's own order, as the reader has them: the node
	// response holds a sample in no order (Richtlijn 2017/1132 began with 27, 126, 10).
	'instrument-articles': async ({ node, signal }) => {
		const law = lawIdOf(node.props);
		// The law's whole list, which the reader's table of contents asks for too.
		const found = law ? await ifExists(abortable(lawArticleList(law), signal)) : null;
		if (!law || !found) return { rows: [] };
		return {
			total: found.total,
			rows: found.items.slice(0, ARTICLES_SHOWN).map((a) => ({
				ref: refOf('articles', a.key, a),
				...describeBron('articles', a.key, a.display_name, a),
				// Within its law an article is "Artikel 1", not the law's title again (Thijs, 9 Oct).
				title:
					articleName(law, a.article_number, a.label) ??
					describeBron('articles', a.key, a.display_name, a).title,
				filterGroup: 'artikelen' as const,
				relation: 'PART_OF' as const,
				direction: 'inbound' as const
			}))
		};
	},

	// The judgments that cite this law, each with the articles it cites; the total is the
	// API's, where the node response stops at 30.
	'instrument-judgments': ({ node, signal, options }) => lawJudgments(node, signal, options, [], 0),

	'member-dossiers': ({ node, signal }) => actorDossiers('members', node.key, signal),
	'faction-dossiers': ({ node, signal }) => actorDossiers('factions', node.key, signal),
	'member-instruments': ({ node, signal }) => touched('members', node.key, signal),
	'faction-instruments': ({ node, signal }) => touched('factions', node.key, signal),

	// The debates and hearings a committee leads, newest first, with the API's total and
	// the dossiers on their agenda.
	'committee-activities': async ({ node, signal }) => {
		const slug = typeof node.props?.slug === 'string' ? node.props.slug : null;
		const found = slug
			? await ifExists(abortable(getCommitteeActivities(slug, ACTIVITIES_SHOWN), signal))
			: null;
		if (!found) return { rows: [] };
		return {
			total: found.total,
			rows: found.items.map((a) => ({
				ref: { collection: 'activities' as const, key: a.key },
				...describeBron('activities', a.key, a.agenda_title, { ...a }),
				context: activityLine(a),
				filterGroup: filterGroupOf('activities', a.key, {}),
				relation: 'LED_BY' as const,
				direction: 'inbound' as const
			}))
		};
	},

	// What is a ministry's own, from the lists under `ministry=`: its laws (first responsible),
	// its open dossiers and its open toezeggingen, each with the list's total.
	'ministry-laws': async ({ node, signal }) => {
		const ministry = choiceOf(node.key, MINISTRY_KEYS);
		if (!ministry) return { rows: [] };
		const found = await abortable(
			getInstruments({ ministry, limit: MINISTRY_SHOWN, facets: false }, signal),
			signal
		);
		return {
			total: found.total,
			rows: found.items.map((i) => {
				const props = { citation_title: i.citation_title, title: i.title, kind: i.kind };
				return {
					ref: { collection: 'instruments' as const, key: i.key },
					...describeBron('instruments', i.key, i.display_name, props),
					filterGroup: filterGroupOf('instruments', i.key, props)
				};
			})
		};
	},

	'ministry-dossiers': async ({ node, signal }) => {
		const ministry = choiceOf(node.key, MINISTRY_KEYS);
		if (!ministry) return { rows: [] };
		const found = await abortable(
			getFacetedList(
				'/api/dossiers',
				{ ministry, status: 'open', limit: MINISTRY_SHOWN, offset: 0, facets: false },
				signal
			),
			signal
		);
		return {
			total: found.total,
			rows: found.items.map((d) => {
				const title = d.short_title ?? d.title;
				return {
					ref: { collection: 'dossiers' as const, key: d.key, number: d.number },
					...describeBron('dossiers', d.key, title, { title, label: d.number }),
					filterGroup: 'dossiers' as const
				};
			})
		};
	},

	'ministry-commitments': async ({ node, signal }) => {
		const ministry = choiceOf(node.key, MINISTRY_KEYS);
		if (!ministry) return { rows: [] };
		const found = await abortable(
			getCommitments(
				{ ministry, status: OPEN_STATUS, limit: MINISTRY_SHOWN, facets: false },
				signal
			),
			signal
		);
		return {
			total: found.total,
			rows: found.items.map((c) => ({
				ref: { collection: 'commitments' as const, key: c.key },
				...describeBron('commitments', c.key, c.text, { number: c.number, text: c.text }),
				context: korteDatum(c.date),
				filterGroup: filterGroupOf('commitments', c.key, {})
			}))
		};
	},

	'committee-dossiers': async ({ node, signal }) => {
		const slug = typeof node.props?.slug === 'string' ? node.props.slug : null;
		if (!slug) return { rows: [] };
		const committee = await abortable(getCommittee(slug), signal);
		return {
			total: committee.active_dossier_count,
			rows: (committee.dossiers ?? []).map((d) => ({
				ref: { collection: 'dossiers', key: d.key, number: d.number },
				...describeBron('dossiers', d.key, d.title, { title: d.title, label: d.number }),
				filterGroup: 'dossiers' as const
			}))
		};
	}
};

/**
 * The European and international instruments of a law (`eu-links`), by importance: the
 * first `limit`, and where the API has more, the next fifty by "Meer laden" (the endpoint
 * pages by its limit only).
 */
async function euLinks(
	node: LoaderContext['node'],
	signal: AbortSignal,
	limit: number
): Promise<Loaded> {
	const data = await ifExists(abortable(getEuLinks(node.key, limit, 'importance'), signal));
	if (!data) return { rows: [] };
	const rows = new Map<string, Row>();
	const add = (row: Row) => {
		if (!rows.has(row.ref.key)) rows.set(row.ref.key, row);
	};
	const implemented = data.implements ?? [];
	// Which of the measures EUR-Lex names change this law: its AMENDS publications.
	const bwb = bwbOf(node);
	const amending =
		bwb && implemented.some((link) => (link.via ?? []).length > 0)
			? new Set((await abortable(getAmendedBy(bwb), signal)).items.map((d) => d.id))
			: new Set<string>();
	for (const link of [...implemented, ...(data.implemented_by ?? [])]) {
		const i = link.instrument;
		add({
			ref: { collection: 'instruments', key: i.key },
			title: i.citation_title ?? i.title ?? naamVan('instruments', i),
			// The other way round (a directive and the laws that implement it), this law's
			// AMENDS publications are not the ones to test: the measures stand as EUR-Lex has them.
			context: implementationLine(link, implemented.includes(link) ? amending : new Set<string>()),
			filterGroup: 'internationaal',
			derived: isDerived(link.confidence),
			relation: 'IMPLEMENTS',
			direction: implemented.includes(link) ? 'outbound' : 'inbound'
		});
	}
	// An act the text names by its CELEX number without implementing it (API 0.67).
	const mentions = data.mentions ?? [];
	for (const link of [...mentions, ...(data.mentioned_by ?? [])]) {
		const i = link.instrument;
		add({
			ref: { collection: 'instruments', key: i.key },
			title: i.citation_title ?? i.title ?? naamVan('instruments', i),
			// The line says it: `Genoemd`, `Noemt` (hoe.ts), not "Aangehaald" with "alleen genoemd".
			context: null,
			filterGroup: 'internationaal',
			derived: isDerived(link.confidence),
			relation: 'REFERS_TO',
			direction: mentions.includes(link) ? 'outbound' : 'inbound'
		});
	}
	for (const link of data.international ?? []) {
		if (link.instrument) {
			add({
				ref: { collection: 'instruments', key: link.instrument.key },
				title:
					link.instrument.citation_title ??
					link.instrument.title ??
					naamVan('instruments', link.instrument),
				context: null,
				filterGroup: 'internationaal',
				derived: isDerived(link.confidence)
			});
		} else if (link.judgment) {
			const j = link.judgment;
			add({
				ref: { collection: 'judgments', key: j.key },
				...describeBronShort('judgments', j.key, j.display_name, { ...j }, j.cite),
				filterGroup: 'internationaal',
				derived: isDerived(link.confidence)
			});
		}
	}
	const total =
		(data.implements_total ?? 0) +
		(data.implemented_by_total ?? 0) +
		(data.mentions_total ?? 0) +
		(data.mentioned_by_total ?? 0) +
		(data.international_total ?? 0);
	const shown = [...rows.values()];
	return {
		rows: shown,
		total,
		page:
			shown.length < total && limit < EU_LINKS_MAX
				? () => euLinks(node, signal, Math.min(limit + EU_LINKS_SHOWN, EU_LINKS_MAX))
				: undefined
	};
}

/**
 * The laws whose articles refer to this law's articles, or the other way round: the first
 * `limit`, and the next fifty by "Meer laden" (the endpoint pages by its limit only).
 */
async function relatedLaws(
	node: LoaderContext['node'],
	signal: AbortSignal,
	limit: number
): Promise<Loaded> {
	const bwb = bwbOf(node);
	if (!bwb) return { rows: [] };
	const found = await abortable(getRelatedInstruments(bwb, limit), signal);
	const items = found.items.filter((i) => !i.basis);
	const dit = ditVan(node.props);
	return {
		total: found.total - (found.items.length - items.length),
		rows: items.map((i) => wetRijVanRelated(i, bwb, dit)),
		page:
			found.items.length < found.total && limit < RELATED_MAX
				? () => relatedLaws(node, signal, Math.min(limit + RELATED_SHOWN, RELATED_MAX))
				: undefined
	};
}

/**
 * The publications that amend a law (`/amended-by`, asked once whole): `shown` of them, and
 * thirty more by "Meer laden". An amending instrument is a publication
 * (`instruments/stb_2026_94`), named by its display name: `Stb. 2026, 94`. Its identifier is
 * its key, not a second name.
 */
async function amendingPublications(
	node: LoaderContext['node'],
	signal: AbortSignal,
	shown: number
): Promise<Loaded> {
	const bwb = bwbOf(node);
	if (!bwb) return { rows: [] };
	const found = await abortable(getAmendedBy(bwb), signal);
	return {
		total: found.total,
		page:
			found.items.length > shown
				? () => amendingPublications(node, signal, shown + AMENDED_SHOWN)
				: undefined,
		rows: found.items.slice(0, shown).map((d) => ({
			ref: refOf(parseNodeId(d.id)?.collection ?? 'instruments', d.key, {}),
			title: d.display_name ?? d.identifier ?? naamVanId(d.id),
			context: null,
			filterGroup: 'wetten' as const,
			identifier: d.identifier && d.identifier !== d.key ? d.identifier : null,
			date: d.first_effective_date ?? null,
			// The publication that enacted the law: `Stelt vast` (relation-words.ts).
			relation: (d.establishes ?? 0) > 0 ? ('ESTABLISHES' as const) : ('AMENDS' as const),
			direction: 'inbound' as const,
			edge: { establishes: d.establishes ?? 0 }
		}))
	};
}

/**
 * The judgments that cite a law, a page of them at a time: the first, and the next by "Meer
 * laden" (offset), after the rows of the pages `before`.
 */
async function lawJudgments(
	node: LoaderContext['node'],
	signal: AbortSignal,
	options: LoaderContext['options'],
	before: Row[],
	offset: number
): Promise<Loaded> {
	const bwb = bwbOf(node);
	if (!bwb) return { rows: [] };
	// One year of them where the bronfilter chooses one (BE-51): all of that year, not
	// the year's share of the first page.
	const found = await ifExists(
		abortable(
			getInstrumentJudgments(bwb, {
				limit: JUDGMENTS_SHOWN,
				offset: offset || undefined,
				sort: options.order,
				year: options.year ? String(options.year) : undefined,
				subject_area: options.area ?? undefined
			}),
			signal
		)
	);
	if (!found) return { rows: before };
	const next = offset + found.items.length;
	const rows = [
		...before,
		...found.items
			.filter((j) => !isInternational({ key: j.key, props: {} }))
			.map(
				(j): Row => ({
					ref: { collection: 'judgments' as const, key: j.key },
					// The court and the day (API 0.73, BE-7), as every other row of a judgment.
					...describeBron(
						'judgments',
						j.key,
						j.display_name,
						{
							ecli: j.ecli,
							court: j.court,
							tier: j.tier,
							court_kind: j.court_kind,
							date: j.date,
							advocate_general: j.advocate_general,
							advocate_general_role: j.advocate_general_role
						},
						j.cite
					),
					context: citedLine(j.cited_articles ?? [], bwb),
					filterGroup: 'uitspraken' as const,
					relation: 'REFERS_TO' as const,
					direction: 'inbound' as const
				})
			)
	];
	return {
		total: found.total,
		// The next page by "Meer laden", never the whole at once (T11).
		page:
			found.items.length > 0 && next < found.total
				? () => lawJudgments(node, signal, options, rows, next)
				: undefined,
		// Every citing judgment per year (BE-47), not the page; the oldest first.
		years: (found.facets?.year ?? [])
			.filter((f) => f.value)
			.map((f) => ({ year: Number(f.value), count: f.count })),
		areas: areasOf(found.facets?.subject_area),
		cutBy: found.facets?.year?.length ? ['jaar', 'area'] : undefined,
		rows
	};
}
