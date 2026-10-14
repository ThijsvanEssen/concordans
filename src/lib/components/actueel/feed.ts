import { forAgainst } from '$lib/components/parliamentary/stemming';
import { count } from '$lib/text/words';
import { DAY_MS, korteDatum, weekdag } from '$lib/text/datum';
import type { Schema } from '$lib/api/types';
import { API_BASE_URL } from '$lib/api/base-url';
import { isGeneriek } from '$lib/bron/generiek';
import { padHref, parsePad, remember } from '$lib/bron/leesbaar';

// Actueel: what happened, newest first, per day. A day's many items of one kind on one
// dossier (the moties of a debate) fold into one line that opens.

type RawFeedItem = Schema<'FeedItemDTO'>;
export type FeedPerson = Schema<'FeedPersonDTO'>;
/** An item as the page uses it: an id and its persons always there. */
export type FeedItem = Omit<RawFeedItem, 'persons' | 'id'> & { id: string; persons: FeedPerson[] };
export type FeedKind = FeedItem['kind'];

export function normalizeItem(raw: RawFeedItem): FeedItem {
	const item = {
		...raw,
		id: raw.id ?? `${raw.node.collection}/${raw.node.key}`,
		persons: raw.persons ?? []
	};
	onthoudAdres(item);
	return item;
}

/**
 * The readable address of an item, kept with its bron so every link to it (the row's title,
 * Lees verder, a card) is that address and not /explore?focus= (UX-toets 10 Oct, finding 3):
 * the API's `path` where it gives one, else a Kamerstuk by its dossier and number as the feed
 * gives them ("37022", "13"). A paper without either (a motie, a brief: no number in the feed)
 * keeps the Verkenner's address until the API gives its `path`.
 */
function onthoudAdres(i: FeedItem) {
	// Its persons by their own address ("/leden/simon-ceulemans"): a name in the row links there,
	// not to /explore?focus=members/… and its 301 (UX-toets 0.79.44, #47: 86 links).
	for (const p of i.persons) {
		const lid = p.key && p.path ? parsePad(p.path) : null;
		if (lid) remember(padHref(lid), `members/${p.key}`);
	}
	const focus = `${i.node.collection}/${i.node.key}`;
	const pad = i.path ? parsePad(i.path) : null;
	if (pad) {
		remember(padHref(pad), focus);
		return;
	}
	const dossier = i.dossier?.number?.trim();
	const nummer = i.number?.trim();
	if (i.node.collection === 'documents' && dossier && nummer) {
		const kamerstuk = parsePad(`/kamerstukken/${dossier}/${nummer}`);
		if (kamerstuk) remember(padHref(kamerstuk), focus);
	}
}

/**
 * Each kind as a row labels it and a day's heading counts it. A paper of the Kamer by the
 * word of the Tweede Kamer itself (`Brief regering`), as the API gives it.
 */
export const KIND_LABEL: Record<FeedKind, { one: string; many: string }> = {
	stemming: { one: 'Stemming', many: 'stemmingen' },
	'Voorstel van wet': { one: 'Voorstel van wet', many: 'voorstellen van wet' },
	'Nota van wijziging': { one: 'Nota van wijziging', many: 'nota’s van wijziging' },
	Amendement: { one: 'Amendement', many: 'amendementen' },
	Motie: { one: 'Motie', many: 'moties' },
	toezegging: { one: 'Toezegging', many: 'toezeggingen' },
	'Brief regering': { one: 'Brief regering', many: 'brieven regering' },
	publicatie: { one: 'Publicatie', many: 'publicaties' },
	inwerkingtreding: { one: 'Inwerkingtreding', many: 'inwerkingtredingen' },
	uitspraak: { one: 'Uitspraak', many: 'uitspraken' }
};

/** The kinds in the order the filter lists them: what the Kamer decides first. */
export const FEED_KINDS = Object.keys(KIND_LABEL) as FeedKind[];

export const isFeedKind = (value: string): value is FeedKind => Object.hasOwn(KIND_LABEL, value);

/** The kinds of API 0.47 and before, as a link from then names them in `?soort=`. */
const OLD_KIND: Record<string, FeedKind> = {
	wetsvoorstel: 'Voorstel van wet',
	nota_van_wijziging: 'Nota van wijziging',
	amendement: 'Amendement',
	motie: 'Motie',
	brief_regering: 'Brief regering'
};

