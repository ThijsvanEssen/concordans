// The questions of the overview of a topic (onderwerpen/overzicht), as plain functions: the
// topic in, the counts or the rows out. The page asks each on its own, the cheapest first.
import { api, unwrap } from '$lib/api/client';
import { report } from '$lib/api/errors';
import { geteld } from '$lib/api/decisions';
import { feedStand, normalizeItem, type FeedItem } from '$lib/components/actueel/feed';
import { getAmendementen } from '$lib/components/parliamentary/amendementen';
import type { Chamber } from '$lib/components/parliamentary/chamber';
import { daysBetween, vandaag } from '$lib/text/datum';
import { twoAtATime } from '$lib/util/two-at-a-time';
import { uitFacets, type Besluit, type Getelden, type Stem } from './overzicht';
import {
	FEED_KOLOM,
	amendementKetens,
	kolomVanKind,
	type Amendement,
	type Dag,
	type Kolom,
	type Telbaar
} from './kruiswoord';

/** Decisions and feed events the API gives in one page. */
export const PAGE_SIZE = 200;
/** Pages of the feed counted at most, the newest first. */
const FEED_PAGES = 5;
/** Dossiers whose amendments are followed at most (one request each, cached). */
export const DOSSIERS_MAX = 20;
/** Decisions asked at most for one question: a list counted here, or the CSV. */
const DECISIONS_MAX = 2000;
/** The API counts per day over at most this many days from a first day. */
const DAYS_MAX = 400;

/** The words of the topic, its Kamer and its period, as the address gives them. */
export type Topic = { words: string[]; chamber: Chamber | ''; from: string; to: string };

/** The topic as /api/decisions takes it. */
export const decisionQuery = (t: Topic) => ({
	q: t.words,
	...(t.chamber ? { chamber: t.chamber } : {}),
	...(t.from ? { from: t.from } : {}),
	...(t.to ? { to: t.to } : {})
});

/** The topic as /api/feed takes it. */
export const feedQuery = (t: Topic) => ({
	q: t.words,
	...(t.chamber ? { chamber: t.chamber } : {}),
	...(t.from ? { since: t.from } : {}),
	...(t.to ? { until: t.to } : {})
});

type FeedQuery = ReturnType<typeof feedQuery> & { kind: string };

/** The newest day of the Kamers' papers the feed reads: the grid's last month. */
const newestDay = (dataAsOf: Parameters<typeof feedStand>[0]) =>
	feedStand(dataAsOf)?.newest.slice(0, 10) ?? null;

const days = (r: Awaited<ReturnType<typeof geteld>>): Dag[] =>
	(r.facets?.days ?? []).flatMap((d) =>
		d.date ? [{ date: d.date, count: d.count, passed: d.passed ?? 0 }] : []
	);

type DecisionCounts = { counted: Getelden | null; days: Dag[]; total: number | null };

/** The stemmingen of the topic counted: per day with how many passed, per kind, and in all. */
export async function countDecisions(t: Topic, signal: AbortSignal): Promise<DecisionCounts> {
	const r = await geteld({ ...decisionQuery(t), limit: 1 }, signal);
	return {
		counted: r.facets?.years ? uitFacets(r.facets, null) : null,
		days: days(r),
		total: r.total
	};
}

/** One fractie's voor and tegen per day: two counted questions, no list. */
export async function countFactionVotes(
	t: Topic,
	party: string,
	signal: AbortSignal
): Promise<{ voor: Dag[]; tegen: Dag[] }> {
	const daysOf = (vote: Stem) =>
		geteld({ ...decisionQuery(t), party, vote, limit: 1 }, signal).then((r) =>
			days(r).map(({ date, count }) => ({ date, count }))
		);
	const [voor, tegen] = await Promise.all([daysOf('voor'), daysOf('tegen')]);
	return { voor, tegen };
}

/** Every decision of one question, page after page, DECISIONS_MAX at most. */
export async function allDecisions(query: Record<string, unknown>, signal?: AbortSignal) {
	const all: Besluit[] = [];
	for (let offset = 0; offset < DECISIONS_MAX; offset += PAGE_SIZE) {
		const r = await unwrap(
			api.GET('/api/decisions', {
				params: { query: { ...query, limit: PAGE_SIZE, offset } },
				signal
			})
		);
		all.push(...r.items);
		// A total still being counted (null) says nothing: a short page ends it.
		if (r.items.length < PAGE_SIZE || (r.total !== null && offset + PAGE_SIZE >= r.total)) break;
	}
	return all;
}

/** The moties of the topic per kind, with the day of the last one where a kind had more. */
export async function motionsOf(
	t: Topic,
	kinds: string[],
	signal: AbortSignal
): Promise<{ motions: Besluit[]; boundary: string | null }> {
	const lists = await Promise.all(
		kinds.map((kind) => allDecisions({ ...decisionQuery(t), kind }, signal))
	);
	const boundary =
		lists
			.filter((l) => l.length >= DECISIONS_MAX)
			.map((l) => l.at(-1)?.date ?? '')
			.sort()
			.at(-1) || null;
	return { motions: lists.flat(), boundary };
}

/** A fractie's vote on each motie of the topic. */
export async function factionVotesOn(
	query: Record<string, unknown>,
	party: string,
	signal?: AbortSignal
): Promise<ReadonlyMap<string, Stem>> {
	const votes = new Map<string, Stem>();
	await Promise.all(
		(['voor', 'tegen'] as const).map((vote) =>
			allDecisions({ ...query, party, vote }, signal).then((xs) => {
				for (const d of xs) votes.set(d.key, vote);
			})
		)
	);
	return votes;
}

