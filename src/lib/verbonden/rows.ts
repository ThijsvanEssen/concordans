// A row of the panel Verbonden: one verbinding with one bron. A row is a glyph, a
// title and one meta line: the lid it names, the position in the source, the
// identifier or the date, and the betrouwbaarheid when it is not hoog. The passage
// of the source (`snippet`, with `match` marked) appears when the row is opened.
import { articleRef } from '$lib/text/bw';
import { NOT_IN_DATA } from '$lib/text/coverage';
import { getInstrumentMeta } from '$lib/api/instrument-cache';
import { lawIdOf } from '$lib/graph/types';
import { escapeRegExp, lowerFirst, textOf } from '$lib/text/words';
import { naamVanId } from '$lib/bron/menselijk';
import { keyEcli } from '$lib/text/ecli';
import { korteDatum } from '$lib/text/datum';
import { refOf, type BronRef } from '$lib/bron/ref';
import { anchorLabel } from '$lib/text/anchor';
import { changeRelationOf, isCollection, type Relation } from '$lib/vocabulary';
import {
	dossierOwnName,
	dossierUitProps,
	dossierNumberLabel,
	type DossierNaamBron
} from '$lib/bron/dossier-naam';
import { describeBronShort, UNNAMED } from '$lib/bron/describe';
import { seatWord } from '$lib/text/seat';
import { stuksoortOf, type Stuksoort } from '$lib/bron/rubrieken';
import { MODERATE_CONFIDENCE, filterGroupOf, confidenceWord, type FilterGroup } from './filter';
import { isDerived, positionsLabel, readEdge } from './edge-meta';
import { relationWords } from './relation-words';
import { periodLabel } from './lines';
import type { Bereik } from '$lib/text/voetnoten';
import type { Cite } from '$lib/text/judgment-heading';
import type { CitedOutcome } from './cited-outcome';

import type { Neighbor } from '$lib/api/nodes';

/** A regulation issued under another one under the law: it stands right under it. */
export const isNested = (row: Row): boolean => !!row.onder;

export type Row = {
	ref: BronRef;
	title: string;
	/** Words about the bron that no other field carries: party, abbreviation, the place in the law. */
	context: string | null;
	filterGroup: FilterGroup;
	/** What a stuk is (a facet of the soort Stukken). */
	stuksoort?: Stuksoort;
	/** Position inside the bron the row opens at: `rov-5.1`, `lid-2`. */
	at?: string | null;
	/** The lid of the selected article the verbinding names: `2`. Null when it names none. */
	lid?: string | null;
	/** Where in the source: `r.o. 5.1`, `§ 3.2`, `artikel I, onderdeel B`. */
	position?: string | null;
	/** ECLI, Kamerstuk number, BWB id. */
	identifier?: string | null;
	/** ISO date of the source. */
	date?: string | null;
	/** The function a lid signed a stuk in, as the source writes it (`minister-president`). */
	function?: string | null;
	/** A seat on a commissie or in a fractie: when it began and ended (open when null), and its role. */
	period?: { from: string | null; to: string | null; role: string | null } | null;
	/** The aard of a reference: `strafverzwaring`, `definitie`. */
	aard?: string | null;
	/** Derived, not read from the source: a heuristic match or a confidence below 1. */
	derived?: boolean;
	/** A change a bill proposes and has not enacted. */
	proposed?: boolean;
	/** Named (a law in a dossier's title) but not in the dataset: no link, grey. */
	missing?: boolean;
	/** The edge the network draws between the selected bron and this one. */
	relation?: Relation;
	direction?: 'inbound' | 'outbound';
	edgeId?: string | null;
	confidence?: number | null;
	/** The passage of the source that carries the verbinding, and the phrase in it. */
	snippet?: string | null;
	match?: string | null;
	/** The paragraph of the citing judgment the passage is in, `rov-3.4`: its r.o. opens the reader there. */
	passageAt?: string | null;
	/** The footnote the passage stands in: its anchor (`fn-35`) and its label as printed. */
	noot?: { id: string; label: string | null } | null;
	/** The words of the citation by their offsets, where the edge keeps them (a Kamerstuk's
	 *  `meta.place`): in the note's text, or in the stuk's text. */
	bereik?: Bereik | null;
	/** The court of a judgment. */
	court?: string | null;
	/** A judgment as the API cites it. */
	cite?: Cite | null;
	/** How a judgment that cites the selected article ended: the meta line says it, or says it is not known. */
	uitkomst?: CitedOutcome | null;
	/** How often the judgment itself is cited (`inbound_citation_count`), where the order asks for it. */
	cited?: number | null;
	/** Props the canvas needs to draw a bron not on it yet. */
	props?: Record<string, unknown>;
	/** The meta of the edge, as the API gives it: what the row's line reads (`hoe.ts`). */
	edge?: Record<string, unknown>;
	/** The key of the row this one stands under: a regulation issued under that regulation. */
	onder?: string | null;
	/** One row per place the bron names the selected one, when there are several. */
	mentions?: Row[];
	/** The dossier the title names, where the row is not one by its props: a change of an article. */
	dossier?: DossierNaamBron | null;
};