/** A kind from the URL: as the API names it, or by its name before API 0.48. */
export const kindFromParam = (value: string): FeedKind | null =>
	isFeedKind(value) ? value : (OLD_KIND[value] ?? null);

// A dossier by number and name: one helper for the whole site ($lib/bron/dossier-naam).
import { dossierLabel, dossierName } from '$lib/bron/dossier-naam';
export { dossierLabel, dossierName };

/**
 * What a row is called: a toezegging by its text, a publication as it is cited, a paper
 * that only names its kind by the title of its dossier.
 */
export function titleOf(i: FeedItem): string {
	if (i.kind === 'toezegging' && i.summary) return i.summary;
	const title = i.title?.trim();
	if (!title && i.publication) return publicationCite(i.publication);
	// A title that only names the kind (every bill is `Voorstel van wet`): the dossier's.
	if (title && isGeneriek(title, i.kind)) return i.dossier?.title?.trim() || title;
	return title || KIND_LABEL[i.kind].one;
}

/** Fewer than this many of one kind on one dossier in a day stay single rows. */
export const FOLD_AT = 3;

export type Fold = {
	/**
	 * How `?open=` names it: `fold/<date>/<kind>/<dossier>`, or `fold/<date>/stemming` for
	 * the votes of a day.
	 */
	id: string;
	kind: FeedKind;
	/** None for the votes of a day, which span the dossiers. */
	dossier: NonNullable<FeedItem['dossier']> | null;
	items: FeedItem[];
};

/** A vote closer than this many seats stands on its own. */
export const CLOSE_VOTE = 10;

const tallyOf = (i: FeedItem) => forAgainst(i.vote?.tally);

/** The difference in seats of a vote; without a tally, none. */
export const voteMargin = (i: FeedItem) => {
	const { voor, tegen } = tallyOf(i);
	return voor + tegen ? Math.abs(voor - tegen) : Infinity;
};

/**
 * What a vote decided, as the Kamer names the zaak (`subkind`, API 0.52): a motion, an
 * amendment, or a bill of one of three kinds. A hamerstuk on a bill is a vote too, without
 * a tally.
 */
export const MOTIE = 'Motie';
export const AMENDEMENT = 'Amendement';
const BILL_KINDS: ReadonlySet<string> = new Set(['Wetgeving', 'Initiatiefwetgeving', 'Begroting']);

type VoteLike = {
	subkind?: string | null;
	/** On a count of the summary. */
	chamber?: 'TK' | 'EK';
	/** On an item of the feed. */
	vote?: { chamber?: 'TK' | 'EK' } | null;
};

/** The Kamer that voted (API 0.59): the Tweede unless the vote says the Eerste. */
export const chamberOf = (v: VoteLike): 'TK' | 'EK' => v.chamber ?? v.vote?.chamber ?? 'TK';

/**
 * A vote on a bill itself: of the Tweede Kamer by the kind of its zaak; of the Eerste Kamer
 * always, as the feed gives only the vote that decided a bill there.
 */
export const isBillVote = (v: VoteLike) =>
	chamberOf(v) === 'EK' || (!!v.subkind && BILL_KINDS.has(v.subkind));

/** A vote that goes into the day's bundle: not on a bill, and not close. */
const bundledVote = (i: FeedItem) =>
	i.kind === 'stemming' && !isBillVote(i) && voteMargin(i) > CLOSE_VOTE;

/**
 * What a fold is called: `Tweede Kamer stemt over 125 moties: 88 aangenomen, 37 verworpen`, or
 * `8 moties over 21501-32 Landbouw- en Visserijraad`.
 */
