import type { BaseNode } from '$lib/api/types';
import type {
	DossierDetailResponse,
	CommissieDetailDTO,
	LidDTO,
	TimelineEntryDTO
} from '$lib/api/parliamentary';

export type GraphNodeKind =
	| 'article'
	| 'judgment'
	| 'tkstuk'
	| 'activity'
	| 'instrument'
	| 'dossier'
	| 'commissie'
	| 'lid'
	| 'fractie'
	| 'other';

export interface GraphNode {
	id: string;
	collection: string;
	key: string;
	kind: GraphNodeKind;
	label: string;
	stub?: boolean;
	raw?: BaseNode;
}

export interface GraphEdge {
	id: string;
	source: string;
	target: string;
	/** 'structural' = layout/hierarchy edges; 'citation' = semantic citation edges; 'parliamentary' = dossier/commissie links; 'seed' = injected */
	kind: 'structural' | 'citation' | 'parliamentary' | 'seed';
	label: string;
	directed: true;
	confidence?: number | null;
	relation?: string | null;
	/** Edge-level metadata from the backend: e.g. STEMT carries
	 *  { stem: 'Voor'|'Tegen'|'Onthouden', aantal_zetels: number };
	 *  AUTEUR_VAN carries { rol: 'Indiener' | ... }. */
	meta?: Record<string, unknown> | null;
}

// Edges that are pure data scaffolding — taxonomy, admin. They should never
// appear as traversable links in graph views.
//
// Note: PART_OF_INSTRUMENT used to live here but is now classified as
// structural — it's the only way to navigate from a wet to its articles in
// additive-expansion mode. Without it, clicking a wet does nothing.
export const SCAFFOLDING_RELATIONS = new Set(['PART_OF_PROCEDURE', 'RELATED_TOPIC']);

// Structural edges: formal cross-references written into the legal text itself
// plus the containment edge from wet → article so wet-click expands children.
const STRUCTURAL_RELATIONS = new Set([
	'REFERS_TO_ARTICLE',
	'verwijst_naar', // Dutch API equivalent of REFERS_TO_ARTICLE
	'IMPLEMENTS_DIRECTIVE',
	'implementeert', // Dutch API equivalent of IMPLEMENTS_DIRECTIVE
	'PART_OF_INSTRUMENT' // wet ↔ article containment — traversable
]);

// Parliamentary edges. Two origins:
//   • Frontend-synthesised (lowercase, written in graph-store.ts during
//     loadDossierGraph / loadCommissieGraph): wijzigt_artikel, voegt_toe,
//     trekt_in, behandelt_artikel, behandelt.
//   • Backend-emitted (UPPERCASE, served verbatim from edge.relation):
//     AUTEUR_VAN, LID_VAN, LID_VAN_FRACTIE, STEMT, WIJZIGT, INTRODUCEERT,
//     TREKT_IN. Backend confirmed casing is preserved end-to-end.
const PARLIAMENTARY_RELATIONS = new Set([
	// Frontend-synthesised
	'wijzigt_artikel',
	'voegt_toe',
	'trekt_in',
	'behandelt_artikel',
	'behandelt', // commissie → dossier
	// Backend-emitted (uppercase, verbatim)
	'AUTEUR_VAN', // lid|fractie → publication (indiener / mede-ondertekenaar)
	'LID_VAN', // lid → commissie
	'LID_VAN_FRACTIE', // lid → fractie
	'STEMT', // fractie → stemming
	'WIJZIGT', // publication → article
	'INTRODUCEERT', // publication → article
	'TREKT_IN' // publication → article
]);

export function classifyEdgeKind(
	relation: string | null | undefined,
	sourceKind?: GraphNodeKind,
	targetKind?: GraphNodeKind
): 'structural' | 'citation' | 'parliamentary' {
	// Parliamentary hub edges: any edge touching a dossier/commissie/lid node.
	if (
		sourceKind === 'dossier' ||
		sourceKind === 'commissie' ||
		sourceKind === 'lid' ||
		targetKind === 'dossier' ||
		targetKind === 'commissie' ||
		targetKind === 'lid'
	)
		return 'parliamentary';
	// Any edge involving a judgment is always a citation.
	if (sourceKind === 'judgment' || targetKind === 'judgment') return 'citation';
	if (relation && PARLIAMENTARY_RELATIONS.has(relation)) return 'parliamentary';
	if (relation && STRUCTURAL_RELATIONS.has(relation)) return 'structural';
	return 'citation';
}

