// The words and order of an office (/ambten/<seat>): its address, its name, its holders and the
// stretches without one, newest first, and the offices per ministry for /ambten.
import type { Schema } from '$lib/api/types';
import { daysBetween } from '$lib/text/datum';
import { capitalize } from '$lib/text/words';
import { NL } from '$lib/text/collator';
import { naamVan } from '$lib/bron/menselijk';

type Seat = Schema<'SeatDTO'>;
type Holder = Schema<'SeatHolderDTO'>;
type Gap = Schema<'SeatGapDTO'>;

export const OFFICES_PATH = '/ambten';

/** The address of an office: `/ambten/jenv/minister`, `/ambten/minister/werk-en-participatie`; a lane (`#2`) is no part of it. */
export const seatHref = (seat: string): string =>
	`${OFFICES_PATH}/${seat.split('#')[0].split('/').map(encodeURIComponent).join('/')}`;

/** The seat an address names, from its segments; a lane (`#2`) is no part of an office. */
export const seatOf = (...segments: (string | undefined)[]): string =>
	segments.filter((s): s is string => !!s).join('/');

/** The office by the function of its latest holder: `Minister van Justitie en Veiligheid`. */
export function seatTitle(seat: Pick<Seat, 'seat' | 'holders'>): string {
	const latest = seat.holders.at(-1)?.function;
	return latest ? capitalize(latest) : seat.seat;
}

/** The functions it was held under before, oldest first, the one of its title left out. */
export function formerTitles(seat: Pick<Seat, 'seat' | 'holders'>): string[] {
	const title = seatTitle(seat);
	const seen = new Set<string>([title]);
	const out: string[] = [];
	for (const h of seat.holders) {
		const f = h.function ? capitalize(h.function) : null;
		if (f && !seen.has(f)) {
			seen.add(f);
			out.push(f);
		}
	}
	return out;
}

const POST_WORD: Record<string, string> = {
	'minister-president': 'Minister-president',
	minister: 'Minister',
	minister_zonder_portefeuille: 'Minister'
};

/**
 * An office by its seat where no holder names it: `Minister van Verkeer en Waterstaat` for
 * `venw/minister`, by the ministry's name as `name` gives it. A portfolio is in words of its
 * slug; a seat in another form stands for itself. The old key of a seat without a ministry has
 * a "-" in front (`-/minister/werk-en-participatie`); it names the same office.
 */
export function seatName(seat: string, name: (ministry: string) => string): string {
	const parts = seat.split('#')[0].split('/');
	// The first segment is the ministry, or the post itself where the seat has no ministry.
	const [ministry, [post, portfolio]] = POST_WORD[parts[0]]
		? [undefined, parts]
		: [parts[0], parts.slice(1)];
	const word = post ? POST_WORD[post] : undefined;
	if (!word) return seat;
	if (portfolio) return `${word} voor ${portfolio.replaceAll('-', ' ')}`;
	if (post === 'minister-president' || !ministry || ministry === '-') return word;
	return `${word} van ${name(ministry)}`;
}

/** One person's stretch in the office: their posts one after the other, over cabinets. */
type Stint = {
	member: Holder['member'];
	from_date: string | null;
	to_date: string | null;
	acting: boolean;
	cabinets: { key: string; name: string }[];
	/** The functions it was held under in the stretch, as the source names them. */
	functions: string[];
	overlaps_with: string[];
};

/** Days between one post and the next of the same person that still make one stretch. */
const JOINS = 7;

const joins = (to: string | null, from: string | null) =>
	!!to && !!from && Math.abs(daysBetween(to, from)) <= JOINS;

/** One holder's post as a stretch of its own. */
function stintOf(h: Holder): Stint {
	return {
		member: h.member,
		from_date: h.from_date ?? null,
		to_date: h.to_date ?? null,
		acting: !!h.acting,
		cabinets: h.cabinet_key ? [{ key: h.cabinet_key, name: h.cabinet_name ?? h.cabinet_key }] : [],
		functions: h.function ? [capitalize(h.function)] : [],
		overlaps_with: [...h.overlaps_with]
	};
}

/** Whether *next* goes on the stretch *last*: the same person, as stand-in or not, the next day. */
const continues = (last: Stint | undefined, next: Stint): last is Stint =>
	!!last &&
	last.member.key === next.member.key &&
	last.acting === next.acting &&
	joins(last.to_date, next.from_date);

