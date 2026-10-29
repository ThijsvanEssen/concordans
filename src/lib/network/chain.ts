// The weergave Keten of the werkplek (besluit 39, mockup A197-c): a law, the articles it gives
// powers in, and the regulations issued under them, in layers from top to bottom: AMvB,
// ministeriële regeling, beleidsregel, the rest. Above the law, the laws its own preamble names
// (a regulation's grondslag). From /api/instruments/{bwb}/delegated and /basis; pure, so the
// drawing on a wide screen and the list on a phone read one model.
import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { NL } from '$lib/text/collator';
import { citeOf, type ArticleCite } from '$lib/network/cite-label';
import { kindName } from '$lib/text/law-kind';
import type { Relation } from '$lib/vocabulary';
import { lineKindOf, type LineKind } from '$lib/graph/line-kind';
import { filterGroupOf, type FilterGroup } from '$lib/verbonden/filter';

type Delegated = Omit<Schema<'InstrumentDelegatedResponse'>, 'items'> & {
	items: Schema<'InstrumentDelegatedSummaryItem'>[];
};
type Basis = Schema<'InstrumentBasisResponse'>;
type Summary = Schema<'InstrumentSummaryDTO'>;
type BasisArticle = Schema<'BasisArticleDTO'>;
type Item = Delegated['items'][number];

export type LayerId =
	| 'eu'
	| 'basis'
	| 'law'
	| 'implementation'
	| 'statute'
	| 'named'
	| 'amvb'
	| 'kb'
	| 'ministerial'
	| 'policy'
	| 'other';

const LAYER_LABEL: Record<LayerId, string> = {
	eu: 'EU-recht',
	basis: 'Grondslag',
	law: 'Wet',
	implementation: 'Implementatie',
	statute: 'Wet',
	named: 'Wet, noemt',
	kb: 'Koninklijk besluit',
	amvb: 'AMvB',
	ministerial: 'Ministeriële regeling',
	policy: 'Beleidsregel',
	other: 'Overige regelingen'
};

/** The order of the layers of regulations under the articles. */
const REGULATION_LAYERS: LayerId[] = ['amvb', 'kb', 'ministerial', 'policy', 'other'];

/**
 * How a node hangs under its parent: a power given, only named, or not known (the data has no
 * basis_kind for it). Unknown is no delegation: it stands behind Noemt, as a mention does.
 */
export type ParentWay = 'delegates' | 'mentioned' | 'unknown';

export type ChainNode = {
	/** The node id: `instruments/bwbr…`, `articles/bwbr…_16`. */
	id: string;
	name: string;
	/** Short, on the drawing: `art. 16`. */
	short: string;
	collection:
		| 'instruments'
		| 'articles'
		| 'judgments'
		| 'factions'
		| 'members'
		| 'cabinets'
		| 'committees';
	instrument?: Summary;
	/** Its BWB type, lower case (`amvb`), as the card names its kind. */
	kind: string | null;
	/** In force since, for a regulation; the tijdstrook places it there. */
	since: string | null;
	/** No longer in force since, where it is not (`validity=all`): drawn faint, said so. */
	expired?: string | null;
	/** `grondslag art. 16, 20 en 33`, `noemt art. 22`: how it hangs under the law. */
	grondslag: string | null;
	mentions: string | null;
	/** Its articles whose basis_kind the data lacks: neither a power given nor a mention. */
	unknown?: string | null;
	/** How it hangs, said on a phone's list: a seat and its years, an appeal and its court. */
	how?: string | null;
	/** The nodes of the layer above it, and how: a power given, or only named. */
	parents: {
		id: string;
		way: ParentWay;
		relation?: Relation;
		cite?: ArticleCite;
	}[];
	/** The regulations issued under it in turn, one level down. */
	further: string[];
	/** An article: the law it belongs to, whose articles share one omhulling. */
	home?: string;
	/** A person: the posts and seats that tell a bewindspersoon from a Kamerlid (Tonen). */
	roles?: Record<string, unknown>;
};

/** A layer of a law's keten (LayerId), or of a lineage (`0|Rechtbank`, lineage.ts). */
/** The relation a line of the keten draws: its own, else a grondslag or a mention. */
export const parentRelation = (p: ChainNode['parents'][number]): Relation =>
	p.relation ?? (p.way === 'delegates' ? 'BASED_ON' : 'REFERS_TO');