export interface GraphSeed {
	nodes: GraphNode[];
	edges?: GraphEdge[];
	focus?: { collection: string; key: string };
}

const TK_STUK_TRIGGER = 'memorie van toelichting';
const INSTRUMENT_KEYWORDS = ['instrument', 'wet', 'regeling'];

export function graphNodeId(collection: string, key: string) {
	return `${collection}/${key}`;
}

// Anchor kinds: clicking one re-roots the graph onto that node's own subgraph.
// Rendered as squares in Sigma to signal "this is a launch point, not a leaf".
const ANCHOR_KINDS: ReadonlySet<GraphNodeKind> = new Set([
	'instrument',
	'dossier',
	'commissie',
	'lid',
	'fractie'
]);

export function isAnchorKind(kind: GraphNodeKind): boolean {
	return ANCHOR_KINDS.has(kind);
}

// Lagen membership. Each top-level layer (the Lagen buttons in the sidebar)
// "owns" a primary kind plus zero or more sub-kinds that the UI groups under
// the same conceptual umbrella. Counters, activation, and (de)load all
// operate on the union — e.g. clicking "Dossiers" loads + deloads tkstuk
// publications alongside dossier hubs.
export const LAYER_SUB_KINDS: Partial<Record<GraphNodeKind, readonly GraphNodeKind[]>> = {
	instrument: ['article'],
	dossier: ['tkstuk'],
	commissie: ['activity'],
	fractie: ['lid']
};

/** All node kinds that belong to the given layer (primary + sub-kinds). */
export function kindsForLayer(layer: GraphNodeKind): GraphNodeKind[] {
	return [layer, ...(LAYER_SUB_KINDS[layer] ?? [])];
}

// Reported fallthroughs — collections we've seen land in 'other' once a session.
// Used to keep the warn-log to one line per collection rather than spamming.
const REPORTED_OTHER_COLLECTIONS = new Set<string>();

export function detectNodeKind(node: BaseNode): GraphNodeKind {
	if (node.collection === 'instrument_articles') return 'article';
	if (node.collection === 'instruments') return 'instrument';
	if (node.collection === 'judgments') return 'judgment';
	if (node.collection === 'dossiers' || node.collection === 'kamerstukdossiers') return 'dossier';
	if (node.collection === 'commissies') return 'commissie';
	if (node.collection === 'leden' || node.collection === 'kamerleden') return 'lid';
	if (node.collection === 'fracties') return 'fractie';
	// Activity-shaped collections: activiteiten (calendar items) and stemmingen
	// (votes, recorded as part of an activiteit) share the same conceptual
	// bucket — folding into 'activity' means they pick up the existing kind
	// colour, filter toggle, and Lagen interactions automatically. Toezeggingen
	// (commitments made during commissie meetings) also fit here because they
	// attach to an activiteit/commissie and behave the same in the UI.
	if (node.collection === 'activiteiten') return 'activity';
	if (node.collection === 'stemmingen') return 'activity';
	if (node.collection === 'toezeggingen') return 'activity';
	// Parliamentary procedure nodes (type='procedure', labels include 'TK',
	// domain like 'Strafrecht'). They sit alongside dossiers/activiteiten in
	// the parliamentary process, so 'activity' is the closest existing bucket
	// — picks up the same colour, sprite, and Lagen interaction.
	if (node.collection === 'procedures') return 'activity';
	if (node.collection === 'publications') return 'tkstuk';
	if (node.collection === 'kamerstukken') return 'tkstuk';
	if (isMemorieVanToelichting(node)) return 'tkstuk';
	if (isInstrumentNode(node)) return 'instrument';
	// One-time log per unseen collection so we collect evidence about what is
	// still hitting the catch-all. Hidden by strict view modes in
	// computeLevelSuppression and untoggleable in the sidebar, so silently
	// landing here means a node the user can't classify or hide.
	if (
		typeof console !== 'undefined' &&
		node.collection &&
		!REPORTED_OTHER_COLLECTIONS.has(node.collection)
	) {
		REPORTED_OTHER_COLLECTIONS.add(node.collection);
		console.warn(
			`[detectNodeKind] unclassified collection "${node.collection}" → 'other' (type=${node.type ?? '?'}, labels=${(node.labels ?? []).join(',')})`
		);
	}
	return 'other';
}

