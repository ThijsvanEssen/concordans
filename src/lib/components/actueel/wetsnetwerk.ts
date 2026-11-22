// The network of the last passed bill, above Actueel on the start page: the article it
// changes most, drawn by home-network, and the Verkenner on its dossier, its stukken, the
// laws they change and the judgments on the article. Chosen by a rule, not by hand: the
// newest passed bill that changes articles. Its links are made as from outside the Verkenner.
import { getChangedArticles } from '$lib/api/dossiers';
import { getFeed } from '$lib/api/feed';
import { report } from '$lib/api/errors';
import { getCitedByTop } from '$lib/api/articles';
import { getNodeVerbonden } from '$lib/api/records';
import type { Schema } from '$lib/api/types';
import { exploreHref } from '$lib/bron/address';
import {
	articleLabel,
	type ChangedArticles,
	type ChangedLaw,
	type DossierChange
} from '$lib/components/parliamentary/changed-articles';
import { dossierName, dossierVolledigeTitel } from '$lib/bron/dossier-naam';
import type { Chamber } from '$lib/components/parliamentary/chamber';
import { AMENDING_BILL_KINDS } from '$lib/votes/stages';

type FeedItem = Schema<'FeedItemDTO'>;
export type CitedBy = Schema<'ArticleCitedByResponse'>;

/** A bill the Kamer passed: by its dossier, the day and the Kamer. */
/** `titel`: the whole title where the name is cut, for the heading of the band. */
type Kandidaat = { number: string; naam: string; titel: string; datum: string; kamer: Chamber };

/** The changed-articles asked at most, the summary's candidates and the older ones together. */
const POGINGEN = 4;

/**
 * The bills passed, newest first, each dossier once: a vote on a law that passed. On one day
 * the Eerste Kamer goes first, as its vote is the last.
 */
export function kandidaten(items: readonly FeedItem[]): Kandidaat[] {
	const out = new Map<string, Kandidaat>();
	const passed = items
		.filter(
			(i) =>
				i.kind === 'stemming' &&
				i.vote?.passed &&
				i.dossier &&
				AMENDING_BILL_KINDS.has(i.subkind ?? '')
		)
		.map((i) => ({
			number: i.dossier!.number,
			naam: dossierName(i.dossier!),
			titel: dossierVolledigeTitel(i.dossier!) ?? dossierName(i.dossier!),
			datum: i.date,
			kamer: i.vote!.chamber
		}))
		.sort((a, b) => b.datum.localeCompare(a.datum) || a.kamer.localeCompare(b.kamer));
	for (const k of passed) if (!out.has(k.number)) out.set(k.number, k);
	return [...out.values()];
}

export type Schets = {
	kandidaat: Kandidaat;
	/** The Verkenner on the dossier, every stuk that changes a law, the laws, the article and
	 *  its judgments. */
	exploreHref: string;
	/** The changed article the small network draws in the middle (home-network). */
	centrum: { id: string; naam: string };
};

/** The number of a stuk in its dossier, for their order; a publication has none. */
const nummer = (s: DossierChange['source']) =>
	Number.parseInt(s.number ?? String(s.sequence ?? ''), 10) || Number.MAX_SAFE_INTEGER;

/** The judgments the Verkenner opens with besides the article. */
const UITSPRAKEN = 2;

export function schetsVan(k: Kandidaat, ch: ChangedArticles, cb: CitedBy | null): Schets | null {
	const laws = [...ch.laws].sort((a, b) => b.total - a.total);
	const law = laws[0];
	const art = law ? mostChanged(law) : null;
	if (!law || !art) return null;
	const changes = laws.flatMap((l) => l.changes);
	const stukken = [...new Map(changes.map((c) => [c.source.id, c.source])).values()]
		.sort((a, b) => nummer(a) - nummer(b))
		.map((s) => s.id);
	const uitspraken = [...new Set((cb?.items ?? []).map((i) => i.judgment.id))].slice(0, UITSPRAKEN);
	// No focus: the canvas takes the page, as the band's network grown, not a reader.
	const netwerk = [
		`dossiers/${k.number}`,
		...stukken,
		...laws.map(lawNodeId),
		art.id,
		...uitspraken
	];
	return {
		kandidaat: k,
		exploreHref: exploreHref(new URLSearchParams({ netwerk: netwerk.join(',') })),
		centrum: { id: art.id, naam: articleLabel(law.law, art) }
	};
}