/**
 * The dossier a row's title names, for DossierNaam: a dossier, or a change named by its
 * dossier. Null for any other row.
 */
export function dossierVanRij(row: Row): DossierNaamBron | null {
	if (row.dossier) return row.dossier;
	if (row.ref.collection !== 'dossiers') return null;
	const d = dossierUitProps(row.props, row.ref.number);
	return d.title || row.title === UNNAMED ? d : { ...d, title: row.title };
}

/** The aard of a reference as a word: the API's `semantic_type` codes in Dutch. */
const AARD: Record<string, string> = {
	cross_reference: 'verwijzing',
	scope_limitation: 'reikwijdte',
	definition: 'definitie',
	penalty_enhancement: 'strafverzwaring',
	penalty: 'strafbedreiging',
	exception: 'uitzondering',
	procedure: 'procedure',
	application: 'toepassing',
	delegation: 'delegatie',
	condition: 'voorwaarde',
	jurisdiction: 'rechtsmacht',
	limitation: 'verjaring',
	amendment: 'wijziging',
	basis: 'grondslag',
	// The codes of `/api/relationships/types`.
	conditional_requirement: 'voorwaarde',
	definitional_reference: 'definitie',
	delegated_discretion: 'delegatie',
	limiting_exception: 'uitzondering',
	prerequisite_procedure: 'procedure'
	// cross_reference and scope_limitation are named above.
};

const aardLabel = (code: string | null | undefined): string | null =>
	code ? (AARD[code.toLowerCase()] ?? code.replaceAll('_', ' ')) : null;

/**
 * The aard with how sure it is (`semantic_confidence`, API 0.70: the share a hand check
 * found right): `voorwaarde`, or `mogelijk voorwaarde` below MODERATE_CONFIDENCE, where the betrouwbaarheid
 * of a verbinding reads laag.
 */
export function aardOf(
	code: string | null | undefined,
	semanticConfidence?: number | null
): string | null {
	const label = aardLabel(code);
	if (!label) return null;
	return semanticConfidence != null && semanticConfidence < MODERATE_CONFIDENCE
		? `mogelijk ${label}`
		: label;
}

/**
 * An article of another law names its law: `Artikel 3 HPW`. Where the neighbour carries no
 * abbreviation, the law's own (the cache of names) supplies it, and its full title for the hover.
 */
function withLawName(collection: string, props: Record<string, unknown>): Record<string, unknown> {
	if (collection !== 'articles' || typeof props.instrument_abbreviation === 'string') return props;
	const meta = getInstrumentMeta(lawIdOf(props));
	const short = meta?.abbreviation ?? meta?.shortTitle;
	if (!meta || !short) return props;
	return {
		...props,
		instrument_abbreviation: short,
		instrument_citation_title: props.instrument_citation_title ?? meta.citationTitle ?? short
	};
}