// ── Judgment court-tier helpers ───────────────────────────────────────────────
// Cassation  — Hoge Raad (HR) and its Parket (PHR): most authoritative
// Appeal     — Gerechtshoven (GH*), Raad van State (RVS), Centrale Raad van Beroep (CRVB),
//              College van Beroep voor het bedrijfsleven (CBB)
// First      — Rechtbanken (RB*)
// Unknown    — anything else (EU, foreign, etc.)
export type JudgmentTier = 'cassation' | 'appeal' | 'first' | 'unknown';

export function judgmentTier(ecli: string | null | undefined): JudgmentTier {
	if (!ecli) return 'unknown';
	// Extract the court-code segment: ECLI:NL:<CODE>:... or ECLI:<CC>:<CODE>:...
	const parts = ecli.replace(/^ECLI:/i, '').split(':');
	// parts[0] = country code (NL, EU, …), parts[1] = court code for NL
	const code = (parts.length >= 3 ? parts[1] : (parts[0] ?? '')).toUpperCase();
	if (code === 'HR' || code === 'PHR') return 'cassation';
	if (code.startsWith('GH') || code === 'RVS' || code === 'CRVB' || code === 'CBB') return 'appeal';
	if (code.startsWith('RB')) return 'first';
	return 'unknown';
}

// Compress verbose court codes to short readable labels for graph nodes.
// "RBNHO 2014/12958" → "Rb 2014/12958"; "GHAMS 2020/3" → "GH 2020/3"
export function shortenCourtCode(code: string): string {
	const u = code.toUpperCase();
	if (u === 'HR' || u === 'PHR') return code; // already short
	if (u === 'RVS') return 'RvS';
	if (u === 'CRVB') return 'CRvB';
	if (u === 'CBB') return 'CBB';
	if (u.startsWith('GH')) return 'GH'; // all Gerechtshoven → "GH"
	if (u.startsWith('RB')) return 'Rb'; // all Rechtbanken → "Rb"
	return code;
}

/**
 * Format an ECLI string into a short, readable label.
 * "ECLI:NL:HR:2023:456"  → "HR 2023/456"
 * "ECLI:EU:C:2020:12"    → "C 2020/12"
 */
export function formatEcliLabel(ecli: string): string {
	const raw = ecli.trim().replace(/^ECLI:/i, '');
	const parts = raw.split(':');
	if (parts.length >= 4 && parts[0] === 'NL') {
		return `${shortenCourtCode(parts[1])} ${parts[2]}/${parts[3]}`;
	}
	if (parts.length >= 4) {
		return `${parts[1]} ${parts[2]}/${parts[3]}`;
	}
	return raw;
}

// Dutch dossier titles are routinely 200+ characters and end with the wet's
// handelsnaam in parentheses — "(Wet verbetering aanpak rijden onder invloed)".
// Use that parenthetical when present; otherwise take a sensible truncation.
function shortDossierTitle(titel: string | null | undefined): string | null {
	if (!titel) return null;
	const t = titel.trim();
	const m = t.match(/\(([^()]+)\)\s*$/);
	if (m && m[1].trim().length > 0) return m[1].trim();
	return t.length > 60 ? t.slice(0, 57).trimEnd() + '…' : t;
}

