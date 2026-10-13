// A row of the panel Verbonden: one verbinding with one bron. A row is a glyph, a
// title and one meta line: the lid it names, the position in the source, the
// identifier or the date, and the betrouwbaarheid when it is not hoog. The passage
// of the source (`snippet`, with `match` marked) appears when the row is opened.
import { isRauw, menselijkeNaam, naamVanId } from '$lib/bron/menselijk';
import { keyEcli } from '$lib/bron/leesbaar';
import { korteDatum, langeDatum, vandaag } from '$lib/text/datum';
import { refOf, type BronRef } from '$lib/bron/href';
import { anchorLabel, parseQualifier } from '$lib/text/qualifier';
import { articleTitle, bookNumber } from '$lib/text/bw';
import { authorCite, paragraphCite } from '$lib/text/judgment-cite';
import { isCollection, type Relation } from '$lib/vocabulary';
import { draagtWetstitel, isGeneriek } from '$lib/bron/generiek';
import {
	dossierLabel,
	dossierName,
	dossierUitProps,
	kamerstukNummer,
	type DossierNaamBron
} from '$lib/bron/dossier-naam';
import { kindName } from '$lib/components/explore/law-head';
import { withoutKamerstuk } from '$lib/components/parliamentary/kamerstuk';
import { seatWord } from '$lib/components/parliamentary/career';
import { bronKindOf, confidenceWord, type BronKind } from './filter';
import { woordenVan } from './hoe';

export type { Neighbor } from '$lib/api/nodes';
import type { Neighbor } from '$lib/api/nodes';

