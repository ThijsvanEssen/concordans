// The weergave Keten of the werkplek (besluit 39, mockup A197-c): a law, the articles it gives
// powers in, and the regulations issued under them, in layers from top to bottom: AMvB,
// ministeriële regeling, beleidsregel, the rest. Above the law, the laws its own preamble names
// (a regulation's grondslag). From /api/instruments/{bwb}/delegated and /basis; pure, so the
// drawing on a wide screen and the list on a phone read one model.
import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { articleRef } from '$lib/text/bw';
import { NL } from '$lib/text/collator';
import { grondslagArtikelen } from '$lib/text/delegaties';
import { kindName } from '$lib/text/law-kind';

type Delegated = Schema<'InstrumentDelegatedResponse'>;
type Basis = Schema<'InstrumentBasisResponse'>;
type Summary = Schema<'InstrumentSummaryDTO'>;
type BasisArticle = Schema<'ImplementedBasisArticleDTO'>;
type Item = Delegated['items'][number];

export type LayerId =
	| 'eu'
	| 'basis'
	| 'law'
	| 'article'
	| 'implementation'
	| 'statute'
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
	kb: 'Koninklijk besluit',
	article: 'Artikel',
	amvb: 'AMvB',
	ministerial: 'Ministeriële regeling',
	policy: 'Beleidsregel',
	other: 'Overige regelingen'
};

/** The order of the layers of regulations under the articles. */
const REGULATION_LAYERS: LayerId[] = ['statute', 'amvb', 'kb', 'ministerial', 'policy', 'other'];

export type ChainNode = {
	/** The node id: `instruments/bwbr…`, `articles/bwbr…_16`. */
	id: string;
	name: string;
	/** Short, on the drawing: `art. 16`. */
	short: string;
	collection: 'instruments' | 'articles';
	instrument?: Summary;
	/** Its BWB type, lower case (`amvb`), as the card names its kind. */
	kind: string | null;
	/** In force since, for a regulation; the tijdstrook places it there. */
	since: string | null;
	/** `grondslag art. 16, 20 en 33`, `noemt art. 22`: how it hangs under the law. */
	grondslag: string | null;
	mentions: string | null;
	/** The nodes of the layer above it, and how: a power given, or only named. */
	parents: { id: string; way: 'delegates' | 'mentioned' }[];
	/** The regulations issued under it in turn, one level down. */
	further: string[];
};

export type ChainLayer = { id: LayerId; label: string; nodes: ChainNode[] };

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

/** `art. 16` of an article as its law numbers it. */
const articleShort = (a: BasisArticle) =>
	a.article_number ? articleRef(null, a.article_number) : 'aanhef';

/** The articles it rests on, or only names: `art. 16 lid 1 en 2, 20` (delegaties.ts). */
const basisLine = (articles: readonly BasisArticle[], way: 'delegates' | 'mentioned') =>
	grondslagArtikelen(
		articles
			.filter((a) => (a.basis_kind ?? 'delegates') === way)
			.sort((a, b) => NL.compare(a.article_number ?? '', b.article_number ?? ''))
	);

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
	/** The EU acts the law implements, above it, and the laws that implement it, below (F1). */
	eu?: { implements: readonly EuInstrument[]; implementedBy: readonly EuInstrument[] } | null;
};

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
	parents,
	further: []
});

/**
 * The layers of the keten of `wet` (its summary), from what /delegated, /basis and /eu-links
 * give. Up to `max` regulations a layer, and `keep`; the rest are listed apart (`more`), not
 * drawn.
 */
