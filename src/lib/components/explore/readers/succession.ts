// The place of an article in a recodification (API `successors` and `predecessors`,
// `TRANSPOSED_TO`): the article of the new law that takes its place, or the article of the
// old law whose place it takes, as the transposition table gives them.
import type { Schema } from '$lib/api/types';
import { citeArticle } from '$lib/text/cite';
import { lawShortName } from '$lib/text/bw';
import { enactedLawOfKey } from '$lib/text/enacted-law';
import { joinAnd, plural, textOf } from '$lib/text/words';
import type { LidPairing } from '$lib/text/version-diff';
import { neighborsOf, type Neighbor, type NodeGraph } from '$lib/api/nodes';
import { isTranspositionOutcome } from '$lib/vocabulary';
import { isCelex } from '$lib/bron/address';
import {
	readTranspositionOutcome,
	type TableOutcome,
	type OutcomePart,
	type TranspositionOutcome
} from '$lib/verbonden/edge-meta';
import { outcomePlace } from '$lib/verbonden/relation-words';

export type Succession = Schema<'ArticleSuccessionDTO'>;

/** The names of the law of the article on screen. */
export type OwnLaw = { citationTitle: string | null; shortTitle: string | null };

/** Which way the line reads: to the new law (`successors`) or from the old (`predecessors`). */
export type Direction = 'new' | 'old';

/**
 * The other article as a lawyer cites it: `art. 126ffa Sv`. A new code under the old one's
 * title without a short title of its own takes the old one's, marked: `art. 2.8.6 Sv (nieuw)`.
 */
export function successionName(s: Succession, own: OwnLaw, direction: Direction): string {
	const a = s.article;
	const number = a.article_number ?? '';
	const law = a.instrument;
	const short = lawShortName(law?.bwb_id, law?.abbreviation ?? law?.short_title);
	const title = law?.citation_title ?? law?.title ?? null;
	const sameTitle = !!title && !!own.citationTitle && title === own.citationTitle;
	if (!short && sameTitle) {
		const { kort } = citeArticle({
			bwbId: a.bwb_id,
			articleNumber: number,
			shortTitle: own.shortTitle,
			citationTitle: title
		});
		return `${kort} ${direction === 'new' ? '(nieuw)' : '(oud)'}`;
	}
	if (!title && !short) return a.display_name ?? `art. ${number}`;
	return citeArticle({
		bwbId: a.bwb_id,
		articleNumber: number,
		shortTitle: short,
		citationTitle: title ?? short ?? ''
	}).kort;
}

/**
 * The article on screen as the line names its counterpart: a new code under the old one's
 * title, without a short title of its own, by the old one's (`art. 2.8.6 Sv (nieuw)`); null
 * where its own citation serves.
 */
export function ownSuccessionName(
	s: Succession,
	own: OwnLaw,
	number: string,
	direction: Direction
): string | null {
	const law = s.article.instrument;
	const short = lawShortName(law?.bwb_id, law?.abbreviation ?? law?.short_title);
	const title = law?.citation_title ?? law?.title ?? null;
	if (own.shortTitle || !short || !title || title !== own.citationTitle) return null;
	// The other is old where the line reads Voorheen: this one is the new.
	return `art. ${number} ${short} ${direction === 'old' ? '(nieuw)' : '(oud)'}`;
}

/** The status of the other law where it is not in force: `vastgesteld, nog niet in werking`. */
export function successionStatus(s: Succession): string | null {
	if (s.in_force !== false) return null;
	return `${s.status ?? 'vastgesteld'}, nog niet in werking`;
}

/** One row of the leden: the leden of the old article and their place in the new law. */
type PartRow = { old: string; place: string };

/** A part of the old article and its place in the new law, or what became of it. */
type Placed = Pick<Succession['parts'][number], 'old_part' | 'new_place'>;

/**
 * The leden of the old article by their place in the new law, as the table writes it; the
 * leden that go to one place in one row: `leden 1, 2 en 3`, `2.8.6, 1`. Nothing for a whole
 * article that goes to one place: the line says that already, unless `whole` (the line names
 * another place).
 */
