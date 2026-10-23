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

export type LayerId =
	| 'eu'
	| 'basis'
	| 'law'
	| 'article'
	| 'implementation'
	| 'amvb'
	| 'ministerial'
	| 'policy'
	| 'other';

const LAYER_LABEL: Record<LayerId, string> = {
	eu: 'EU-recht',
	basis: 'Grondslag',
	law: 'Wet',
	implementation: 'Implementatie',
	article: 'Artikel',
	amvb: 'AMvB',
	ministerial: 'Ministeriële regeling',
	policy: 'Beleidsregel',
	other: 'Overige regelingen'
};

/** The order of the layers of regulations under the articles. */
const REGULATION_LAYERS: LayerId[] = ['amvb', 'ministerial', 'policy', 'other'];

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

const layerOf = (kind: string | null | undefined): LayerId =>
	kind === 'amvb'
		? 'amvb'
		: kind === 'ministeriele-regeling'
			? 'ministerial'
			: kind === 'beleidsregel'
				? 'policy'
				: 'other';

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
export type ChainOptions = {
	/** Up to this many regulations a layer are drawn (the API sorts them by title). */
	max?: number;
	/** A regulation drawn whatever `max`: the one marked. */
	keep?: string | null;
	/** The kind of the start (`AMvB`, `beleidsregel`, `publicatie`): its layer's heading. */
	kind?: string | null;
	/** An article as the start: only the regulations issued under it (R3-K F5). */
	article?: string | null;
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
		eu = null
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
	const perLayer = new Map<LayerId, ChainNode[]>();
	const articles = new Map<string, ChainNode>();
	for (const item of own) {
		const layer = layerOf(item.kind);
		const list = perLayer.get(layer) ?? [];
		perLayer.set(layer, list);
		const node: ChainNode = {
			id: item.instrument.id,
			name: nameOf(item.instrument),
			short: nameOf(item.instrument),
			collection: 'instruments',
			instrument: item.instrument,
			kind: item.kind ?? null,
			since: item.date_in_force ?? null,
			grondslag: basisLine(item.articles, 'delegates'),
			mentions: basisLine(item.articles, 'mentioned'),
			parents: item.articles
				.filter((a) => !article || a.article_number === article)
				.map((a) => ({
					id: a.id,
					way: (a.basis_kind ?? item.basis_kind) === 'mentioned' ? 'mentioned' : 'delegates'
				})),
			further: (item.sub_delegated ?? []).map((s) => nameOf(s.instrument))
		};
		if (list.length >= max && item.instrument.id !== keep) {
			rest[layer] = (rest[layer] ?? 0) + 1;
			(more[layer] ??= []).push(node);
			continue;
		}
		for (const a of item.articles)
			if (!articles.has(a.id) && (!article || a.article_number === article))
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
		list.push(node);
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
		const nodes = perLayer.get(id);
		if (nodes?.length) layers.push({ id, label: LAYER_LABEL[id], nodes });
	}
	return { layers, rest, more, total: own.length, amending, missing };
}
