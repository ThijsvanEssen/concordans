// The weergave Keten of the werkplek (besluit 39, mockup A197-c): a law, the articles it gives
// powers in, and the regulations issued under them, in layers from top to bottom: AMvB,
// ministeriële regeling, beleidsregel, the rest. A layer is a kind (Wet, AMvB), never a relation:
// the wetten that only name the law stand in the layer Wet, the relation is the line.
// Above the law, the laws its own preamble names (a regulation's grondslag). From
// /api/instruments/{bwb}/delegated and /basis; pure, so the
// drawing on a wide screen and the list on a phone read one model.
import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { NL } from '$lib/text/collator';
import { citeOf, type ArticleCite } from '$lib/network/cite-label';
import { kindName } from '$lib/text/law-kind';
import { sinceDate } from '$lib/text/datum';
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
	| 'law'
	| 'implementation'
	| 'statute'
	| 'amvb'
	| 'kb'
	| 'ministerial'
	| 'policy'
	| 'other';

const LAYER_LABEL: Record<LayerId, string> = {
	eu: 'EU-recht',
	law: 'Wet',
	implementation: 'Nationale regelgeving',
	statute: 'Wet',
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
 * basis_kind for it). Unknown is no delegation: it is drawn as a mention is, a dashed line.
 */