export type Row = {
	ref: BronRef;
	title: string;
	/** Words about the bron that no other field carries: party, abbreviation, the place in the law. */
	context: string | null;
	kind: BronKind;
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
	/** The court of a judgment. */
	court?: string | null;
	/** Props the canvas needs to draw a bron not on it yet. */
	props?: Record<string, unknown>;
	/** The meta of the edge, as the API gives it: what the row's line reads (`hoe.ts`). */
	edge?: Record<string, unknown>;
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

const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(', ') || null;

export const shortDate = (iso: string | null) => korteDatum(iso) || null;

export const longDate = (iso: string | null) => langeDatum(iso) || null;

/** The dossier numbers of a node (`37020-XV`), in either chamber. */
export function dossierNumbersOf(props: Record<string, unknown> | null | undefined): string[] {
	const raw = props?.dossier_numbers;
	return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string' && !!n) : [];
}

/** The name of a court the API gives as a code (`GHAMS`). */
const COURTS: Record<string, string> = {
	HR: 'Hoge Raad',
	PHR: 'Parket bij de Hoge Raad',
	// A judgment of the EHRM has no court name, only its code.
	ECHR: 'Europees Hof voor de Rechten van de Mens',
	RVS: 'Raad van State',
	CRVB: 'Centrale Raad van Beroep',
	CBB: 'College van Beroep voor het bedrijfsleven',
	GHAMS: 'Gerechtshof Amsterdam',
	GHARL: 'Gerechtshof Arnhem-Leeuwarden',
	GHDHA: 'Gerechtshof Den Haag',
	GHSHE: "Gerechtshof 's-Hertogenbosch",
	RBAMS: 'Rechtbank Amsterdam',
	RBDHA: 'Rechtbank Den Haag',
	RBGEL: 'Rechtbank Gelderland',
	RBLIM: 'Rechtbank Limburg',
	RBMNE: 'Rechtbank Midden-Nederland',
	RBNHO: 'Rechtbank Noord-Holland',
	RBNNE: 'Rechtbank Noord-Nederland',
	RBOBR: 'Rechtbank Oost-Brabant',
	RBOVE: 'Rechtbank Overijssel',
	RBROT: 'Rechtbank Rotterdam',
	RBZWB: 'Rechtbank Zeeland-West-Brabant'
};

export const courtName = (court: string | null): string | null =>
	court ? (COURTS[court.toUpperCase()] ?? court) : null;

/**
 * The name and the line under it of a Kamerstuk, by what tells it apart: its own title where
 * that says more than its kind (`Motie van het lid Krul c.s. over …`); else its kind or title
 * with its number (`Verslag, Kamerstuk I 36547, C`); else with its date. Never the kind alone
 * where something else is known. The line under it names the kind and the number the title
 * leaves out.
 */
function documentName(
	props: Record<string, unknown>,
	name: string
): { title: string; context: string | null } {
	const kind = text(props.kind);
	const shortKind = kind?.replace(/\s*\(.*\)\s*$/, '') ?? null;
	const title = text(props.title) ? withoutKamerstuk(text(props.title)!) : null;
	const dossier = text(props.dossier_number) ?? dossierNumbersOf(props)[0] ?? null;
	const sequence = text(props.sequence != null ? String(props.sequence) : null);
	// The Eerste Kamer numbers its papers with a letter (`C`, `AB`), without `nr.`.
	const letter = sequence ? null : text(props.number);
	const ek = props.chamber === 'EK' || !!letter;
	const nr = sequence ? `nr. ${sequence}` : letter;
	const stuk = dossier ? join(kamerstukNummer(dossier, ek ? 'EK' : null), nr) : nr;
	if (!kind && !title) return { title: name, context: null };
	// The dossier's name on the line under it (API 0.79.30), where the title does not carry
	// it already: the number in the title is how a Kamerstuk is cited.
	const dossierNaam = text(props.dossier_short_title);
	const naamOnder = dossierNaam && !(title ?? '').includes(dossierNaam) ? dossierNaam : null;
	// A paper of a bill by its kind and number: its title is the bill's, the same for all.
	// `Blanco verslag` says more than the kind `Verslag`.
	if (draagtWetstitel(kind) && stuk)
		return {
			title: join(title && isGeneriek(title, kind) ? title : shortKind, stuk)!,
			context: naamOnder
		};
	if (title && !isGeneriek(title, kind))
		return { title, context: join(shortKind, stuk, naamOnder) };
	const lead = title ?? shortKind!;
	const where = stuk ?? longDate(text(props.date));
	return { title: join(lead, where) ?? lead, context: naamOnder };
}

/**
 * An activity, a zaak or a toezegging by what tells it apart: its agenda or own title where
 * that says more than its kind (`Procedures en brieven`); else the name the source gives it,
 * which names the committee and the day (`Commissie voor Justitie en Veiligheid (J&V)
 * (2026-03-24)`); else its kind with its date (`Stemmingen, 29 september 2026`). The kind goes
 * on the line under it.
 */
function activityName(
	props: Record<string, unknown>,
	displayName: string | null | undefined,
	name: string
): { title: string; context: string | null } {
	const kind = text(props.kind);
	const own = text(props.agenda_title) ?? text(props.title) ?? text(props.text);
	const context = kind && own?.toLowerCase() !== kind.toLowerCase() ? kind : null;
	if (own && !isGeneriek(own, kind)) return { title: own, context };
	const given = text(displayName);
	if (given && !isGeneriek(given.replace(/\s*\(\d{4}-\d{2}-\d{2}\)$/, ''), kind))
		return { title: given, context };
	const lead = own ?? kind ?? name;
	return { title: join(lead, longDate(text(props.date))) ?? lead, context };
}

/** A bron the data gives no name: said so, never shown by its database key. */
export const UNNAMED = 'Naam niet in de gegevens';

/**
 * Title, context, identifier, date and court of a bron, from what a list or node
 * response says about it.
 */
export function describe(
	collection: string,
	key: string,
	displayName: string | null | undefined,
	props: Record<string, unknown> = {}
): Pick<Row, 'title' | 'context' | 'identifier' | 'date' | 'court'> {
	// Never the key: the reader's name of the bron where the data gives none ($lib/bron/menselijk).
	const eigen = text(displayName);
	// A bijlage by the reader's name ("Bijlage II"), not the data's "Annex II" (#30).
	const name =
		eigen && !isRauw(eigen) && collection !== 'annexes'
			? eigen
			: menselijkeNaam({ collection, key, display_name: displayName, props });
	const date = text(props.date);
	switch (collection) {
		case 'judgments': {
			const ecli = text(props.ecli);
			const court = courtName(text(props.court) ?? text(props.court_code));
			// The name a judgment is known by: "Hoge Raad, 20 december 2019 (Urgenda)".
			const names = Array.isArray(props.names)
				? props.names.filter((n): n is string => typeof n === 'string')
				: [];
			const known = names.length ? ` (${names.join(', ')})` : '';
			// A conclusion by its author (API 0.74): "Conclusie A-G Niessen, 2 augustus 2018".
			const ag = text(props.advocate_general);
			const role = text(props.advocate_general_role) ?? '';
			const author = ag
				? authorCite(ag, /procureur-generaal/i.test(role) ? ['procureur-generaal'] : [])
				: null;
			return {
				title: author
					? (join(`Conclusie ${author}`, longDate(date)) ?? `Conclusie ${author}`) + known
					: (court ? (join(court, longDate(date)) ?? court) : name) + known,
				// A judgment known only as cited: its ECLI and court, nothing more. A translation
				// the Rechtspraak published under its own ECLI says so (in its name, as the source
				// gives it): HR Urgenda cites the English one of the Rechtbank, not its procesgang.
				context:
					props.stub === true
						? 'niet in de gegevens'
						: text(props.translation_of) || /\(English translation\)\s*$/i.test(name ?? '')
							? 'Engelse vertaling'
							: null,
				identifier: ecli ?? (court ? null : name),
				date,
				court
			};
		}
		case 'dossiers': {
			// By the name it is known by, its kind and number under it: "Cyberbeveiligingswet",
			// "Kamerstuk 36764", never the bare number or the title of three lines (Thijs, 13 Oct).
			// Where the props lack the short title, the row asks it (DossierNaam).
			const d = dossierUitProps({ display_name: name, ...props }, key);
			const naam = dossierName(d);
			return {
				title: naam === d.number ? name : naam,
				context: null,
				identifier: d.number ? kamerstukNummer(d.number) : null,
				date
			};
		}
		case 'documents':
			return { ...documentName(props, name), identifier: null, date };
		case 'decisions':
			return {
				title: text(props.subject) ?? text(props.title) ?? name,
				context: props.passed === true ? 'aangenomen' : props.passed === false ? 'verworpen' : null,
				date
			};
		case 'activities':
		case 'commitments':
		case 'cases':
			return { ...activityName(props, displayName, name), date };
		case 'members':
			return {
				title: text(props.name) ?? text(displayName) ?? UNNAMED,
				context: text(props.party)
			};
		case 'committees':
		case 'factions':
			// Its abbreviation is its name again ("D66" under "Democraten 66", UX-toets #16).
			return { title: text(props.name) ?? name, context: null };
		case 'instruments': {
			// A law by its citeertitel and its kind, "Cyberbeveiligingswet", "Wet": the kind is
			// what tells it from the dossier of the same name. The BWB id only without a kind.
			const soort = kindName(text(props.kind));
			return {
				title: text(props.citation_title) ?? text(props.title) ?? name,
				context: soort,
				identifier: soort ? null : (text(props.bwb_id) ?? text(props.celex))
			};
		}
		// An article of the BW by its book: "Artikel 6:162 BW".
		case 'articles':
			return { title: articleTitle(name, props), context: null };
		case 'annexes':
			return { title: name, context: null };
		default:
			return { title: text(displayName) ?? UNNAMED, context: null };
	}
}

/**
 * The lid a verbinding names, read from the phrase the source used
 * ("artikel 300, tweede lid"). Null when it names none.
 * TODO(backend B7, B8, B12): a lookup once the edge meta carries `lid`.
 */
export function lidOfMatch(match: string | null | undefined): string | null {
	if (!match) return null;
	const q = parseQualifier(match);
	return q?.lid ?? null;
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

export const aardLabel = (code: string | null | undefined): string | null =>
	code ? (AARD[code.toLowerCase()] ?? code.replaceAll('_', ' ')) : null;

/**
 * The aard with how sure it is (`semantic_confidence`, API 0.70: the share a hand check
 * found right): `voorwaarde`, or `mogelijk voorwaarde` below 0.6, where the betrouwbaarheid
 * of a verbinding reads laag.
 */
export function aardOf(
	code: string | null | undefined,
	semanticConfidence?: number | null
): string | null {
	const label = aardLabel(code);
	if (!label) return null;
	return semanticConfidence != null && semanticConfidence < 0.6 ? `mogelijk ${label}` : label;
}

export function rowOfNeighbor(n: Neighbor): Row | null {
	if (!isCollection(n.collection)) return null;
	const props = n.props ?? {};
	const meta = (n.meta ?? {}) as Record<string, unknown>;
	const match = text(meta.raw_match) ?? text(meta.qualifier);
	const lid =
		(Array.isArray(meta.leden) && text(meta.leden[0])) ||
		text(meta.lid) ||
		(n.direction === 'inbound' ? lidOfMatch(match) : null);
	// The overwegingen of a judgment where it cites (API: `paragraphs` on the edge).
	const paragraphs = Array.isArray(meta.paragraphs)
		? meta.paragraphs.filter((x): x is string => typeof x === 'string' && !!x)
		: [];
	// They are the row's own where it is the citing judgment; else the selected one's (`r.o.`).
	const ecli = n.collection === 'judgments' ? (text(props.ecli) ?? keyEcli(n.key)) : null;
	return {
		ref: refOf(n.collection, n.key, props),
		...describe(n.collection, n.key, n.display_name, props),
		...(paragraphs.length
			? { position: positionsLabel(paragraphs.map((nr) => paragraphCite(ecli, nr))) }
			: {}),
		kind: bronKindOf(n.collection, n.key, props, n.relation),
		lid,
		derived: n.confidence != null && n.confidence < 1,
		proposed: n.status === 'voorgesteld' || undefined,
		relation: (n.relation as Relation | null) ?? undefined,
		direction: n.direction === 'inbound' ? 'inbound' : 'outbound',
		edgeId: n.edge_id ?? null,
		confidence: n.confidence ?? null,
		snippet: text(meta.snippet),
		match,
		period: periodOf(meta),
		function: text(meta.function),
		// An appeal link names its remedy: `Cassatie`, `Hoger beroep`.
		aard:
			n.relation === 'APPEAL_OF' ? (text(meta.procedure_type)?.toLowerCase() ?? null) : undefined,
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
					.map((post) => text((post as Record<string, unknown> | null)?.function))
					.filter((f): f is string => !!f)
			)
		];
		return {
			from: froms.includes(null) ? null : (froms as string[]).sort()[0],
			to: tos.includes(null) ? null : (tos as string[]).sort().at(-1)!,
			role: functions.length > 0 ? functions.map(firstLower).join(' en ') : null
		};
	}
	const from = text(meta.from_date)?.slice(0, 10) ?? null;
	const to = text(meta.to_date)?.slice(0, 10) ?? null;
	// A seat's role in the word of a member's page: `PlvLid` and `Plv. lid` alike (UX #50).
	return from || to
		? { from, to, role: seatWord(text(meta.role), meta.substitute === true) }
		: null;
}

