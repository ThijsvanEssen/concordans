// The words and order of an office (/ambten/<seat>): its address, its name, its holders and the
// stretches without one, newest first, and the ministers' offices of a cabinet for /ambten.
import type { Schema } from '$lib/api/types';
import { capitalize } from '$lib/text/words';

type Seat = Schema<'SeatDTO'>;
type Holder = Schema<'SeatHolderDTO'>;
type Gap = Schema<'SeatGapDTO'>;

export const AMBTEN_PATH = '/ambten';

/** The posts whose seat /ambten lists: the ministers, the minister-president first. */
const MINISTER_POSTS = new Set(['minister-president', 'minister', 'minister_zonder_portefeuille']);

/** The address of an office: `/ambten/jenv/minister`, `/ambten/-/minister/werk-en-participatie`. */
export const seatHref = (seat: string): string =>
	`${AMBTEN_PATH}/${seat.split('/').map(encodeURIComponent).join('/')}`;

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
	minister_zonder_portefeuille: 'Minister',
	staatssecretaris: 'Staatssecretaris'
};

/**
 * An office by its seat where no holder names it: `Minister van Verkeer en Waterstaat` for
 * `venw/minister`, by the ministry's name as `name` gives it. A portfolio is in words of its
 * slug; a seat in another form stands for itself.
 */
export function seatName(seat: string, name: (ministry: string) => string): string {
	const [ministry, post, portfolio] = seat.split('#')[0].split('/');
	const word = post ? POST_WORD[post] : undefined;
	if (!word) return seat;
	if (portfolio) return `${word} voor ${portfolio.replaceAll('-', ' ')}`;
	if (post === 'minister-president' || ministry === '-') return word;
	return `${word} van ${name(ministry)}`;
}

/** One person's stretch in the office: their posts one after the other, over cabinets. */
export type Stint = {
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
	!!to && !!from && Math.abs(Date.parse(from) - Date.parse(to)) <= JOINS * 86_400_000;

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

export type Entry = { kind: 'holder'; stint: Stint } | { kind: 'gap'; gap: Gap };

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

export type MinisterSeat = { seat: string; title: string; holders: string[] };

/** The ministers' offices of a cabinet, as it lists its ministries: the seat without its lane. */
export function ministerSeats(
	cabinet: Pick<Schema<'CabinetDetailDTO'>, 'ministries'>
): MinisterSeat[] {
	const out = new Map<string, MinisterSeat>();
	for (const m of cabinet.ministries ?? []) {
		for (const s of m.seats) {
			if (!s.post || !MINISTER_POSTS.has(s.post)) continue;
			const seat = s.seat.split('#')[0];
			const names = s.posts.map((p) => p.member.name ?? '').filter(Boolean);
			const known = out.get(seat);
			if (known) known.holders.push(...names.filter((n) => !known.holders.includes(n)));
			else out.set(seat, { seat, title: capitalize(s.function ?? seat), holders: names });
		}
	}
	return [...out.values()];
}
