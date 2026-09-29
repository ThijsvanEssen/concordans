import type { Schema } from '$lib/api/types';

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
	brief_regering: { one: 'Brief regering', many: 'brieven van de regering' },
	publicatie: { one: 'Publicatie', many: 'publicaties' },
	inwerkingtreding: { one: 'Inwerkingtreding', many: 'inwerkingtredingen' }
};

/** The kinds in the order the filter lists them: what the Kamer decides first. */
export const FEED_KINDS = Object.keys(KIND_LABEL) as FeedKind[];

export const isFeedKind = (value: string): value is FeedKind => Object.hasOwn(KIND_LABEL, value);

/** Fewer than this many of one kind on one dossier in a day stay single rows. */
export const FOLD_AT = 3;

export type Fold = {
	/** How `?open=` names it: `fold/<date>/<kind>/<dossier>`. */
	id: string;
	kind: FeedKind;
	dossier: NonNullable<FeedItem['dossier']>;
	items: FeedItem[];
};
export type Entry = { item: FeedItem } | { fold: Fold };

export type Day = {
	date: string;
	entries: Entry[];
	/** The kinds of the day with their number, most first. */
	counts: { kind: FeedKind; count: number }[];
};

/**
 * The items per day, in the order they came. Within a day, FOLD_AT or more items of one
 * kind on one dossier become one fold where the first of them stood.
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
		const list = byDate.get(day.date)!;
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
		for (const i of list) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
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