export function foldTitle(f: Fold, votes?: VoteCount[]): string {
	if (!f.dossier) {
		// The whole day from the summary when there is one; else the votes loaded.
		const counted: VoteCount[] = votes
			? votes.filter((v) => !isBillVote(v))
			: f.items.map((i) => ({
					chamber: i.vote?.chamber ?? 'TK',
					subkind: i.subkind,
					outcome: i.vote?.passed ? 'aangenomen' : 'verworpen',
					count: 1
				}));
		const sum = (keep: (v: VoteCount) => boolean) =>
			counted.filter(keep).reduce((n, v) => n + v.count, 0);
		const all = sum(() => true);
		const moties = sum((v) => v.subkind === MOTIE);
		const lead = moties || all;
		const passed = sum((v) => (!moties || v.subkind === MOTIE) && v.outcome === 'aangenomen');
		const noun = moties
			? lead === 1
				? 'motie'
				: 'moties'
			: lead === 1
				? 'voorstel'
				: 'voorstellen';
		// Beside the moties: the amendementen by name, the rest as voorstellen.
		const amendementen = moties ? sum((v) => v.subkind === AMENDEMENT) : 0;
		const other = all - lead - amendementen;
		const also = [
			amendementen ? count(amendementen, 'amendement', 'amendementen') : '',
			other ? count(other, 'ander voorstel', 'andere voorstellen') : ''
		]
			.filter(Boolean)
			.join(' en ');
		return `Tweede Kamer stemt over ${lead} ${noun}: ${passed} aangenomen, ${lead - passed} verworpen${also ? `, en over ${also}` : ''}`;
	}
	return `${f.items.length} ${KIND_LABEL[f.kind].many} over ${dossierLabel(f.dossier)}`;
}

/** The votes of a day per subkind and outcome, as the summary counts them. */
export type VoteCount = Schema<'FeedVoteCountDTO'>;

/** A day as the summary counts it. */
export type DaySummary = Schema<'FeedDayDTO'>;

/** A day's kinds from the summary, most first, as `Day.counts` holds them. */
export const summaryCounts = (s: DaySummary): Day['counts'] =>
	(s.kinds ?? [])
		.flatMap((k) => (k.value && isFeedKind(k.value) ? [{ kind: k.value, count: k.count }] : []))
		.sort((a, b) => b.count - a.count || FEED_KINDS.indexOf(a.kind) - FEED_KINDS.indexOf(b.kind));
export type Entry = { item: FeedItem } | { fold: Fold };

export type Day = {
	date: string;
	entries: Entry[];
	/** The kinds of the day with their number, most first. */
	counts: { kind: FeedKind; count: number }[];
};

/**
 * The items per day, in the order they came. Within a day, FOLD_AT or more votes that are
 * not on a bill and not close become one fold at the top; FOLD_AT or more other items of
 * one kind on one dossier become one fold where the first of them stood.
 */
export function daysOf(items: readonly FeedItem[]): Day[] {
	const days: Day[] = [];
	const byDate = new Map<string, FeedItem[]>();
	for (const item of items) {
		const list = byDate.get(item.date);
		if (list) list.push(item);
		else {
			byDate.set(item.date, [item]);
			days.push({ date: item.date, entries: [], counts: [] });
		}
	}
	for (const day of days) {
		const all = byDate.get(day.date)!;
		const votes = all.filter(bundledVote);
		const bundle = votes.length >= FOLD_AT;
		const list = bundle ? all.filter((i) => !bundledVote(i)) : all;
		if (bundle)
			day.entries.push({
				fold: { id: `fold/${day.date}/stemming`, kind: 'stemming', dossier: null, items: votes }
			});
		const groupOf = (i: FeedItem) => (i.dossier ? `${i.kind}/${i.dossier.number}` : null);
		const size = new Map<string, number>();
		for (const i of list) {
			const g = groupOf(i);
			if (g) size.set(g, (size.get(g) ?? 0) + 1);
		}
		const folds = new Map<string, Fold>();
		for (const i of list) {
			const g = groupOf(i);
			if (g && (size.get(g) ?? 0) >= FOLD_AT) {
				const fold = folds.get(g);
				if (fold) fold.items.push(i);
				else {
					const f: Fold = {
						id: `fold/${day.date}/${g}`,
						kind: i.kind,
						dossier: i.dossier!,
						items: [i]
					};
					folds.set(g, f);
					day.entries.push({ fold: f });
				}
			} else day.entries.push({ item: i });
		}
		const counts = new Map<FeedKind, number>();
		for (const i of all) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
		day.counts = [...counts]
			.map(([kind, count]) => ({ kind, count }))
			.sort((a, b) => b.count - a.count || FEED_KINDS.indexOf(a.kind) - FEED_KINDS.indexOf(b.kind));
	}
	return days;
}

/** `3 stemmingen, 1 motie`: a day's kinds as a line. */
export const countLine = (counts: Day['counts']) =>
	counts
		.map(
			({ kind, count }) =>
				`${count} ${count === 1 ? KIND_LABEL[kind].one.toLowerCase() : KIND_LABEL[kind].many}`
		)
		.join(', ');