export function chain(
	law: { id: string; name: string; instrument?: Summary },
	delegated: Delegated | null,
	basis: Basis | null,
	{
		max = Number.POSITIVE_INFINITY,
		keep = null,
		kind = null,
		article = null,
		eu = null,
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
	const capped = (id: LayerId, list: ChainNode[]) => {
		const drawn = list.filter((n, i) => i < max || n.id === keep);
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
	if (basis?.items.length)
		layers.push({
			id: 'basis',
			label: LAYER_LABEL.basis,
			nodes: basis.items.map((b) => ({
				id: b.instrument.id,
				name: nameOf(b.instrument),
				short: nameOf(b.instrument),
				collection: 'instruments',
				instrument: b.instrument,
				kind: b.kind ?? null,
				since: null,
				grondslag: basisLine(b.articles, 'delegates'),
				mentions: basisLine(b.articles, 'mentioned'),
				parents: [],
				further: []
			}))
		});
	layers.push({
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
				parents: [
					...(basis?.items ?? []).map((b) => ({
						id: b.instrument.id,
						way: b.basis_kind === 'mentioned' ? ('mentioned' as const) : ('delegates' as const)
					})),
					...(eu?.implements ?? []).map((i) => ({ id: i.id, way: 'delegates' as const }))
				],
				further: []
			}
		]
	});
	// Every regulation once, in the layer of its kind: those under an article of the law, and
	// those under a regulation of it in turn (sub_delegated: the Cyberbeveiligingsregelingen
	// under the Cyberbeveiligingsbesluit), each tied to what it is issued under.
	const byId = new Map<string, { node: ChainNode; articles: BasisArticle[] }>();
	const wayOf = (kind: string | null | undefined): 'delegates' | 'mentioned' =>
		kind === 'mentioned' ? 'mentioned' : 'delegates';
	const take = (
		r: Pick<Item, 'instrument' | 'kind' | 'date_in_force' | 'basis_kind' | 'articles'> & {
			sub_delegated?: Item['sub_delegated'];
		},
		parents: ChainNode['parents'],
		ownArticles: BasisArticle[]
	) => {
		const known = byId.get(r.instrument.id);
		if (known) {
			for (const p of parents)
				if (!known.node.parents.some((q) => q.id === p.id)) known.node.parents.push(p);
			return;
		}
		byId.set(r.instrument.id, {
			articles: ownArticles,
			node: {
				id: r.instrument.id,
				name: nameOf(r.instrument),
				short: nameOf(r.instrument),
				collection: 'instruments',
				instrument: r.instrument,
				kind: r.kind ?? null,
				since: r.date_in_force ?? null,
				grondslag: ownArticles.length ? basisLine(ownArticles, 'delegates') : null,
				mentions: ownArticles.length ? basisLine(ownArticles, 'mentioned') : null,
				parents,
				further: (r.sub_delegated ?? []).map((sub) => nameOf(sub.instrument))
			}
		});
	};
	for (const item of own) {
		const mine = item.articles.filter((a) => !article || a.article_number === article);
		take(
			item,
			mine.map((a) => ({ id: a.id, way: wayOf(a.basis_kind ?? item.basis_kind) })),
			mine
		);
	}
	for (const item of own)
		for (const sub of item.sub_delegated ?? [])
			take(sub, [{ id: item.instrument.id, way: wayOf(sub.basis_kind) }], []);
	// Without the mentions, a regulation that only names the law is no part of its keten.
	const nodes = [...byId.values()].filter(
		({ node }) => mentions || node.parents.some((p) => p.way === 'delegates')
	);
	if (!mentions)
		for (const { node } of nodes) node.parents = node.parents.filter((p) => p.way === 'delegates');
	// Ordered by what they hang under, so the lines cross as little as they can: an article by
	// its number, a regulation under a regulation by that one's place.
	const articleOrder = (id: string) => {
		const a = own.flatMap((i) => i.articles).find((x) => x.id === id);
		return a ? articleShort(a) : null;
	};
	const placeOf = new Map<string, number>();
	const keyOf = (n: ChainNode) => {
		const at = n.parents.map((p) => placeOf.get(p.id)).filter((x): x is number => x !== undefined);
		return at.length ? Math.min(...at) : Number.POSITIVE_INFINITY;
	};
	const articleIds = [
		...new Set(nodes.flatMap(({ node }) => node.parents.map((p) => p.id)).filter(articleOrder))
	].sort((x, y) => NL.compare(articleOrder(x)!, articleOrder(y)!));
	articleIds.forEach((id, i) => placeOf.set(id, i));
	const perLayer = new Map<LayerId, ChainNode[]>();
	const articles = new Map<string, ChainNode>();
	let place = articleIds.length;
	for (const id of REGULATION_LAYERS) {
		const all = nodes
			.map(({ node }) => node)
			.filter((n) => layerOf(n.kind) === id)
			.sort((x, y) => keyOf(x) - keyOf(y) || NL.compare(x.name, y.name));
		const drawn: ChainNode[] = [];
		for (const n of all) {
			if (drawn.length >= max && n.id !== keep) {
				rest[id] = (rest[id] ?? 0) + 1;
				(more[id] ??= []).push(n);
				continue;
			}
			drawn.push(n);
			for (const a of byId.get(n.id)!.articles)
				if (!articles.has(a.id))
					articles.set(a.id, {
						id: a.id,
						name: a.display_name ?? articleShort(a),
						short: articleShort(a),
						collection: 'articles',
						kind: null,
						since: null,
						grondslag: null,
						mentions: null,
						parents: [{ id: law.id, way: 'delegates' }],
						further: []
					});
		}
		for (const n of all) placeOf.set(n.id, place++);
		if (drawn.length) perLayer.set(id, drawn);
	}
	if (articles.size)
		layers.push({
			id: 'article',
			label: LAYER_LABEL.article,
			nodes: [...articles.values()].sort((a, b) => NL.compare(a.short, b.short))
		});
	if (eu?.implementedBy.length)
		layers.push({
			id: 'implementation',
			label: LAYER_LABEL.implementation,
			nodes: capped(
				'implementation',
				eu.implementedBy.map((i) => euNode(i, [{ id: law.id, way: 'delegates' }]))
			)
		});
	for (const id of REGULATION_LAYERS) {
		const list = perLayer.get(id);
		if (list?.length) layers.push({ id, label: LAYER_LABEL[id], nodes: list });
	}
	return { layers, rest, more, total: nodes.length, amending, missing };
}