const lawKey = (l: ChangedLaw) =>
	(l.law.id ?? l.law.bwb_id ?? '').replace(/^instruments\//, '').toLowerCase();
const lawNodeId = (l: ChangedLaw) => `instruments/${lawKey(l)}`;

/** The bills the Eerste Kamer passed before the summary's days: its votes are on bills only. */
async function oudere(today: string, signal?: AbortSignal): Promise<Kandidaat[]> {
	const { items } = await getFeed(
		{ kind: 'stemming', chamber: 'EK', limit: 50, facets: false, until: today },
		{ signal, wait: 'short' }
	);
	return kandidaten(items);
}

/** A failure of what is asked ahead: told, and asked again by whoever needs it. */
const reportAhead = (e: unknown) => report('Wetsnetwerk', e);

/** The bills whose changed-articles are asked at once, the newest of the summary. */
const AT_ONCE = 2;

/** The key of the changed article as its node is asked (`articles/<key>`). */
const keyOf = (id: string) => id.slice(id.indexOf('/') + 1);

/**
 * The two nodes the drawing is made from: the changed article and its dossier. Asked once, so
 * the drawing and the call that asks them early share one answer.
 */
export const networkNodes = (s: Pick<Schets, 'kandidaat' | 'centrum'>) =>
	Promise.all([
		getNodeVerbonden('articles', keyOf(s.centrum.id)),
		getNodeVerbonden('dossiers', s.kandidaat.number)
	]);

/**
 * What the drawing needs, asked while the judgments are: its two nodes and its two chunks
 * (neither waits for them). A failure is the drawing's to report when it asks again.
 */
function prefetch(s: Schets) {
	networkNodes(s).catch(reportAhead);
	import('$lib/verbonden/NetworkSketch.svelte').catch(reportAhead);
	import('./home-network').catch(reportAhead);
}

/** The first of the bills, in their order, whose dossier changes articles; all asked at once. */
async function firstChanging(list: Kandidaat[], signal?: AbortSignal) {
	const answers = list.map((k) => getChangedArticles(k.number).catch(() => null));
	for (const [i, k] of list.entries()) {
		const ch = await answers[i];
		if (signal?.aborted) return null;
		if (ch && ch.total > 0) return { k, ch };
	}
	return null;
}

/**
 * The newest passed bill that changes articles: first among the summary's items, then among
 * the older votes of the Eerste Kamer, at most POGINGEN bills asked. Nothing here waits for
 * what it does not need: the older votes are asked at once, and as they come the first of
 * their bills are asked beside the summary's (the answers are kept, so they are read at no
 * cost if the summary's bills change nothing). Only a bill beyond these waits for them.
 */
async function pick(items: readonly FeedItem[], today: string, signal?: AbortSignal) {
	const fromSummary = kandidaten(items);
	const first = fromSummary.slice(0, AT_ONCE);
	const seen = new Set(first.map((k) => k.number));
	const further = oudere(today, signal).then((older) => {
		const list: Kandidaat[] = [];
		for (const k of [...fromSummary.slice(AT_ONCE), ...older])
			if (!seen.has(k.number)) {
				seen.add(k.number);
				list.push(k);
			}
		const next = list.slice(0, POGINGEN - first.length);
		for (const k of next.slice(0, AT_ONCE)) getChangedArticles(k.number).catch(reportAhead);
		return next;
	});
	further.catch(reportAhead);
	const found = await firstChanging(first, signal);
	if (found || signal?.aborted) return found;
	// The older bills in turns of AT_ONCE: the next only if these change nothing.
	const rest = await further;
	for (let i = 0; i < rest.length; i += AT_ONCE) {
		const g = await firstChanging(rest.slice(i, i + AT_ONCE), signal);
		if (g || signal?.aborted) return g;
	}
	return null;
}

/**
 * The sketch of the newest passed bill that changes articles (pick). Only the judgments
 * wait for the article the bill changes; the drawing's nodes and chunks are asked beside them.
 * Null when none answers.
 */
export async function laadWetsnetwerk(
	items: readonly FeedItem[],
	today: string,
	signal?: AbortSignal
): Promise<Schets | null> {
	const found = await pick(items, today, signal);
	if (!found || signal?.aborted) return null;
	const { k, ch } = found;
	const base = schetsVan(k, ch, null);
	if (!base) return null;
	prefetch(base);
	const law = [...ch.laws].sort((a, b) => b.total - a.total)[0];
	const bwb = law?.law.bwb_id;
	const top = law ? mostChanged(law) : null;
	const cb =
		bwb && top?.article_number
			? await getCitedByTop(bwb, top.article_number, signal).catch(() => null)
			: null;
	// A caller that left ignores the answer; the shared cited-by goes on for others.
	if (signal?.aborted) return null;
	return schetsVan(k, ch, cb);
}

/** The article a law's changes touch most often; the first of them on a tie. */
function mostChanged(law: ChangedLaw) {
	const tel = new Map<string, { a: DossierChange['article']; n: number }>();
	for (const c of law.changes) {
		const t = tel.get(c.article.id);
		if (t) t.n++;
		else tel.set(c.article.id, { a: c.article, n: 1 });
	}
	let best: { a: DossierChange['article']; n: number } | null = null;
	for (const t of tel.values()) if (!best || t.n > best.n) best = t;
	return best?.a ?? null;
}