export function partRows(
	parts: readonly Placed[],
	{ whole = false }: { whole?: boolean } = {}
): PartRow[] {
	const byPlace = new Map<string, string[]>();
	for (const p of parts) {
		const olds = byPlace.get(p.new_place) ?? [];
		if (!olds.includes(p.old_part)) olds.push(p.old_part);
		byPlace.set(p.new_place, olds);
	}
	const rows = [...byPlace].map(([place, olds]) => {
		const leden = olds.filter(Boolean);
		const whole = leden.length < olds.length;
		const old = joinAnd([
			...(whole ? ['het artikel'] : []),
			...(leden.length ? [`${plural(leden.length, 'lid', 'leden')} ${joinAnd(leden)}`] : [])
		]);
		return { old, place };
	});
	return !whole && rows.length === 1 && rows[0].old === 'het artikel' ? [] : rows;
}

/** The tables the line rests on, each once, in the order of the list. */
export function successionSources(
	list: readonly Succession[],
	outcomes: readonly OutcomeEdge[] = []
): string[] {
	return [
		...new Set(
			[
				...list.map((s) => s.source_url),
				...outcomes.map((o) => o.reading.source && sourceUrl(o.reading.source))
			].filter((u): u is string => !!u)
		)
	];
}

/**
 * The page of the source a table is (`meta.source`), as the API makes `source_url`: an EU act
 * by its CELEX number on EUR-Lex, a paper (`kst-34986-3`) on zoek.officielebekendmakingen.nl.
 */
export const sourceUrl = (id: string): string =>
	isCelex(id)
		? `https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:${id}`
		: `https://zoek.officielebekendmakingen.nl/${id}.html`;

/**
 * What a recodification did with an old article no new article takes the place of (an edge
 * TRANSPOSED_TO the new law, `isTranspositionOutcome`): the new law and what the table says.
 */
export type OutcomeEdge = {
	law: { id: string; name: string };
	reading: TranspositionOutcome;
};

/**
 * The new law as the line names it: by its title; a new code under the old one's title by the
 * old one's short title, marked (`Sv (nieuw)`), as `successionName` does an article of it.
 */
function outcomeLawName(n: Neighbor, own: OwnLaw): string {
	const p = (n.props ?? {}) as Record<string, unknown>;
	const title = textOf(p.citation_title) ?? textOf(p.title) ?? textOf(n.display_name);
	const short = lawShortName(textOf(p.bwb_id), textOf(p.abbreviation) ?? textOf(p.short_title));
	if (title && title === own.citationTitle) return `${short ?? own.shortTitle ?? title} (nieuw)`;
	return title ?? short ?? 'de nieuwe wet';
}

/** The outcomes of the old article on screen, from its node (the light one serves). */
export function outcomesOf(response: NodeGraph | null | undefined, own: OwnLaw): OutcomeEdge[] {
	if (!response) return [];
	return neighborsOf(response)
		.filter((n) => n.direction === 'outbound' && isTranspositionOutcome(n.relation, n.collection))
		.map((n) => ({
			law: { id: n.id, name: outcomeLawName(n, own) },
			reading: readTranspositionOutcome(n.meta)
		}));
}

/**
 * A part's place in the fold-out: what became of it (`vervallen`, `blijft in Waterwet`), or for
 * a part no source places, the place as the table writes it (`Besluit B2`).
 */
const outcomePart = (p: OutcomePart): Placed => ({
	old_part: p.from,
	new_place: (p.outcome && outcomePlace(p.outcome)) || p.to || 'niet gevonden'
});

/** Whether two outcomes say the same: `blijft in` the same law. */
const same = (a: TableOutcome | null, b: TableOutcome | null) =>
	!!a && !!b && a.kind === b.kind && a.law === b.law;