export function rowOfNeighbor(n: Neighbor): Row | null {
	if (!isCollection(n.collection)) return null;
	const props = withLawName(n.collection, n.props ?? {});
	const meta = (n.meta ?? {}) as Record<string, unknown>;
	const inbound = n.direction === 'inbound';
	// The paragraphs and the passage are the row's own where it is the citing judgment; else
	// the selected one's, whose ECLI the row does not know (`r.o.`).
	const ecli =
		inbound && n.collection === 'judgments' ? (textOf(props.ecli) ?? keyEcli(n.key)) : null;
	const edge = readEdge(meta, { direction: inbound ? 'inbound' : 'outbound', citingEcli: ecli });
	return {
		ref: refOf(n.collection, n.key, props),
		...describeBronShort(n.collection, n.key, n.display_name, props, n.cite),
		...(edge.position ? { position: edge.position } : {}),
		...(edge.passageAt ? { passageAt: edge.passageAt } : {}),
		...(edge.noot ? { noot: edge.noot } : {}),
		...(edge.bereik ? { bereik: edge.bereik } : {}),
		filterGroup: filterGroupOf(n.collection, n.key, props, n.relation),
		...(n.collection === 'documents' ? { stuksoort: stuksoortOf(props, n.relation) } : {}),
		lid: edge.lid,
		derived: isDerived(n.confidence),
		proposed: n.status === 'voorgesteld' || undefined,
		relation: (n.relation as Relation | null) ?? undefined,
		direction: n.direction === 'inbound' ? 'inbound' : 'outbound',
		edgeId: n.edge_id ?? null,
		confidence: n.confidence ?? null,
		snippet: edge.snippet,
		match: edge.match,
		period: periodOf(meta),
		function: textOf(meta.function),
		// An appeal link names its remedy: `Cassatie`, `Hoger beroep`.
		aard:
			n.relation === 'APPEAL_OF' ? (textOf(meta.procedure_type)?.toLowerCase() ?? null) : undefined,
		props,
		edge: meta
	};
}

/**
 * The seat a MEMBER_OF edge records, from its meta. A SERVED_IN edge lists the posts of a
 * bewindspersoon in the cabinet (`meta.posts`): their functions, from the first to the
 * end of the last, open while one is open.
 */
function periodOf(meta: Record<string, unknown>): Row['period'] {
	if (Array.isArray(meta.posts) && meta.posts.length > 0) {
		const seats = meta.posts.map((post) => periodOf((post ?? {}) as Record<string, unknown>));
		const froms = seats.map((seat) => seat?.from ?? null);
		const tos = seats.map((seat) => seat?.to ?? null);
		const functions = [
			...new Set(
				meta.posts
					.map((post) => textOf((post as Record<string, unknown> | null)?.function))
					.filter((f): f is string => !!f)
			)
		];
		return {
			from: froms.includes(null) ? null : (froms as string[]).sort()[0],
			to: tos.includes(null) ? null : (tos as string[]).sort().at(-1)!,
			role: functions.length > 0 ? functions.map(lowerFirst).join(' en ') : null
		};
	}
	const from = textOf(meta.from_date)?.slice(0, 10) ?? null;
	const to = textOf(meta.to_date)?.slice(0, 10) ?? null;
	// A seat's role in the word of a member's page: `PlvLid` and `Plv. lid` alike (UX #50).
	return from || to
		? { from, to, role: seatWord(textOf(meta.role), meta.substitute === true) }
		: null;
}

/**
 * The mentions of one bron as one row: the first place it names the selected bron,
 * every place in the meta line, the highest confidence.
 */
export function bundleMentions(mentions: Row[]): Row {
	const [first] = mentions;
	if (mentions.length === 1) return first;
	const positions = [...new Set(mentions.map((m) => m.position).filter((p): p is string => !!p))];
	const confidences = mentions.map((m) => m.confidence).filter((c): c is number => c != null);
	const confidence = confidences.length > 0 ? Math.max(...confidences) : (first.confidence ?? null);
	return {
		...first,
		lid: mentions.find((m) => m.lid)?.lid ?? null,
		position: positionsLabel(positions),
		confidence,
		derived: confidence != null ? isDerived(confidence) : first.derived,
		mentions
	};
}

/** The rows with every mention as a row of its own, as the table and the export list them. */
export const mentionRows = (rows: Row[]): Row[] => rows.flatMap((r) => r.mentions ?? [r]);

/**
 * A row's key in a list: the bron, the place it points at, and the verbinding. One article
 * can refer twice (two aarden), so the bron alone is not unique. A row without an edge (a
 * change from the legislative history) is told apart by its relation: one memorie van
 * toelichting can amend an article and repeal it.
 */
export const rowKey = (r: Row) =>
	`${r.ref.collection}/${r.ref.key}#${r.at ?? ''}#${r.edgeId ?? r.relation ?? ''}`;