/**
 * `2017–2021`, `sinds 2025`, `tot en met 2021`, with a role other than plain membership in
 * front. The end date is the last day of the period (the Kamer's TotEnMet).
 */
export function periodLabel(period: NonNullable<Row['period']>): string {
	const from = period.from?.slice(0, 4);
	const to = period.to?.slice(0, 4);
	const span =
		from && to
			? from === to
				? from
				: `${from}–${to}`
			: from
				? `sinds ${from}`
				: `tot en met ${to}`;
	if (!period.role || period.role === 'Lid') return span;
	return `${firstLower(period.role)}, ${span}`;
}

/** `voorzitter`, `minister van Justitie en Veiligheid`: the names in a function keep their capitals. */
const firstLower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const POSITION_PREFIX = /^(r\.o\.|onder|§)\s*/;

/**
 * `r.o. 2.2.2`, `r.o. 2.2.2 en 2.4.1`, `r.o. 2.2.2, 2.4.1 en 19 meer`; `onder` in a
 * conclusion, `§` in a judgment of the EHRM (`paragraphCite`).
 */
export function positionsLabel(positions: string[]): string | null {
	const numbers = positions.map((p) => p.replace(POSITION_PREFIX, ''));
	if (numbers.length === 0) return null;
	const prefix = POSITION_PREFIX.exec(positions[0])?.[0] ?? '';
	if (numbers.length === 1) return prefix + numbers[0];
	if (numbers.length === 2) return `${prefix}${numbers[0]} en ${numbers[1]}`;
	return `${prefix}${numbers[0]}, ${numbers[1]} en ${numbers.length - 2} meer`;
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
		derived: confidence != null ? confidence < 1 : first.derived,
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

/**
 * The meta line of a row, as separate words; the panel joins them. With `verbinding`, the row
 * has its line of the verbinding (`hoe.ts`), which says the lid, the place, the aard and
 * whether it is derived: the meta line leaves them out, and a vote's outcome.
 */
export function metaParts(
	row: Row,
	verbinding = false
): { text: string; kind: 'lid' | 'proposed' | 'derived' | 'plain' }[] {
	return zonderNaam(row.title, metaPartsVan(row, verbinding));
}

/**
 * The meta line does not say the name again: "D66" under "D66-fractie" (UX-toets 10 Oct,
 * #16). A plain part the title already holds, as a word, is left out.
 */
function zonderNaam<P extends { text: string; kind: string }>(title: string, parts: P[]): P[] {
	const t = title.toLowerCase();
	return parts.filter((p) => {
		if (p.kind !== 'plain') return true;
		const w = p.text.trim().toLowerCase();
		if (!w) return false;
		const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return !new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(t);
	});
}

function metaPartsVan(
	row: Row,
	verbinding: boolean
): { text: string; kind: 'lid' | 'proposed' | 'derived' | 'plain' }[] {
	const parts: { text: string; kind: 'lid' | 'proposed' | 'derived' | 'plain' }[] = [];
	if (verbinding) {
		if (row.missing) parts.push({ text: 'niet in de gegevens', kind: 'plain' });
		if (row.proposed) parts.push({ text: 'voorgesteld', kind: 'proposed' });
		if (row.context && row.ref.collection !== 'decisions')
			parts.push({ text: row.context, kind: 'plain' });
		if (row.period) parts.push({ text: periodLabel(row.period), kind: 'plain' });
		if (row.function && row.function !== 'Tweede Kamerlid')
			parts.push({ text: `als ${row.function}`, kind: 'plain' });
		const when = row.identifier ?? shortDate(row.date ?? null);
		if (when) parts.push({ text: when, kind: 'plain' });
		return parts;
	}
	if (row.lid) parts.push({ text: `lid ${row.lid}`, kind: 'lid' });
	if (row.missing) parts.push({ text: 'niet in de gegevens', kind: 'plain' });
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
	const when = row.identifier ?? (row.kind === 'uitspraken' ? null : shortDate(row.date ?? null));
	if (when) parts.push({ text: when, kind: 'plain' });
	const word = confidenceWord(row.confidence, !!row.derived);
	if (word !== 'hoog') parts.push({ text: `betrouwbaarheid ${word}`, kind: 'derived' });
	return parts;
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
		text(props.case_number) ??
		/\s\/\s(.+)$/.exec(text(props.display_name) ?? '')?.[1] ??
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

/** What opening a row does, in words: at the position it names, or beside the article. */
export const openLabelOf = (row: Pick<Row, 'position' | 'at'>, beside = false): string =>
	beside
		? 'Lees naast het artikel'
		: row.position
			? `Lees bij ${row.position}`
			: row.at
				? `Lees bij ${anchorLabel(row.at)}`
				: 'Lees';

/**
 * `art. 4:12, 5:49 en 3 andere`: the articles of the law a judgment cites; a BW article with
 * its book, `art. 7:225` (`bwb` the law's id).
 */
export function citedLine(
	articles: readonly { article_number?: string | null }[],
	bwb?: string | null
): string | null {
	const numbers = articles.flatMap((a) =>
		a.article_number ? [bookNumber(bwb, a.article_number)] : []
	);
	if (!numbers.length) return null;
	const shown = numbers.slice(0, 2).join(', ');
	const rest = numbers.length - 2;
	return `art. ${shown}${rest > 0 ? ` en ${rest} ${rest === 1 ? 'ander' : 'andere'}` : ''}`;
}

/**
 * `Commissiedebat, geannuleerd, over 22112 en 21501-04`: what an activity was, a status
 * other than the usual one, and the dossiers on its agenda. One still to come says so
 * (UX-toets 0.79.47, #59): `Commissiedebat, gepland` on 3 June 2027; a planned one whose
 * day has passed is left as the source has it, without the word.
 */
export function activityLine(
	a: {
		kind?: string | null;
		status?: string | null;
		date?: string | null;
		dossier_numbers?: readonly string[] | null;
		/** The dossiers by number and name (API 0.79.30), where the response has them. */
		dossiers?: readonly DossierNaamBron[] | null;
	},
	today: string = vandaag()
): string | null {
	const usual = new Set(['gepland', 'uitgevoerd', 'vrijgegeven']);
	const s = a.status?.toLowerCase() ?? null;
	const gepland = s === 'gepland' && !!a.date && a.date.slice(0, 10) >= today;
	const status = gepland ? 'gepland' : s && !usual.has(s) ? s : null;
	// A dossier by its number and name: "over 22112 Nieuwe Commissievoorstellen …".
	const numbers = a.dossiers?.length
		? a.dossiers.map((d) => dossierLabel(d))
		: (a.dossier_numbers ?? []).map((n) => kamerstukNummer(n));
	const over = numbers.length
		? `over ${numbers.length > 1 ? `${numbers.slice(0, -1).join(', ')} en ${numbers.at(-1)}` : numbers[0]}`
		: null;
	return [a.kind, status, over].filter(Boolean).join(', ') || null;
}

/**
 * `eerste ondertekenaar, als minister van Financiën, 6 stukken`: what a lid or fractie
 * was in a dossier. The function only where it is not the plain seat of a Tweede Kamerlid:
 * an Eerste Kamerlid is named as such.
 */
export function rolesLine(d: {
	roles?: readonly string[] | null;
	functions?: readonly string[] | null;
	document_count?: number | null;
}): string | null {
	const roles = d.roles ?? [];
	const role = roles.some((r) => /^eerste/i.test(r))
		? 'eerste ondertekenaar'
		: roles.length
			? roles[0].toLowerCase()
			: null;
	const fn = (d.functions ?? []).find((f) => !/^tweede kamerlid$/i.test(f.trim()));
	const n = d.document_count ?? 0;
	return (
		[role, fn ? `als ${fn}` : null, n ? `${n} ${n === 1 ? 'stuk' : 'stukken'}` : null]
			.filter(Boolean)
			.join(', ') || null
	);
}

/** A change of the legislative history by its relation; its verb is the one of hoe.ts. */
const CHANGE: Record<string, Relation> = {
	amends: 'AMENDS',
	introduces: 'INTRODUCES',
	repeals: 'REPEALS'
};

/**
 * One change of an article as a row: the publication that made it or the bill that
 * proposes it, titled by its dossier, with the verb of the change and the date.
 */
export function historyRow(e: {
	dossier_number?: string | null;
	dossier_title?: string | null;
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
	const change = CHANGE[e.change ?? ''];
	const proposed = e.status === 'voorgesteld';
	return {
		ref,
		title: e.dossier_number
			? ((n) => (n === e.dossier_number ? kamerstukNummer(n) : n))(
					dossierName({ number: e.dossier_number, title: e.dossier_title })
				)
			: (e.summary ?? naamVanId(`${ref.collection}/${ref.key}`)),
		dossier: e.dossier_number ? { number: e.dossier_number, title: e.dossier_title } : null,
		identifier: e.summary ?? null,
		context:
			[
				proposed ? 'voorgesteld' : null,
				change ? woordenVan(change, 'documents', 'articles').actief : null,
				e.dossier_number ? kamerstukNummer(e.dossier_number) : null
			]
				.filter(Boolean)
				.join(', ') || null,
		date: e.date ?? null,
		kind: bronKindOf(ref.collection, ref.key, {}),
		proposed,
		relation: change,
		direction: 'inbound'
	};
}

/** An article a judgment cites of a law the dataset lacks (`unresolved_citations`). */
export type UnresolvedCitation = {
	law: string;
	article_number: string;
	leden?: string[];
	paragraph_ids?: string[];
};

/** `Artikel 843a Rv`: the article as the judgment cites it, before its law. */
export const unresolvedTitle = (c: UnresolvedCitation) => `Artikel ${c.article_number} ${c.law}`;

/**
 * The articles a judgment cites of laws outside the dataset, as rows without a link:
 * `Artikel 3 Opiumwet`, niet in de dataset.
 */
export function unresolvedRows(citations: UnresolvedCitation[]): Row[] {
	return citations.map((c) => ({
		ref: { collection: 'articles', key: `${c.law}_${c.article_number}` },
		title: unresolvedTitle(c),
		context: null,
		kind: 'artikelen',
		lid: c.leden?.[0] ?? null,
		missing: true,
		relation: 'REFERS_TO',
		direction: 'outbound'
	}));
}