/**
 * The parts of the outcomes, as the fold-out lists them beside the parts of the successors.
 * `inLine`: the line says the outcome the parts share, so a part with that outcome adds
 * nothing; a gap keeps them all, each with the place as the table writes it.
 */
export const outcomeParts = (
	outcomes: readonly OutcomeEdge[],
	{ inLine = false }: { inLine?: boolean } = {}
): Placed[] =>
	outcomes.flatMap((o) => {
		const told = inLine && o.reading.outcome?.kind !== 'gat' ? o.reading.outcome : null;
		return o.reading.parts.filter((p) => !same(p.outcome, told)).map(outcomePart);
	});

/** A lid as the table names it: `4`, `2a`; not `2 a` (an onderdeel) or the whole article. */
const LID = /^\d+[a-z]?$/;

/**
 * The leden of the old article the table places in the leden of `newArticle`, those that go
 * together as one pairing: leden 1, 2 and 3 in lid 1 are one pairing, not three.
 */
export function lidPairings(parts: Succession['parts'], newArticle: string): LidPairing[] {
	const groups: LidPairing[] = [];
	for (const p of parts) {
		if (p.new_article !== newArticle || !LID.test(p.old_part) || p.new_leden.length === 0) continue;
		const touching = groups.filter(
			(g) => g.old.includes(p.old_part) || p.new_leden.some((n) => g.new.includes(n))
		);
		const merged: LidPairing = {
			old: [...touching.flatMap((g) => g.old), p.old_part],
			new: [...touching.flatMap((g) => g.new), ...p.new_leden]
		};
		const at = touching.length > 0 ? groups.indexOf(touching[0]) : groups.length;
		for (const g of touching) groups.splice(groups.indexOf(g), 1);
		groups.splice(at, 0, {
			old: [...new Set(merged.old)].sort(byNumber),
			new: [...new Set(merged.new)].sort(byNumber)
		});
	}
	return groups;
}

const byNumber = (a: string, b: string) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b);

/** The other article of a comparison the source makes: old on the left, new on the right. */
type CompareTarget = {
	/** Which side the other article reads on: `new` for a successor, `old` for a predecessor. */
	direction: Direction;
	succession: Succession;
	/** Its address in the API: the law (`STB-2026-56`, `BWBR0001903`) and the number. */
	law: string;
	number: string;
	pairings: LidPairing[];
};

/** The law of an address: `/wetten/STB-2026-56/artikel/2.8.6`, `/wetten/STB-2026-56`. */
const lawOfPath = (path: string | null | undefined) =>
	/^\/wetten\/([^/?#]+)/.exec(path ?? '')?.[1] ?? null;

/**
 * The law of an article as the API asks it (`BWBR0001903`, `STB-2026-56`): its BWB id, else
 * from its address, else from its law's. An article of a law of the Staatsblad has no
 * address of its own (live 0.79.65); its law has, and its key names it too (wet_stb_2026_56).
 */
function lawOfArticle(a: Succession['article']): string | null {
	const law = a.instrument;
	return (
		a.bwb_id ??
		lawOfPath(a.path) ??
		law?.bwb_id ??
		lawOfPath(law?.path) ??
		(law?.key ? enactedLawOfKey(law.key) : null)
	);
}

/**
 * The article `?vergelijk=` names, where the source pairs it with the article on screen
 * (`ownNumber`); null for any other: the reader's own choice, without a source.
 */
export function compareTarget(
	id: string,
	successors: readonly Succession[],
	predecessors: readonly Succession[],
	ownNumber: string
): CompareTarget | null {
	const lists: [Direction, readonly Succession[]][] = [
		['new', successors],
		['old', predecessors]
	];
	for (const [direction, list] of lists) {
		const s = list.find((x) => x.article.id === id);
		const law = s ? lawOfArticle(s.article) : null;
		const number = s?.article.article_number;
		if (!s || !law || !number) continue;
		const newArticle = direction === 'new' ? number : ownNumber;
		return { direction, succession: s, law, number, pairings: lidPairings(s.parts, newArticle) };
	}
	return null;
}