/**
 * The feed's question page after page, the newest first, FEED_PAGES at most; each page is
 * handed on as it comes, with the newest day of the data. The day of the last event, where the
 * feed had more than was asked; else null.
 */
async function feedPages(
	query: FeedQuery,
	signal: AbortSignal,
	onPage: (items: FeedItem[], newest: string | null) => void
): Promise<string | null> {
	let cursor: string | undefined;
	let last: string | null = null;
	for (let n = 0; n < FEED_PAGES; n++) {
		const r = await unwrap(
			api.GET('/api/feed', {
				params: {
					query: { ...query, limit: PAGE_SIZE, facets: false, ...(cursor ? { cursor } : {}) }
				},
				signal
			})
		);
		const items = r.items.map(normalizeItem);
		onPage(items, newestDay(r.data_as_of));
		last = items.at(-1)?.date ?? last;
		cursor = r.next_cursor ?? undefined;
		if (!cursor) return null;
	}
	return last;
}

/** Per month, or per day for weeks, which the API allows over DAYS_MAX from a first day. */
export function periodUnit(week: boolean, from: string, to: string): 'day' | 'month' | null {
	if (!week) return 'month';
	return from && daysBetween(from, to || vandaag()) <= DAYS_MAX ? 'day' : null;
}

/** The feed's events counted per period: whole, and the amendments too where `chains`. */
export type PeriodCounts = { counted: Telbaar[]; chains: boolean; newest: string | null };

/**
 * Moties, brieven and toezeggingen counted per period by /api/feed/periods (#444), in one
 * call, and the amendments once per chain (`amendment_chains`, #451); null where the answer is
 * not whole (`partial`).
 */
async function countPeriods(
	t: Topic,
	per: 'day' | 'month',
	signal: AbortSignal
): Promise<PeriodCounts | null> {
	const r = await unwrap(
		api.GET('/api/feed/periods', { params: { query: { ...feedQuery(t), per } }, signal })
	);
	if (r.partial) return null;
	const periods = r.periods ?? [];
	const chains = periods.every((p) => p.amendment_chains != null);
	const counted = periods.flatMap((p): Telbaar[] => [
		...Object.entries(p.counts ?? {}).flatMap(([kind, count]) => {
			const kolom = kolomVanKind(kind);
			return kolom && kolom !== 'amendementen' ? [{ date: p.period, kolom, count }] : [];
		}),
		...(chains && p.amendment_chains?.count
			? [{ date: p.period, kolom: 'amendementen' as Kolom, count: p.amendment_chains.count }]
			: [])
	]);
	return { counted, chains, newest: newestDay(r.data_as_of) };
}

/** Every kind of the feed the grid counts. */
const FEED_KINDS = Object.values(FEED_KOLOM).join(',');

/**
 * The feed's events of the topic: counted per period where the API counts them whole, else
 * (or for the amendments where their chains are not counted) the feed's pages, each as it
 * comes. The day of the last event counted, where the pages ran out first.
 */
export async function countFeed(
	t: Topic,
	week: boolean,
	signal: AbortSignal,
	on: {
		periods: (p: PeriodCounts) => void;
		page: (items: FeedItem[], newest: string | null) => void;
	}
): Promise<string | null> {
	const per = periodUnit(week, t.from, t.to);
	// Without the periods the feed's pages count, as before #444.
	const periods = per
		? await countPeriods(t, per, signal).catch((e) => {
				report('Overzicht perioden', e);
				return null;
			})
		: null;
	if (periods) on.periods(periods);
	// Everything counted: the feed waits for a cell of the amendments.
	if (periods?.chains) return null;
	const kind = periods ? FEED_KOLOM.amendementen! : FEED_KINDS;
	return feedPages({ ...feedQuery(t), kind }, signal, on.page);
}

/** The amendment papers of a period, for the cell of the amendments counted by their chains. */
export const amendmentPapers = (
	t: Topic,
	signal: AbortSignal,
	onPage: (items: FeedItem[]) => void
) => feedPages({ ...feedQuery(t), kind: FEED_KOLOM.amendementen! }, signal, onPage);

/** The dossiers the amendment papers belong to, once each. */
export const dossiersOf = (papers: readonly FeedItem[]) => [
	...new Map(
		papers.flatMap((i) => (i.dossier ? [[i.dossier.key, i.dossier] as const] : []))
	).values()
];

/**
 * An amendment once per chain: the timetable of each dossier holding one of the papers
 * (getAmendementen: one neighbourhood, cached), its chains that hold such a paper. Two dossiers
 * at a time, DOSSIERS_MAX at most; `onFound` has every chain found so far, the newest first.
 */
export async function followChains(
	papers: readonly FeedItem[],
	signal: AbortSignal,
	onFound: (found: Amendement[]) => void
): Promise<void> {
	const ids = new Set(papers.map((i) => `${i.node.collection}/${i.node.key}`));
	const found = new Map<string, Amendement>();
	await twoAtATime(dossiersOf(papers).slice(0, DOSSIERS_MAX), async (d) => {
		signal.throwIfAborted();
		const timetable = await getAmendementen(d.key);
		signal.throwIfAborted();
		for (const a of amendementKetens(timetable?.rijen ?? [], ids, d.number))
			if (!found.has(a.id)) found.set(a.id, a);
		onFound([...found.values()].sort((a, b) => b.datum.localeCompare(a.datum)));
	});
}