type ParentWay = 'delegates' | 'mentioned' | 'unknown';

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
	/** Came with `related-instruments`, after the first answer: placed beyond what stands. */
	late?: boolean;
	/** The nodes of the layer above it, and how: a power given, or only named. */
	parents: {
		id: string;
		way: ParentWay;
		relation?: Relation;
		cite?: ArticleCite;
		/** A law that names it in its text: how many of its articles, for the order. */
		named?: number;
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

/** The words on a line of the keten: a judgment's appeal, its cassatie and its conclusie. */
export const wordOf = (relation: Relation, layer: string) =>
	relation === 'APPEAL_OF'
		? layer === 'Hoge Raad'
			? 'cassatie'
			: 'hoger beroep'
		: relation === 'ADVISES_ON'
			? 'conclusie'
			: relation === 'CONTINUES'
				? 'zet voort'
				: null;

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

export type ChainLayer = {
	id: LayerId | `${number}|${string}` | `above|${string}`;
	label: string;
	nodes: ChainNode[];
	/** Stands over the law: the EU acts and the laws it rests on (the head of a phone's list). */
	above?: boolean;
	/** The wetten that name the law are on their way: its row keeps the room they will take. */
	awaiting?: boolean;
};

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
	/**
	 * The other chosen laws beside the law: one that gives a power for a regulation drawn here
	 * too (the Wwke beside the Cbw, both grondslag of the Cbb) stands in its layer, with its
	 * line to that regulation. One that shares none stays out.
	 */
	beside?: readonly {
		id: string;
		name: string;
		abbreviation?: string | null;
		delegated: Delegated | null;
	}[];
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
	| 'inbound_cited_articles'
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
 * A law that names the one drawn in its text, as a mention under it: the articles of that law
 * it names on the line (`art. 56, 57 Gw`, B48), never a count ("2 art." reads as article 2).
 */
const referringItem = (
	r: Referring,
	lawId: string,
	lawAbbr: string
): [Pick<Item, 'instrument' | 'kind' | 'date_in_force' | 'expired_on'>, ChainNode['parents']] => [
	{
		instrument: {
			...r,
			title: naamVanId(r.id, r.display_name ?? r.citation_title),
			short_title: null,
			abbreviation: null
		} as unknown as Summary,
		kind: r.kind,
		date_in_force: r.date_in_force,
		expired_on: null
	},
	[
		{
			id: lawId,
			way: 'mentioned',
			relation: 'REFERS_TO',
			named: r.inbound_cited_count,
			cite: citeOf(r.inbound_cited_articles, lawAbbr) ?? undefined
		}
	]
];

/** Came with `related-instruments`: after those of the first answer, which keep their place. */
const late = (n: ChainNode) => (n.parents.every((p) => p.relation === 'REFERS_TO') ? 1 : 0);
const cited = (n: ChainNode) => Math.max(0, ...n.parents.map((p) => p.named ?? p.cite?.count ?? 0));

/** How high a kind stands: the Grondwet over the wet, the wet over the AMvB, and so down. */
const RANK: Record<string, number> = {
	grondwet: 0,
	wet: 1,
	rijkswet: 1,
	amvb: 2,
	rijksamvb: 2,
	kb: 3,
	rijkskb: 3,
	'ministeriele-regeling': 4,
	beleidsregel: 5
};
const rankOf = (kind: string | null | undefined) => RANK[(kind ?? '').toLowerCase()] ?? 6;

/**
 * The regulations a decree that only changes names, which the data lacks: only one of this law by
 * its name (Arbeidsomstandighedenwet: the Arbeidsomstandighedenbesluit), not one of another law
 * the decree changes too.
 */
function missingOf(amending: readonly string[], lawName: string, named: ReadonlySet<string>) {
	const stem = lawName.replace(/wet$/i, '').toLowerCase();
	return [
		...new Set(
			amending.flatMap((title) => {
				const changed = CHANGES.exec(title)?.[1]?.trim();
				return changed &&
					stem.length > 3 &&
					changed.toLowerCase().startsWith(stem) &&
					!named.has(changed.toLowerCase())
					? [changed]
					: [];
			})
		)
	];
}

type Beside = NonNullable<ChainOptions['beside']>[number];

/** A law beside the start's, in its layer: only a node, its lines hang from the regulations. */
const besideNode = (b: Beside): ChainNode => ({
	id: b.id,
	name: b.name,
	short: b.name,
	collection: 'instruments',
	kind: 'wet',
	since: null,
	grondslag: null,
	mentions: null,
	unknown: null,
	parents: [],
	further: []
});

/** The regulations of `b` the keten draws already (the Cbb under the Cbw and the Wwke). */
const sharing = (
	beside: readonly Beside[] | undefined,
	drawn: ReadonlyMap<string, unknown>,
	tie: (b: Beside, item: NonNullable<Beside['delegated']>['items'][number]) => void
) =>
	(beside ?? []).filter((b) => {
		const items = (b.delegated?.items ?? []).filter((item) => drawn.has(item.instrument.id));
		for (const item of items) tie(b, item);
		return items.length > 0;
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
		beside,
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
	/** The data holds what the law rests on. */
	basis: boolean;
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
	const missing = missingOf(amending, law.name, named);
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
			above: true,
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
	const lawLabel = kindName(kind) ?? LAYER_LABEL.law;
	const { ups, same } = aboveLayers(basis, lawLabel, capped);
	const lawLayer: ChainLayer = {
		id: 'law',
		label: lawLabel,
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
	const upAt = layers.length;
	layers.push(lawLayer);
	lawLayer.nodes.push(...same);
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
	// A regulation under the law that another chosen law gives a power for too: that law stands
	// beside this one, tied to it (Thijs, 22 Nov: the Cbb under the Cbw and the Wwke).
	const sisters = sharing(beside, byId, (b, item) =>
		take(item, parentsOf(b.id, item.articles, b.abbreviation ?? b.name, wayOf(item.basis_kind)))
	);
	// The laws that only name this one in their text, as mentions; not a law the keten draws
	// already (the Cbw over the Cbb): its first answer said how it hangs.
	const above = new Set((basis?.items ?? []).map((b) => b.instrument.id));
	for (const r of mentions ? (refers ?? []) : []) {
		if (!/^(?:wet|rijkswet)$/i.test(r.kind ?? '') || above.has(r.id) || byId.has(r.id)) continue;
		take(...referringItem(r, law.id, lawAbbr));
		byId.get(r.id)!.late = true;
	}
	// Without the mentions, only what rests on the law is part of its keten: a regulation under
	// a regulation that is left out goes with it, unless a power given leads to it another way.
	const alive = new Set<string>([law.id, ...sisters.map((b) => b.id)]);
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
		// A law that names it in its text: the articles it names, else the law; never a count.
		const said = (way: ParentWay) =>
			node.parents
				.flatMap(({ way: w, cite: c, relation }) =>
					w !== way ? [] : c ? [c.full] : relation === 'REFERS_TO' ? [lawAbbr] : []
				)
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
	const wetLane = !kind || layerOf(kind) === 'statute';
	const { perLayer, onlyNames } = layersOf(nodes, keyOf, {
		lawId: law.id,
		wetLane,
		max,
		keep,
		rest,
		more
	});
	lawLayer.nodes.push(...(perLayer.get('law') ?? []));
	lawLayer.nodes.push(...sisters.map(besideNode));
	if (eu?.implementedBy.length) {
		const kinds = new Set(eu.implementedBy.map((i) => kindName(i.kind)));
		layers.push({
			id: 'implementation',
			label: (kinds.size === 1 && [...kinds][0]) || LAYER_LABEL.implementation,
			nodes: capped(
				'implementation',
				eu.implementedBy.map((i) => euNode(i, [{ id: law.id, way: 'delegates' }]))
			)
		});
	}
	for (const id of REGULATION_LAYERS) {
		const list = perLayer.get(id);
		if (list?.length) layers.push({ id, label: LAYER_LABEL[id], nodes: list });
	}
	nameLaw(perLayer.get('statute') ?? [], {
		kind,
		lawLayer,
		layers,
		ups,
		wetLane,
		awaiting: !refers && !article,
		mentions
	});
	layers.splice(upAt, 0, ...ups.sort((x, y) => x.rank - y.rank).map((u) => u.layer));
	// What only names the law does not count: its keten holds what it did before they came.
	const total = nodes.filter((n) => !onlyNames(n)).length;
	return { layers, rest, more, total, amending, missing, basis: ups.length + same.length > 0 };
}

/**
 * The layers over the law, each of one kind: what it rests on stands in the layer of its kind
 * (Wet, AMvB), never in one named for the relation; the law's own kind stands in its layer.
 */
function aboveLayers(
	basis: Basis | null,
	lawLabel: string,
	capped: (id: LayerId, list: ChainNode[], cap?: number) => ChainNode[]
) {
	const ups: { rank: number; layer: ChainLayer }[] = [];
	const same: ChainNode[] = [];
	for (const [label, items] of Map.groupBy(
		basis?.items ?? [],
		(b) => kindName(b.kind) ?? LAYER_LABEL.other
	)) {
		const nodes = items.map((b) => ({
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
		}));
		// More than five are one "Alle N".
		if (label === lawLabel) same.push(...capped('law', nodes, 5));
		else {
			const id = label === LAYER_LABEL.statute ? 'statute' : (`above|${label}` as const);
			ups.push({
				rank: rankOf(items[0].kind),
				layer: { id, label, above: true, nodes: capped(id as LayerId, nodes, 5) }
			});
		}
	}
	return { ups, same };
}

/**
 * The wetten that only name the law: over a regulation, in the layer Wet of the laws it rests
 * on, each with its dashed line down to it; under the Grondwet, a layer Wet of their own. Still
 * being asked: the layer they will stand in keeps its place.
 */
function nameLaw(
	naming: ChainNode[],
	o: {
		kind: string | null;
		lawLayer: ChainLayer;
		layers: ChainLayer[];
		ups: { rank: number; layer: ChainLayer }[];
		wetLane: boolean;
		awaiting: boolean;
		mentions: boolean;
	}
) {
	const waits = o.awaiting && o.mentions;
	const over = !o.wetLane && rankOf(o.kind) > RANK.wet;
	let up = o.ups.find((u) => u.layer.id === 'statute');
	if (naming.length && over) {
		const focus = o.lawLayer.nodes[0];
		for (const n of naming) {
			focus.parents.push(...n.parents.map((p) => ({ ...p, id: n.id })));
			n.parents = [];
		}
	}
	if (naming.length && !over)
		o.layers.push({ id: 'statute', label: LAYER_LABEL.statute, nodes: naming });
	else if (naming.length || (waits && over)) {
		if (!up)
			o.ups.push(
				(up = {
					rank: RANK.wet,
					layer: { id: 'statute', label: LAYER_LABEL.statute, above: true, nodes: [] }
				})
			);
		up.layer.nodes.push(...naming);
		if (!naming.length) up.layer.awaiting = true;
	} else if (waits && o.wetLane) o.lawLayer.awaiting = true;
}

/**
 * Each node in the layer of its kind. A wet stands beside the law in its layer Wet: one issued
 * under it, one whose basis the data lacks, one regulations hang from, and one that only names
 * the law, with a dashed line (Thijs, 22 Nov: "de soort lijn bepaalt de verbinding").
 * `related-instruments` comes late: those of the first answer keep their place. A law that is no
 * wet (a regulation, the Grondwet) has its wetten that only name it in a layer Wet of their own,
 * under the rest. Up to `max` a layer are drawn; the others go to `rest` and `more`.
 */
function layersOf(
	nodes: readonly ChainNode[],
	keyOf: (n: ChainNode) => number,
	o: {
		lawId: string;
		wetLane: boolean;
		max: number;
		keep: string | null;
		rest: Partial<Record<LayerId, number>>;
		more: Partial<Record<LayerId, ChainNode[]>>;
	}
) {
	const carrying = new Set(nodes.flatMap((n) => n.parents.map((p) => p.id)));
	const onlyNames = (n: ChainNode) =>
		layerOf(n.kind) === 'statute' &&
		!carrying.has(n.id) &&
		n.parents.every((p) => p.way === 'mentioned');
	const bucketOf = (n: ChainNode): LayerId => {
		const id = layerOf(n.kind);
		return id !== 'statute' ? id : o.wetLane || !onlyNames(n) ? 'law' : 'statute';
	};
	const perLayer = new Map<LayerId, ChainNode[]>();
	const onDrawing = new Set<string>([o.lawId]);
	for (const id of ['law' as const, ...REGULATION_LAYERS, 'statute' as const]) {
		const all = nodes
			.filter((n) => bucketOf(n) === id)
			.sort(
				(x, y) =>
					keyOf(x) - keyOf(y) ||
					// Those that name most of the law's articles first.
					(id === 'law' || id === 'statute' ? late(x) - late(y) || cited(y) - cited(x) : 0) ||
					NL.compare(x.name, y.name)
			);
		const first = new Set(fillOrder(all, onDrawing, o.keep).slice(0, o.max));
		const drawn: ChainNode[] = [];
		for (const n of all) {
			if (!first.has(n) && n.id !== o.keep) {
				o.rest[id] = (o.rest[id] ?? 0) + 1;
				(o.more[id] ??= []).push(n);
				continue;
			}
			drawn.push(n);
			onDrawing.add(n.id);
		}
		perLayer.set(id, drawn);
	}
	return { perLayer, onlyNames };
}

/**
 * Who of a layer is drawn first where not all fit: what hangs under the bron marked, then one by
 * one per parent, so a row is not filled by what hangs directly under the law and the wetten
 * beside it keep their regulations (B86). A parent not on the drawing waits a turn: a line first.
 */
function fillOrder(
	all: readonly ChainNode[],
	onDrawing: ReadonlySet<string>,
	keep: string | null
): ChainNode[] {
	const turns = new Map<string, number>();
	const turnOf = new Map(
		all.map((n) => {
			if (n.parents.some((p) => p.id === keep)) return [n, -1];
			// The last parent is the one furthest from the law.
			const drawn = n.parents.findLast((p) => onDrawing.has(p.id))?.id;
			const parent = drawn ?? n.parents[0]?.id ?? '';
			const turn = turns.get(parent) ?? (drawn ? 0 : 1);
			turns.set(parent, turn + 1);
			return [n, turn];
		})
	);
	return [...all].sort((a, b) => turnOf.get(a)! - turnOf.get(b)!);
}

/** The period of the strip, its bounds as days; either may be open. */
type ChainPeriod = { van: string | null; tot: string | null } | null;

/** Dated outside the period of the strip: drawn faint, not gone (Thijs, 23 Oct). */
export const isOutside = (k: Pick<ChainNode, 'since'>, period: ChainPeriod): boolean =>
	!!period &&
	!!k.since &&
	((!!period.van && k.since < period.van) || (!!period.tot && k.since > period.tot));

/**
 * Why a bron of the keten is drawn otherwise, as its glance says it (B53, Thijs: "Als je hovert
 * is het dan duidelijk waarom ze een ander styling hebben?"): vervallen, or outside the period.
 */
export const whyFaint = (
	k: Pick<ChainNode, 'since' | 'expired'>,
	period: ChainPeriod
): string[] => [
	...(k.expired ? [`Vervallen ${sinceDate(k.expired)}`] : []),
	...(isOutside(k, period) ? [`Buiten de periode, in werking ${sinceDate(k.since)}`] : [])
];