export function buildNodeLabel(node: BaseNode, kind: GraphNodeKind) {
	if (kind === 'dossier') {
		const p = node.props as Record<string, unknown> | null;
		const num = (p?.['kamerstuknummer'] as string | null) ?? node.key;
		const short = shortDossierTitle(p?.['titel'] as string | null | undefined);
		return short ? `${num} · ${short}` : num;
	}
	if (kind === 'commissie') {
		const p = node.props as Record<string, unknown> | null;
		return (
			(p?.['afkorting'] as string | null) ??
			(p?.['naam'] as string | null) ??
			node.display_name ??
			node.key
		);
	}
	if (kind === 'lid') {
		const p = node.props as Record<string, unknown> | null;
		const naam = (p?.['naam'] as string | null) ?? node.display_name ?? node.key;
		const partij = p?.['partij'] as string | null | undefined;
		return partij ? `${naam} (${partij})` : naam;
	}
	if (kind === 'fractie') {
		const p = node.props as Record<string, unknown> | null;
		return (
			(p?.['afkorting'] as string | null) ??
			(p?.['naam'] as string | null) ??
			node.display_name ??
			node.key
		);
	}
	if (kind === 'article') {
		const articleNumber = node.props?.['article_number'] ?? node.props?.['articleNumber'];
		if (typeof articleNumber === 'string' && articleNumber.trim().length > 0) {
			return `Art. ${articleNumber}`;
		}
	}

	if (kind === 'activity' || (kind === 'tkstuk' && node.collection === 'publications')) {
		const p = node.props as Record<string, unknown> | null;
		const soort = (p?.['soort'] as string | null) ?? null;
		const datum = (p?.['datum'] as string | null) ?? null;
		// For amendementen and moties, the indiener is the most identifying piece
		// of metadata. The backend ships actors[] on every publication node:
		//   props.actors: [{ persoon_id, fractie_id, naam, fractie, rol }, ...]
		// Lead actor first; rol === 'indiener' wins ties.
		const isAmendOrMotie = soort && /amendement|motie/i.test(soort);
		if (isAmendOrMotie) {
			const actors = p?.['actors'] as Array<Record<string, unknown>> | undefined;
			if (Array.isArray(actors) && actors.length > 0) {
				// Backend confirmed actor list isn't strictly ordered. Pick by rol:
				//   1. "Eerste indiener" (older docs)
				//   2. "Indiener"
				//   3. fall back to actors[0]
				// Match case-insensitively because "indiener"/"Indiener" both occur.
				const rolOf = (a: Record<string, unknown>) => String(a?.['rol'] ?? '').toLowerCase();
				const lead =
					actors.find((a) => rolOf(a) === 'eerste indiener') ??
					actors.find((a) => rolOf(a) === 'indiener') ??
					actors[0];
				const naam = (lead?.['naam'] as string | null) ?? null;
				const fractie = (lead?.['fractie'] as string | null) ?? null;
				const short = soort!.split(/[\s(]/)[0];
				if (naam) {
					// "Amendement-Plas (BBB)" or "Motie-Klaver"
					const lastName = naam.split(/\s+/).slice(-1)[0];
					return fractie ? `${short}-${lastName} (${fractie})` : `${short}-${lastName}`;
				}
			}
		}
		if (soort) {
			// Show year-month + first word of soort to keep ring labels readable.
			const ym = datum ? datum.slice(0, 7) : '';
			const short = soort.split(/[\s(]/)[0];
			return ym ? `${ym} · ${short}` : short;
		}
	}

	if (kind === 'judgment') {
		const ecli = node.props?.['ecli'] ?? node.props?.['ECLI'] ?? node.display_name;
		if (typeof ecli === 'string' && ecli.trim().length > 0) {
			// ECLI:NL:HR:2023:456  →  parts after stripping "ECLI:" = ["NL","HR","2023","456"]
			const raw = ecli.trim().replace(/^ECLI:/i, '');
			const parts = raw.split(':');
			// NL ECLIs: country=parts[0], court=parts[1], year=parts[2], num=parts[3]
			if (parts.length >= 4 && parts[0] === 'NL') {
				const court = shortenCourtCode(parts[1]);
				return `${court} ${parts[2]}/${parts[3]}`;
			}
			// EU or other: "EU:C:2023:456" → "C 2023/456"
			if (parts.length >= 4) {
				return `${parts[1]} ${parts[2]}/${parts[3]}`;
			}
			// Fallback
			return raw;
		}
	}

	return node.display_name ?? node.key;
}

export function nodeToGraphNode(node: BaseNode): GraphNode {
	const kind = detectNodeKind(node);
	const stub = Boolean((node.props as Record<string, unknown> | null)?.['stub']);
	return {
		id: graphNodeId(node.collection, node.key),
		collection: node.collection,
		key: node.key,
		kind,
		label: buildNodeLabel(node, kind),
		stub: stub || undefined,
		raw: node
	};
}

function normalizeText(value: unknown): string {
	return typeof value === 'string' ? value.toLowerCase() : '';
}

function isMemorieVanToelichting(node: BaseNode) {
	const term = TK_STUK_TRIGGER;
	const labelMatch = node.labels.some((label: string) => normalizeText(label).includes(term));
	const title = normalizeText(node.props?.['title']);
	const type = normalizeText(node.props?.['type']);
	return labelMatch || title.includes(term) || type.includes(term);
}

function isInstrumentNode(node: BaseNode) {
	const candidate = normalizeText(node.type);
	if (INSTRUMENT_KEYWORDS.some((keyword) => candidate.includes(keyword))) return true;
	return node.labels.some((label: string) =>
		INSTRUMENT_KEYWORDS.some((keyword) => normalizeText(label).includes(keyword))
	);
}

// ── Parliamentary synthetic node factories ────────────────────────────────────
// These produce GraphNodes from parliamentary API data without a backend round-trip.
// The metadata is stored in raw.props so GraphNodePanel can render it.

export function dossierToGraphNode(d: DossierDetailResponse): GraphNode {
	const raw: BaseNode = {
		id: d.id,
		key: d.kamerstuknummer,
		collection: 'dossiers',
		type: 'dossier',
		display_name: d.titel ?? d.kamerstuknummer,
		labels: ['Dossier'],
		props: {
			kamerstuknummer: d.kamerstuknummer,
			titel: d.titel,
			huidige_fase: d.huidige_fase,
			afgedaan: d.afgedaan,
			document_count: d.document_count,
			activiteit_count: d.activiteit_count,
			stemming_count: d.stemming_count,
			toezegging_count: d.toezegging_count
		}
	};
	return {
		id: graphNodeId('dossiers', d.kamerstuknummer),
		collection: 'dossiers',
		key: d.kamerstuknummer,
		kind: 'dossier',
		label: buildNodeLabel(raw, 'dossier'),
		raw
	};
}

export function commissieToGraphNode(c: CommissieDetailDTO): GraphNode {
	const slug = c.slug ?? c.key;
	const raw: BaseNode = {
		id: c.id,
		key: slug,
		collection: 'commissies',
		type: 'commissie',
		display_name: c.naam ?? c.afkorting ?? slug,
		labels: ['Commissie'],
		props: {
			naam: c.naam,
			afkorting: c.afkorting,
			slug,
			active_dossier_count: c.active_dossier_count,
			total_dossier_count: c.dossiers.length
		}
	};
	return {
		id: graphNodeId('commissies', slug),
		collection: 'commissies',
		key: slug,
		kind: 'commissie',
		label: c.afkorting ?? c.naam ?? slug,
		raw
	};
}

export function fractieToGraphNode(f: {
	id: string;
	key: string;
	naam: string | null;
	afkorting: string | null;
}): GraphNode {
	const raw: BaseNode = {
		id: f.id || `fracties/${f.key}`,
		key: f.key,
		collection: 'fracties',
		type: 'fractie',
		display_name: f.afkorting ?? f.naam ?? f.key,
		labels: ['Fractie'],
		props: {
			naam: f.naam,
			afkorting: f.afkorting
		}
	};
	return {
		id: graphNodeId('fracties', f.key),
		collection: 'fracties',
		key: f.key,
		kind: 'fractie',
		label: buildNodeLabel(raw, 'fractie'),
		raw
	};
}

export function lidToGraphNode(l: LidDTO): GraphNode {
	const raw: BaseNode = {
		id: l.id || `leden/${l.key}`,
		key: l.key,
		collection: 'leden',
		type: 'lid',
		display_name: l.naam ?? l.key,
		labels: ['Lid'],
		props: {
			naam: l.naam,
			partij: l.partij,
			actief: l.actief
		}
	};
	return {
		id: graphNodeId('leden', l.key),
		collection: 'leden',
		key: l.key,
		kind: 'lid',
		label: buildNodeLabel(raw, 'lid'),
		raw
	};
}

// Convert a dossier-timeline entry (publication or activiteit) into a synthetic
// graph node. node_id is the ArangoDB id like "publications/<uuid>" or
// "activiteiten/<uuid>"; we derive collection + key by splitting once.
export function timelineEntryToGraphNode(entry: TimelineEntryDTO): GraphNode | null {
	const slash = entry.node_id.indexOf('/');
	if (slash < 0) return null;
	const collection = entry.node_id.slice(0, slash);
	const key = entry.node_id.slice(slash + 1);
	if (collection !== 'publications' && collection !== 'activiteiten') return null;
	const raw: BaseNode = {
		id: entry.node_id,
		key,
		collection,
		type: collection === 'activiteiten' ? 'activiteit' : 'publication',
		display_name: entry.titel ?? entry.soort,
		labels: [collection === 'activiteiten' ? 'Activiteit' : 'Publicatie'],
		props: {
			soort: entry.soort,
			datum: entry.datum,
			titel: entry.titel,
			...entry.body
		}
	};
	const kind = detectNodeKind(raw);
	return {
		id: graphNodeId(collection, key),
		collection,
		key,
		kind,
		label: buildNodeLabel(raw, kind),
		raw
	};
}