/** A line of the keten that is no power given: a mention, or a grondslag the data lacks. */
export const isMention = (p: Pick<ChainNode['parents'][number], 'way'>) => p.way !== 'delegates';

/** The kind a line of the keten is drawn in: a mention is an Aanhaling, a grondslag Structureel. */
export const parentKind = (p: ChainNode['parents'][number]): LineKind =>
	lineKindOf(
		parentRelation(p),
		p.relation === 'REFERS_TO' || isMention(p) ? 'judgment' : 'article'
	);

/**
 * What Soort and Relatie of the keten count: every bron a kind holds, those listed under an
 * "Alle N" too (so Tonen and the layer say the same number), and each line drawn as the kind it
 * is (a regulation given by the law a grondslag, one that names it or an appeal an Aanhaling).
 */
export function chainTally(
	model: { layers: readonly ChainLayer[]; more?: Partial<Record<string, readonly ChainNode[]>> },
	all: { layers: readonly ChainLayer[] }
) {
	const kinds: Partial<Record<FilterGroup, number>> = {};
	const nodes = [
		...model.layers.flatMap((l) => l.nodes),
		...Object.values(model.more ?? {}).flatMap((v) => v ?? [])
	];
	for (const n of nodes) {
		const k = filterGroupOf(n.collection, n.id.split('/')[1], {
			celex: n.instrument?.celex ?? null,
			...n.roles
		});
		if (k) kinds[k] = (kinds[k] ?? 0) + 1;
	}
	const lines: Partial<Record<LineKind, number>> = {};
	for (const p of all.layers.flatMap((l) => l.nodes).flatMap((n) => n.parents))
		lines[parentKind(p)] = (lines[parentKind(p)] ?? 0) + 1;
	return { kinds, lines };
}

export type ChainLayer = { id: LayerId | `${number}|${string}`; label: string; nodes: ChainNode[] };

/** The layer of a regulation by its BWB kind; a wet under a wet (an organieke wet) is a Wet. */
const LAYER_OF: Record<string, LayerId> = {
	wet: 'statute',
	rijkswet: 'statute',
	amvb: 'amvb',
	rijksamvb: 'amvb',
	kb: 'kb',
	rijkskb: 'kb',
	'ministeriele-regeling': 'ministerial',
	beleidsregel: 'policy'
};
const layerOf = (kind: string | null | undefined): LayerId =>
	LAYER_OF[(kind ?? '').toLowerCase()] ?? 'other';

/** A decree that changes other regulations, by its title: `Wijzigingsbesluit …`, `Aanpassingsbesluit …`. */
const AMENDING =
	/^(?:aanpassingsbesluit|wijzigingsbesluit|reparatiebesluit|verzamelbesluit|besluit (?:tot|houdende) wijziging|wijziging |regeling intrekking)/i;
