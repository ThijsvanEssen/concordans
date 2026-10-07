import { korteDatum, weekdag } from '$lib/text/datum';
import type { Schema } from '$lib/api/types';
import { isGeneriek } from '$lib/bron/generiek';

// Actueel: what happened, newest first, per day. A day's many items of one kind on one
// dossier (the moties of a debate) fold into one line that opens.

type RawFeedItem = Schema<'FeedItemDTO'>;
export type FeedPerson = Schema<'FeedPersonDTO'>;
/** An item as the page uses it: an id and its persons always there. */
export type FeedItem = Omit<RawFeedItem, 'persons' | 'id'> & { id: string; persons: FeedPerson[] };
export type FeedKind = FeedItem['kind'];

export const normalizeItem = (raw: RawFeedItem): FeedItem => ({
	...raw,
	id: raw.id ?? `${raw.node.collection}/${raw.node.key}`,
	persons: raw.persons ?? []
});

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

type Dossier = NonNullable<FeedItem['dossier']>;

/** Past this length a dossier without a short title is named by its title, cut. */
const DOSSIER_NAME_MAX = 80;

/**
 * A dossier by a short name, from official data only: its short title, or where that is
 * the law the bill amends (`amended_law`), `wijziging van {wet}`. Without one, its title,
 * cut; its number without a title.
 */
export function dossierName(
	d: Pick<Dossier, 'number' | 'title' | 'short_title' | 'short_title_basis'>
): string {
	const short = d.short_title?.trim();
	if (short) return d.short_title_basis === 'amended_law' ? `wijziging van ${short}` : short;
	const title = d.title?.trim();
	if (!title) return d.number;
	return title.length > DOSSIER_NAME_MAX
		? `${title.slice(0, DOSSIER_NAME_MAX - 1).trimEnd()}…`
		: title;
}

/** A dossier by its number and short name: `36889 wijziging van Archiefwet 1995`. */
export function dossierLabel(d: Dossier): string {
	const name = dossierName(d);
	return name === d.number ? d.number : `${d.number} ${name}`;
}

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

const tallyOf = (i: FeedItem) => {
	const t = (i.vote?.tally ?? {}) as Record<string, number>;
	return { voor: t['Voor'] ?? 0, tegen: t['Tegen'] ?? 0 };
};

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
			amendementen ? `${amendementen} ${amendementen === 1 ? 'amendement' : 'amendementen'}` : '',
			other ? `${other} ${other === 1 ? 'ander voorstel' : 'andere voorstellen'}` : ''
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
	const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
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
		? `, opgehaald op ${shortDate(stand.retrievedAt.slice(0, 10))}`
		: '';
	return `Stukken van de Kamers tot en met ${shortDate(stand.newest)}${fetched}`;
}

/** `24 sep. 2026`, for a date in a line of text. */
export const shortDate = (iso: string | null | undefined): string => korteDatum(iso);

/** `Stb. 2026, 204`, as a publication is cited. */
export function publicationCite(p: NonNullable<FeedItem['publication']>): string {
	const SERIES: Record<string, string> = { stb: 'Stb.', stcrt: 'Stcrt.', trb: 'Trb.' };
	const series = p.series ? (SERIES[p.series] ?? p.series) : '';
	return `${series} ${p.year ?? ''}, ${p.number ?? ''}`.trim();
}

/**
 * The query of the Atom feed of a view: the filters chosen, without the page size and
 * without the end of today the page adds, so a subscribed feed keeps coming.
 */
export function atomParams(
	query: Record<string, string | number | undefined>,
	chosenUntil: string
): URLSearchParams {
	const p = new URLSearchParams();
	for (const [k, v] of Object.entries(query))
		if (v !== undefined && k !== 'limit' && !(k === 'until' && !chosenUntil)) p.set(k, String(v));
	return p;
}