/** The rows each once, by their key, the first kept. */
export function uniqueRows(rows: Row[]): Row[] {
	const seen = new Set<string>();
	return rows.filter((r) => {
		const k = rowKey(r);
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}

type MetaPart = {
	text: string;
	kind: 'lid' | 'proposed' | 'derived' | 'plain' | 'uitkomst' | 'onbekend';
	/** At hover: the clause of the decision that says the outcome. */
	title?: string | null;
};

/**
 * The meta line of a row, as separate words; the panel joins them. With `verbinding`, the row
 * has its line of the verbinding (`hoe.ts`), which says the lid, the place, the aard and
 * whether it is derived: the meta line leaves them out, and a vote's outcome.
 */
export function metaParts(row: Row, verbinding = false): MetaPart[] {
	return zonderNaam(row.title, metaPartsVan(row, verbinding));
}

/**
 * The meta line does not say the name again: "D66" under "D66-fractie" (UX-toets 10 Oct,
 * #16). A plain part the title already holds, as a word, is left out.
 */
function zonderNaam<P extends MetaPart>(title: string, parts: P[]): P[] {
	const t = title.toLowerCase();
	return parts.filter((p) => {
		if (p.kind !== 'plain') return true;
		const w = p.text.trim().toLowerCase();
		if (!w) return false;
		const escaped = escapeRegExp(w);
		return !new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(t);
	});
}

function metaPartsVan(row: Row, verbinding: boolean): MetaPart[] {
	const parts: MetaPart[] = [];
	if (row.uitkomst)
		parts.push({
			text: row.uitkomst.text,
			kind: row.uitkomst.vastgesteld ? 'uitkomst' : 'onbekend',
			title: row.uitkomst.title
		});
	if (verbinding) {
		if (row.missing) parts.push({ text: NOT_IN_DATA, kind: 'plain' });
		if (row.proposed) parts.push({ text: 'voorgesteld', kind: 'proposed' });
		if (row.context && row.ref.collection !== 'decisions')
			parts.push({ text: row.context, kind: 'plain' });
		if (row.period) parts.push({ text: periodLabel(row.period), kind: 'plain' });
		if (row.function && row.function !== 'Tweede Kamerlid')
			parts.push({ text: `als ${row.function}`, kind: 'plain' });
		const when = shortId(row) ?? korteDatum(row.date);
		if (when) parts.push({ text: when, kind: 'plain' });
		return parts;
	}
	if (row.lid) parts.push({ text: `lid ${row.lid}`, kind: 'lid' });
	if (row.missing) parts.push({ text: NOT_IN_DATA, kind: 'plain' });
	if (row.proposed) parts.push({ text: 'voorgesteld', kind: 'proposed' });
	if (row.aard) parts.push({ text: row.aard, kind: 'plain' });
	// A position that only names the lid (`lid 2`) is said once.
	if (row.position && row.position !== `lid ${row.lid}`)
		parts.push({ text: row.position, kind: 'plain' });
	if (row.context) parts.push({ text: row.context, kind: 'plain' });
	if (row.period) parts.push({ text: periodLabel(row.period), kind: 'plain' });
	// Who signed, as what: the function unless it is the plain seat.
	if (row.function && row.function !== 'Tweede Kamerlid')
		parts.push({ text: `als ${row.function}`, kind: 'plain' });
	const when = shortId(row) ?? (row.filterGroup === 'uitspraken' ? null : korteDatum(row.date));
	if (when) parts.push({ text: when, kind: 'plain' });
	const word = confidenceWord(row.confidence, !!row.derived);
	if (word !== 'hoog') parts.push({ text: `betrouwbaarheid ${word}`, kind: 'derived' });
	return parts;
}

/** A row's identifier as the meta line says it: a judgment's ECLI short, without the ECLI:NL:
 *  every Dutch one has (A208c): HR:2009:BH2815. */
function shortId(row: Row): string | null {
	const id = row.identifier ?? null;
	return id && row.ref.collection === 'judgments' ? id.replace(/^ECLI:NL:/, '') : id;
}

/** The titles that more than one row of `rows` has: sister cases, heard on one day. */
export function repeatedTitles(rows: Row[]): Set<string> {
	const seen = new Set<string>();
	const repeated = new Set<string>();
	for (const r of rows) (seen.has(r.title) ? repeated : seen).add(r.title);
	return repeated;
}

/** What tells a judgment from others of the same court and day: its case number. */
export function caseNumberOf(row: Row): string | null {
	const props = (row.props ?? {}) as Record<string, unknown>;
	// A judgment outside the dataset has no case number; its ECLI stands in the meta line.
	if (props.stub === true) return null;
	return (
		textOf(props.case_number) ??
		/\s\/\s(.+)$/.exec(textOf(props.display_name) ?? '')?.[1] ??
		row.identifier?.split(':').at(-1) ??
		null
	);
}

/** The passage of a row with the cited phrase marked, or null when the row has none. */
export function passageOf(row: Pick<Row, 'snippet' | 'match'>): {
	before: string;
	mark: string;
	after: string;
} | null {
	if (!row.snippet) return null;
	const i = row.match ? row.snippet.indexOf(row.match) : -1;
	if (i < 0) return { before: row.snippet, mark: '', after: '' };
	return {
		before: row.snippet.slice(0, i),
		mark: row.match!,
		after: row.snippet.slice(i + row.match!.length)
	};
}

/** Where a row opens its bron: a citing judgment at the note its citation stands in. */
export const ankerVanRij = (row: Pick<Row, 'direction' | 'noot' | 'at'>): string | null =>
	row.direction === 'inbound' && row.noot ? row.noot.id : (row.at ?? null);

/** What opening a row does, in words: at the position it names, or beside the article. */
export function openLabelOf(row: Pick<Row, 'position' | 'at' | 'ref'>, beside = false): string {
	if (beside) return 'Lees naast het artikel';
	const position = row.position ?? (row.at ? anchorLabel(row.at, row.ref.key) : null);
	return position ? `Lees bij ${position}` : 'Lees';
}

/** The dossier of a change, by the name the API gives it (`dossier_short_title`). */
const dossierVan = (e: {
	dossier_number?: string | null;
	dossier_title?: string | null;
	dossier_short_title?: string | null;
}): DossierNaamBron | null =>
	e.dossier_number
		? {
				number: e.dossier_number,
				title: e.dossier_title,
				short_title: e.dossier_short_title ?? null
			}
		: null;

/**
 * One change of an article as a row: the publication that made it or the bill that
 * proposes it, titled by its dossier, with the verb of the change and the date.
 */
export function historyRow(e: {
	dossier_number?: string | null;
	dossier_title?: string | null;
	dossier_short_title?: string | null;
	date?: string | null;
	change?: string | null;
	status?: string | null;
	summary?: string | null;
	document_id?: string | null;
}): Row | null {
	const slash = e.document_id?.indexOf('/') ?? -1;
	const collection = slash > 0 ? e.document_id!.slice(0, slash) : null;
	const key = slash > 0 ? e.document_id!.slice(slash + 1) : null;
	const ref: BronRef | null =
		collection && key && isCollection(collection)
			? refOf(collection, key, { label: e.dossier_number })
			: e.dossier_number
				? { collection: 'dossiers', key: e.dossier_number, number: e.dossier_number }
				: null;
	if (!ref) return null;
	const change = changeRelationOf(e.change);
	const proposed = e.status === 'voorgesteld';
	return {
		ref,
		title: e.dossier_number
			? (dossierOwnName(dossierVan(e)!) ?? dossierNumberLabel(e.dossier_number))
			: (e.summary ?? naamVanId(`${ref.collection}/${ref.key}`)),
		dossier: dossierVan(e),
		identifier: e.summary ?? null,
		context:
			[
				proposed ? 'voorgesteld' : null,
				change ? relationWords(change, 'documents', 'articles').actief : null,
				e.dossier_number ? dossierNumberLabel(e.dossier_number) : null
			]
				.filter(Boolean)
				.join(', ') || null,
		date: e.date ?? null,
		filterGroup: filterGroupOf(ref.collection, ref.key, {}),
		proposed,
		relation: change ?? undefined,
		direction: 'inbound'
	};
}

/** An article a judgment cites of a law the dataset lacks (`unresolved_citations`). */
type UnresolvedCitation = {
	law: string;
	article_number: string;
	leden?: string[];
	paragraph_ids?: string[];
};

/** `Artikel 843a Rv`: the article as a row of Verbonden names it, before its law. */
const unresolvedTitle = (c: UnresolvedCitation) =>
	`${articleRef(null, c.article_number, { form: 'Artikel' })} ${c.law}`;

/**
 * The articles a judgment cites of laws outside the dataset, as rows without a link:
 * `Artikel 3 Opiumwet`, niet in de dataset.
 */
export function unresolvedRows(citations: UnresolvedCitation[]): Row[] {
	return citations.map((c) => ({
		ref: { collection: 'articles', key: `${c.law}_${c.article_number}` },
		title: unresolvedTitle(c),
		context: null,
		filterGroup: 'artikelen',
		lid: c.leden?.[0] ?? null,
		missing: true,
		relation: 'REFERS_TO',
		direction: 'outbound'
	}));
}