/** The regulation a `Wijzigingsbesluit` changes: its name up to a comma or a bracket. */
const CHANGES = /^wijzigingsbesluit\s+([^,(]+?)(?:\s+enz\.?)?(?:[,(]|$)/i;

const nameOf = (i: Summary): string =>
	i.citation_title ?? naamVanId(i.id, i.display_name ?? i.title);

/** An instrument of /eu-links: its summary as the keten reads one. */
type EuInstrument = Pick<
	Summary,
	'id' | 'key' | 'bwb_id' | 'celex' | 'title' | 'citation_title'
> & {
	kind?: string | null;
	path?: string | null;
};

/** The kinds of a regulation, which rests on a law: one without a grondslag in the data says so. */
const REGULATION_KINDS = new Set([
	'amvb',
	'rijksamvb',
	'kb',
	'ministeriele-regeling',
	'beleidsregel',
	'circulaire',
	'zbo',
	'pbo',
	'reglement'
]);
/** A regulation, by the kind the BWB gives it (`AMvB`, `beleidsregel`): it rests on a law. */
export const isRegulation = (kind: string | null | undefined) =>
	REGULATION_KINDS.has((kind ?? '').toLowerCase());

/** What the keten is drawn around, beside the law's own lists. */
type ChainOptions = {
	/** Up to this many regulations a layer are drawn (the API sorts them by title). */
	max?: number;
	/** A regulation drawn whatever `max`: the one marked. */
	keep?: string | null;
	/** The kind of the start (`AMvB`, `beleidsregel`, `publicatie`): its layer's heading. */
	kind?: string | null;
	/** An article as the start: only the regulations issued under it (R3-K F5). */
	article?: string | null;
	/** The regulations that only name the law, with dashed lines; off, only what rests on it. */
	mentions?: boolean;
	/**
	 * The laws that only name the law in their text (REFERS_TO, `related-instruments`), drawn as
	 * mentions: with `mentions` off they are not part of the keten.
	 */
	refers?: readonly Referring[] | null;
	/** The EU acts the law implements, above it, and the laws that implement it, below (F1). */
	eu?: { implements: readonly EuInstrument[]; implementedBy: readonly EuInstrument[] } | null;
};

/** A law that refers to the one drawn, as `related-instruments` gives it. */
type Referring = Pick<
	Schema<'InstrumentRelatedItem'>,
	| 'id'
	| 'key'
	| 'bwb_id'
	| 'celex'
	| 'display_name'
	| 'citation_title'
	| 'kind'
	| 'date_in_force'
	| 'inbound_cited_count'
>;

const euNode = (i: EuInstrument, parents: ChainNode['parents']): ChainNode => ({
	id: i.id,
	name: i.citation_title ?? naamVanId(i.id, i.title),
	short: i.citation_title ?? naamVanId(i.id, i.title),
	collection: 'instruments',
	instrument: { ...i, short_title: null, abbreviation: null, display_name: null } as Summary,
	kind: i.kind?.toLowerCase() ?? null,
	since: null,
	grondslag: null,
	mentions: null,
	unknown: null,
	parents,
	further: []
});

/**
 * The layers of the keten of `wet` (its summary), from what /delegated, /basis and /eu-links
 * give. Up to `max` regulations a layer, and `keep`; the rest are listed apart (`more`), not
 * drawn.
 */
export function chain(
	law: { id: string; name: string; instrument?: Summary; abbreviation?: string | null },
	delegated: Delegated | null,
	basis: Basis | null,
	{
		max = Number.POSITIVE_INFINITY,
		keep = null,
		kind = null,
		article = null,
		eu = null,
		refers = null,
		mentions = true
	}: ChainOptions = {}
): {
	layers: ChainLayer[];
	rest: Partial<Record<LayerId, number>>;
	/** Per layer, the regulations not drawn: "Alle 403" lists them. */
	more: Partial<Record<LayerId, ChainNode[]>>;
	total: number;
	amending: string[];
	missing: string[];
} {
	const layers: ChainLayer[] = [];
	// A decree that only changes other regulations is no uitvoeringsregeling of the law: out of
	// the layers, counted apart. The regulation it changes, where the data has no grondslag for
	// it, is a gap said by name (mockup A197-c: "grondslag niet in de gegevens").
	const amending: string[] = [];
	const own = (delegated?.items ?? []).filter((item) => {
		if (article && !item.articles.some((a) => a.article_number === article)) return false;
		if (!AMENDING.test(nameOf(item.instrument))) return true;
		amending.push(nameOf(item.instrument));
		return false;
	});
	const named = new Set(own.map((item) => nameOf(item.instrument).toLowerCase()));
	const missing = [
		...new Set(
			amending.flatMap((title) => {
				const changed = CHANGES.exec(title)?.[1]?.trim();
				// Only a regulation of this law by its name (Arbeidsomstandighedenwet: the
				// Arbeidsomstandighedenbesluit), not one of another law the decree changes too.
				const stem = law.name.replace(/wet$/i, '').toLowerCase();
				return changed &&
					stem.length > 3 &&
					changed.toLowerCase().startsWith(stem) &&
					!named.has(changed.toLowerCase())
					? [changed]
					: [];
			})
		)
	];
	const rest: Partial<Record<LayerId, number>> = {};
	const more: Partial<Record<LayerId, ChainNode[]>> = {};
	/** A layer of EU acts or implementing laws: up to `max` drawn, the rest listed. */
	const capped = (id: LayerId, list: ChainNode[], cap = max) => {
		const drawn = list.filter((n, i) => i < cap || n.id === keep);
		const over = list.filter((n) => !drawn.includes(n));
		if (over.length) {
			rest[id] = over.length;
			more[id] = over;
		}
		return drawn;
	};
	if (eu?.implements.length) {
		// One kind names the layer (Richtlijn); several, EU-recht.
		const kinds = new Set(eu.implements.map((i) => kindName(i.kind)));
		layers.push({
			id: 'eu',
			label: (kinds.size === 1 && [...kinds][0]) || LAYER_LABEL.eu,
			nodes: capped(
				'eu',
				eu.implements.map((i) => euNode(i, []))
			)
		});
	}
	/** A missing basis_kind is its own state: not known, never taken for a power given. */
	const wayOf = (kind: string | null | undefined): ParentWay =>
		kind === 'delegates' || kind === 'mentioned' ? kind : 'unknown';
	const abbrOf = (i: Summary): string => i.abbreviation ?? i.short_title ?? nameOf(i);
	const lawAbbr = law.abbreviation ?? (law.instrument ? abbrOf(law.instrument) : null) ?? law.name;
	/**
	 * The lines to what a regulation hangs under: one per way (a power given, or only named), with
	 * the articles of that law it names, for the label on the line.
	 */
	const parentsOf = (
		id: string,
		list: readonly BasisArticle[],
		abbr: string,
		fallback: ParentWay
	): ChainNode['parents'] => {
		const out = (['delegates', 'mentioned', 'unknown'] as const).flatMap((way) => {
			const mine = list.filter((a) => (a.basis_kind ?? fallback) === way);
			return mine.length ? [{ id, way, cite: citeOf(mine, abbr) ?? undefined }] : [];
		});
		return out.length ? out : [{ id, way: fallback }];
	};
	if (basis?.items.length) {
		// The laws above a regulation: more than five are one "Alle N".
		const kinds = new Set(basis.items.map((b) => kindName(b.kind)));
		layers.push({
			id: 'basis',
			label: (kinds.size === 1 && [...kinds][0]) || LAYER_LABEL.basis,
			nodes: capped(
				'basis',
				basis.items.map((b) => ({
					id: b.instrument.id,
					name: nameOf(b.instrument),
					short: nameOf(b.instrument),
					collection: 'instruments' as const,
					instrument: b.instrument,
					kind: b.kind ?? null,
					since: null,
					grondslag: null,
					mentions: null,
					unknown: null,
					parents: [],
					further: []
				})),
				5
			)
		});
	}
	const lawLayer: ChainLayer = {
		id: 'law',
		label: kindName(kind) ?? LAYER_LABEL.law,
		nodes: [
			{
				id: law.id,
				name: law.name,
				short: law.name,
				collection: 'instruments',
				instrument: law.instrument,
				kind: null,
				since: null,
				grondslag: null,
				mentions: null,
				unknown: null,
				parents: [
					...(basis?.items ?? []).flatMap((b) =>
						parentsOf(b.instrument.id, b.articles, abbrOf(b.instrument), wayOf(b.basis_kind))
					),
					...(eu?.implements ?? []).map((i) => ({ id: i.id, way: 'delegates' as const }))
				],
				further: []
			}
		]
	};
	layers.push(lawLayer);
	// Every regulation once, in the layer of its kind: those under the law, and those under a
	// regulation of it in turn (sub_delegated: the Cyberbeveiligingsregelingen under the
	// Cyberbeveiligingsbesluit), each tied to what it is issued under, with the articles it names.
	const byId = new Map<string, ChainNode>();
	const take = (
		r: Pick<Item, 'instrument' | 'kind' | 'date_in_force' | 'expired_on'> & {
			sub_delegated?: Item['sub_delegated'];
		},
		parents: ChainNode['parents']
	) => {
		const known = byId.get(r.instrument.id);
		if (known) {
			for (const p of parents)
				if (!known.parents.some((q) => q.id === p.id && q.way === p.way)) known.parents.push(p);
			return;
		}
		byId.set(r.instrument.id, {
			id: r.instrument.id,
			name: nameOf(r.instrument),
			short: nameOf(r.instrument),
			collection: 'instruments',
			instrument: r.instrument,
			kind: r.kind ?? null,
			since: r.date_in_force ?? null,
			expired: r.expired_on ?? null,
			grondslag: null,
			mentions: null,
			unknown: null,
			parents,
			further: (r.sub_delegated ?? []).map((sub) => nameOf(sub.instrument))
		});
	};
	for (const item of own) {
		const mine = item.articles.filter((a) => !article || a.article_number === article);
		take(item, parentsOf(law.id, mine, lawAbbr, wayOf(item.basis_kind)));
	}
	for (const item of own)
		for (const sub of item.sub_delegated ?? [])
			take(
				sub,
				parentsOf(item.instrument.id, sub.articles, abbrOf(item.instrument), wayOf(sub.basis_kind))
			);
	// The laws that only name this one in their text: mentions, with the number of its articles.
	for (const r of mentions ? (refers ?? []) : []) {
		if (!/^(?:wet|rijkswet)$/i.test(r.kind ?? '')) continue;
		const cite = {
			full: `${r.inbound_cited_count} art. ${lawAbbr}`,
			count: r.inbound_cited_count,
			abbr: lawAbbr
		};
		take(
			{
				instrument: {
					...r,
					title: r.display_name ?? r.citation_title ?? r.id,
					short_title: null,
					abbreviation: null
				} as unknown as Summary,
				kind: r.kind,
				date_in_force: r.date_in_force,
				expired_on: null
			},
			[{ id: law.id, way: 'mentioned', relation: 'REFERS_TO', cite }]
		);
	}
	// Without the mentions, only what rests on the law is part of its keten: a regulation under
	// a regulation that is left out goes with it, unless a power given leads to it another way.
	const alive = new Set<string>([law.id]);
	if (mentions) for (const id of byId.keys()) alive.add(id);
	else
		for (let grown = true; grown; ) {
			grown = false;
			for (const [id, node] of byId)
				if (!alive.has(id) && node.parents.some((p) => p.way === 'delegates' && alive.has(p.id))) {
					alive.add(id);
					grown = true;
				}
		}
	const nodes = [...byId.values()].filter((node) => alive.has(node.id));
	if (!mentions)
		for (const node of nodes)
			node.parents = node.parents.filter((p) => p.way === 'delegates' && alive.has(p.id));
	// What it rests on, said on a phone's row: the articles of each law with its abbreviation.
	for (const node of nodes) {
		const said = (way: ParentWay) =>
			node.parents
				.filter((p) => p.way === way && p.cite)
				.map((p) => p.cite!.full)
				.join(', ') || null;
		node.grondslag = said('delegates');
		node.mentions = said('mentioned');
		node.unknown = said('unknown');
	}
	// Ordered by what they hang under, so the lines cross as little as they can: by the place of
	// the regulation above, then by name.
	const placeOf = new Map<string, number>([[law.id, 0]]);
	own.forEach((item, i) => placeOf.set(item.instrument.id, i + 1));
	const keyOf = (n: ChainNode) => {
		const at = n.parents.map((p) => placeOf.get(p.id)).filter((x): x is number => x !== undefined);
		return at.length ? Math.min(...at) : Number.POSITIVE_INFINITY;
	};
	const perLayer = new Map<LayerId, ChainNode[]>();
	// A wet issued under the law stands beside it in its layer (no line between them); one that
	// only names it, or whose basis the data lacks, in a layer of its own under it, with the
	// dashed line and its label. The regulations under either hang from it.
	const bucketOf = (n: ChainNode): LayerId => {
		const id = layerOf(n.kind);
		return id === 'statute' && n.parents.every(isMention) ? 'named' : id;
	};
	const cited = (n: ChainNode) => Math.max(0, ...n.parents.map((p) => p.cite?.count ?? 0));
	const statutes: ChainNode[] = [];
	for (const id of ['statute' as const, 'named' as const, ...REGULATION_LAYERS]) {
		const all = nodes
			.filter((n) => bucketOf(n) === id)
			.sort(
				(x, y) =>
					keyOf(x) - keyOf(y) ||
					// Those that name most of the law's articles first.
					(id === 'named' ? cited(y) - cited(x) : 0) ||
					NL.compare(x.name, y.name)
			);
		const drawn: ChainNode[] = [];
		for (const n of all) {
			if (drawn.length >= max && n.id !== keep) {
				const slot = id === 'statute' ? 'law' : id;
				rest[slot] = (rest[slot] ?? 0) + 1;
				(more[slot] ??= []).push(n);
				continue;
			}
			drawn.push(n);
		}
		if (id === 'statute') statutes.push(...drawn);
		else if (drawn.length) perLayer.set(id, drawn);
	}
	for (const n of statutes) n.parents = [];
	lawLayer.nodes.push(...statutes);
	if (eu?.implementedBy.length)
		layers.push({
			id: 'implementation',
			label: LAYER_LABEL.implementation,
			nodes: capped(
				'implementation',
				eu.implementedBy.map((i) => euNode(i, [{ id: law.id, way: 'delegates' }]))
			)
		});
	for (const id of ['named' as const, ...REGULATION_LAYERS]) {
		const list = perLayer.get(id);
		if (list?.length) layers.push({ id, label: LAYER_LABEL[id], nodes: list });
	}
	return { layers, rest, more, total: nodes.length, amending, missing };
}