/** `Vandaag`, `Gisteren`, else `Dinsdag 22 september 2026`. */
export function dayLabel(iso: string, today: string): string {
	const d = new Date(`${iso}T00:00:00Z`);
	const t = new Date(`${today}T00:00:00Z`);
	const diff = Math.round((t.getTime() - d.getTime()) / DAY_MS);
	if (diff === 0) return 'Vandaag';
	if (diff === 1) return 'Gisteren';
	if (diff === -1) return 'Morgen';
	return weekdag(iso);
}

/** The sources Actueel's events come from, as `data_as_of` names them. */
const FEED_SOURCES = ['tk', 'eerstekamer'];

/**
 * How current Actueel is: the newest dated record of the Kamers, and when it was fetched.
 * From `data_as_of` of a feed response; null when it names neither.
 */
export function feedStand(
	dataAsOf: Record<string, Schema<'DataAsOfDTO'>> | null | undefined
): { newest: string; retrievedAt: string | null } | null {
	const known = FEED_SOURCES.flatMap((s) => {
		const d = dataAsOf?.[s];
		return d?.newest ? [{ newest: d.newest, retrievedAt: d.retrieved_at ?? null }] : [];
	}).sort((a, b) => b.newest.localeCompare(a.newest));
	return known[0] ?? null;
}

/** `Stukken van de Kamers tot en met 24 sep. 2026, opgehaald op 24 sep. 2026` */
export function standLine(stand: NonNullable<ReturnType<typeof feedStand>>): string {
	const fetched = stand.retrievedAt
		? `, opgehaald op ${korteDatum(stand.retrievedAt.slice(0, 10))}`
		: '';
	return `Stukken van de Kamers tot en met ${korteDatum(stand.newest)}${fetched}`;
}

/** `24 sep. 2026`, for a date in a line of text. */

/**
 * The articles a version changed, of all the law has: `8 van 11 artikelen gewijzigd`; where
 * it changed every one (a new law, a law replaced whole), `alle 111 artikelen`. Null without
 * both figures. The homepage and Actueel say it alike.
 */
export function artikelenGewijzigd(c: FeedItem['commencement']): string | null {
	const n = c?.changed_articles;
	const van = c?.article_count;
	if (n == null || van == null) return null;
	return n === van ? `alle ${van} artikelen` : `${n} van ${van} artikelen gewijzigd`;
}

/** `Stb. 2026, 204`, as a publication is cited. */
export function publicationCite(p: NonNullable<FeedItem['publication']>): string {
	const SERIES: Record<string, string> = { stb: 'Stb.', stcrt: 'Stcrt.', trb: 'Trb.' };
	const series = p.series ? (SERIES[p.series] ?? p.series) : '';
	return `${series} ${p.year ?? ''}, ${p.number ?? ''}`.trim();
}

/** What places a page of the feed, not what it holds. */
const PAGING = new Set(['limit', 'cursor', 'facets']);

/**
 * A view of the feed as an Atom feed: the filters asked, a list as one parameter per value
 * (each word a `q`, any of them counts), without the page's size or place.
 */
export function atomHref(
	query: Record<string, string | number | boolean | readonly string[] | null | undefined>
) {
	const p = new URLSearchParams();
	for (const [k, v] of Object.entries(query))
		if (v != null && !PAGING.has(k))
			for (const one of typeof v === 'object' ? v : [v]) p.append(k, String(one));
	return `${API_BASE_URL}/api/feed.atom${p.size ? `?${p}` : ''}`;
}

/**
 * The first day searched, when the API stopped short of the whole period (0.79.28: `partial`
 * with `searched_from`); null when it searched all. An API before it has neither field.
 */
export function doorzochtVanaf(r: object): string | null {
	const { partial, searched_from: vanaf } = r as {
		partial?: boolean | null;
		searched_from?: string | null;
	};
	return partial && typeof vanaf === 'string' && vanaf ? vanaf.slice(0, 10) : null;
}

/**
 * Where a failure of the feed is said: in place of the list it left empty, or under the list
 * it could not lengthen (the next days, further back), so it never goes unseen.
 */
export const errorPlace = (error: string | null, items: number): 'none' | 'instead' | 'below' =>
	!error ? 'none' : items ? 'below' : 'instead';
