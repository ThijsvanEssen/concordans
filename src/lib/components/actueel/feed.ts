import type { Schema } from '$lib/api/types';
import { shortDossierTitle } from '$lib/graph/types';

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

/** Each kind as a label in a row, and counted in a day's heading. */
export const KIND_LABEL: Record<FeedKind, { one: string; many: string }> = {
	stemming: { one: 'Stemming', many: 'stemmingen' },
	wetsvoorstel: { one: 'Wetsvoorstel', many: 'wetsvoorstellen' },
	nota_van_wijziging: { one: 'Nota van wijziging', many: 'nota’s van wijziging' },
	amendement: { one: 'Amendement', many: 'amendementen' },
	motie: { one: 'Motie', many: 'moties' },
	toezegging: { one: 'Toezegging', many: 'toezeggingen' },
	brief_regering: { one: 'Brief van de regering', many: 'brieven van de regering' },
	publicatie: { one: 'Publicatie', many: 'publicaties' },
	inwerkingtreding: { one: 'Inwerkingtreding', many: 'inwerkingtredingen' }
};

/** The kinds in the order the filter lists them: what the Kamer decides first. */
export const FEED_KINDS = Object.keys(KIND_LABEL) as FeedKind[];

export const isFeedKind = (value: string): value is FeedKind => Object.hasOwn(KIND_LABEL, value);

/** A dossier by its number and short name: the short title, or else one from its title. */
export function dossierLabel(d: NonNullable<FeedItem['dossier']>): string {
	const name = d.short_title?.trim() || shortDossierTitle(d.title ?? null);
	return name ? `${d.number} ${name}` : d.number;
}

/** A title that only names the kind of paper: every bill is `Voorstel van wet`. */
const GENERIC_TITLE = /^(voorstel van wet|nota van wijziging)$/i;

/**
 * What a row is called: a toezegging by its text, a publication as it is cited, a paper
 * that only names its kind by the title of its dossier.
 */
export function titleOf(i: FeedItem): string {
	if (i.kind === 'toezegging' && i.summary) return i.summary;
	const title = i.title?.trim();
	if (!title && i.publication) return publicationCite(i.publication);
	if (title && GENERIC_TITLE.test(title)) return i.dossier?.title?.trim() || title;
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

/** A vote that goes into the day's bundle: not on a bill, and not close. */
const bundledVote = (i: FeedItem) =>
	i.kind === 'stemming' && i.subkind !== 'wetsvoorstel' && voteMargin(i) > CLOSE_VOTE;

/**
 * What a fold is called: `Kamer stemt over 125 moties: 88 aangenomen, 37 verworpen`, or
 * `8 moties over 21501-32 Landbouw- en Visserijraad`.
 */
export function foldTitle(f: Fold, votes?: VoteCount[]): string {
	if (!f.dossier) {
		// The whole day from the summary when there is one; else the votes loaded.
		const counted: VoteCount[] = votes
			? votes.filter((v) => v.subkind !== 'wetsvoorstel')
			: f.items.map((i) => ({
					subkind: i.subkind,
					outcome: i.vote?.passed ? 'aangenomen' : 'verworpen',
					count: 1
				}));
		const sum = (keep: (v: VoteCount) => boolean) =>
			counted.filter(keep).reduce((n, v) => n + v.count, 0);
		const all = sum(() => true);
		const moties = sum((v) => v.subkind === 'motie');
		const lead = moties || all;
		const passed = sum((v) => (!moties || v.subkind === 'motie') && v.outcome === 'aangenomen');
		const noun = moties
			? lead === 1
				? 'motie'
				: 'moties'
			: lead === 1
				? 'voorstel'
				: 'voorstellen';
		// Beside the moties: the amendementen by name, the rest as voorstellen.
		const amendementen = moties ? sum((v) => v.subkind === 'amendement') : 0;
		const other = all - lead - amendementen;
		const also = [
			amendementen ? `${amendementen} ${amendementen === 1 ? 'amendement' : 'amendementen'}` : '',
			other ? `${other} ${other === 1 ? 'ander voorstel' : 'andere voorstellen'}` : ''
		]
			.filter(Boolean)
			.join(' en ');
		return `Kamer stemt over ${lead} ${noun}: ${passed} aangenomen, ${lead - passed} verworpen${also ? `, en over ${also}` : ''}`;
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

const WEEKDAY = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MONTH = [
	'januari',
	'februari',
	'maart',
	'april',
	'mei',
	'juni',
	'juli',
	'augustus',
	'september',
	'oktober',
	'november',
	'december'
];

/** `Vandaag`, `Gisteren`, else `Dinsdag 22 september 2026`. */
export function dayLabel(iso: string, today: string): string {
	const d = new Date(`${iso}T00:00:00Z`);
	const t = new Date(`${today}T00:00:00Z`);
	const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
	if (diff === 0) return 'Vandaag';
	if (diff === 1) return 'Gisteren';
	if (diff === -1) return 'Morgen';
	const w = WEEKDAY[d.getUTCDay()];
	return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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

/** `Stukken van de Kamers tot en met 24 sep 2026, opgehaald op 24 sep 2026` */
export function standLine(stand: NonNullable<ReturnType<typeof feedStand>>): string {
	const fetched = stand.retrievedAt
		? `, opgehaald op ${shortDate(stand.retrievedAt.slice(0, 10))}`
		: '';
	return `Stukken van de Kamers tot en met ${shortDate(stand.newest)}${fetched}`;
}

/** `24 sep 2026`, for a date in a line of text. */
export function shortDate(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(`${iso}T00:00:00Z`);
	return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

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