const addNew = <T>(to: T[], from: readonly T[], same: (a: T, b: T) => boolean) =>
	to.push(...from.filter((x) => !to.some((y) => same(x, y))));

/** The holders, oldest first, with the posts of one person that follow each other as one. */
export function stints(holders: readonly Holder[]): Stint[] {
	const out: Stint[] = [];
	for (const next of holders.map(stintOf)) {
		const last = out.at(-1);
		if (!continues(last, next)) {
			out.push(next);
			continue;
		}
		last.to_date = next.to_date;
		addNew(last.cabinets, next.cabinets, (a, b) => a.key === b.key);
		addNew(last.functions, next.functions, (a, b) => a === b);
		addNew(last.overlaps_with, next.overlaps_with, (a, b) => a === b);
	}
	return out;
}

type Entry = { kind: 'holder'; stint: Stint } | { kind: 'gap'; gap: Gap };

/** The stints and the gaps between them in one line, newest first; a gap stands where it fell. */
export function timeline(holders: readonly Holder[], gaps: readonly Gap[]): Entry[] {
	const entries: { entry: Entry; from: string }[] = [
		...stints(holders).map((stint) => ({
			entry: { kind: 'holder' as const, stint },
			from: stint.from_date ?? ''
		})),
		...gaps.map((gap) => ({ entry: { kind: 'gap' as const, gap }, from: gap.from_date }))
	];
	return entries
		.map((e, i) => ({ ...e, i }))
		.sort((a, b) => b.from.localeCompare(a.from) || b.i - a.i)
		.map(({ entry }) => entry);
}

type SeatSummary = Schema<'SeatSummaryDTO'>;

/** A holder by name; where the source gives none, as $lib/bron/menselijk names a person. */
export const holderName = (member: Schema<'PersonRefDTO'>): string =>
	member.name ?? naamVan('members', member);

/** The order of the posts in a ministry: the minister first, the staatssecretarissen after. */
const POST_ORDER = [
	'minister-president',
	'minister',
	'minister_zonder_portefeuille',
	'staatssecretaris'
];
const rank = (s: SeatSummary) => {
	const i = POST_ORDER.indexOf(s.post ?? '');
	return i < 0 ? POST_ORDER.length : i;
};

/** Offices in the order of a ministry: held today first, by post, the oldest first; then the latest ended first. */
export const bySeatOrder = (a: SeatSummary, b: SeatSummary): number =>
	Number(!a.current.length) - Number(!b.current.length) ||
	rank(a) - rank(b) ||
	(b.to_date ?? '9999').localeCompare(a.to_date ?? '9999') ||
	(a.from_date ?? '').localeCompare(b.from_date ?? '') ||
	NL.compare(a.function ?? a.seat, b.function ?? b.seat);

type SeatGroup = {
	/** The ministry's key; null for the offices of none (a minister without portfolio). */
	ministry: string | null;
	name: string;
	seats: SeatSummary[];
};

/**
 * The offices per ministry (/ambten): Algemene Zaken first, then the ministries with an office
 * held today by name, then the former ones, those of no ministry last. A seat whose ministry no
 * source names stays there, not placed by guess.
 */
export function seatGroups(seats: readonly SeatSummary[]): SeatGroup[] {
	const groups = new Map<string | null, SeatGroup>();
	for (const s of seats) {
		const key = s.ministry ?? null;
		const group = groups.get(key) ?? { ministry: key, name: s.ministry_name ?? '', seats: [] };
		group.seats.push(s);
		groups.set(key, group);
	}
	const held = (g: SeatGroup) => g.seats.some((s) => s.current.length);
	const place = (g: SeatGroup) =>
		g.ministry === null ? 3 : g.ministry === 'az' ? 0 : held(g) ? 1 : 2;
	return [...groups.values()]
		.map((g) => ({ ...g, seats: g.seats.toSorted(bySeatOrder) }))
		.sort((a, b) => place(a) - place(b) || NL.compare(a.name, b.name));
}

/** The office an old key names: a seat without a ministry that later got one (B149). */
export const movedSeat = (seat: string, seats: readonly Pick<SeatSummary, 'seat'>[]) =>
	seats.find((s) => s.seat.endsWith(`/${seat}`))?.seat ?? null;
