// The career of a person as the graph records it: their seats in a fractie (the
// dated faction memberships), their posts in a cabinet (Wikidata, with their terms)
// and the functions they signed stukken in (AUTHORED meta.function, when not as
// Kamerlid). A function known only from stukken has no term, only the dates of the
// stukken signed in it; one that falls in a post is counted with that post.
import type { Schema } from '$lib/api/types';

type Membership = Schema<'FactionMembershipDTO'>;
export type GovernmentFunction = Schema<'GovernmentFunctionDTO'>;

export type Signature = { function: string | null; capacity: string | null; date: string | null };

export type CareerEntry =
	| {
			kind: 'seat';
			faction: string;
			factionKey: string;
			from: string | null;
			to: string | null;
			/** Roles other than plain membership, each with its own years: fractievoorzitter. */
			roles: { role: string; from: string | null; to: string | null }[];
	  }
	| {
			kind: 'function';
			function: string;
			from: string;
			/** Null while the post is held. */
			to: string | null;
			/** Stukken signed in it. */
			count: number;
			/** The cabinet of a post: `kabinet-Rutte IV`. Null for a function known only from stukken. */
			cabinet: string | null;
	  };

/** Two seats in one fractie with at most this many days between them are one seat. */
const GAP_DAYS = 31;
/**
 * Two terms in one role with at most this many days between them are one term. A
 * fractievoorzitter is often a plain Lid for some weeks after an election.
 */
const ROLE_GAP_DAYS = 90;
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

/** Whether a signed function names this post: `minister-president` in `minister-president van Nederland`. */
const names = (post: GovernmentFunction, fn: string) =>
	!!post.function?.toLowerCase().startsWith(fn.toLowerCase());

const within = (date: string, post: GovernmentFunction) =>
	(!post.from_date || date >= post.from_date.slice(0, 10)) &&
	(!post.to_date || date <= post.to_date.slice(0, 10));

export function careerOf(
	memberships: Membership[],
	signatures: Signature[],
	government: GovernmentFunction[] = []
): CareerEntry[] {
	const seats: Extract<CareerEntry, { kind: 'seat' }>[] = [];
	const sorted = [...memberships].sort((a, b) =>
		(a.from_date ?? '').localeCompare(b.from_date ?? '')
	);
	for (const m of sorted) {
		const last = seats.at(-1);
		const joins =
			last &&
			last.factionKey === m.faction_key &&
			(last.to === null || !m.from_date || days(last.to, m.from_date) <= GAP_DAYS);
		const seat = joins
			? last
			: {
					kind: 'seat' as const,
					faction: m.abbreviation ?? m.name ?? m.faction_key,
					factionKey: m.faction_key,
					from: m.from_date ?? null,
					to: m.to_date ?? null,
					roles: []
				};
		if (joins)
			seat.to = m.to_date && seat.to && m.to_date < seat.to ? seat.to : (m.to_date ?? null);
		else seats.push(seat);
		if (m.role && m.role !== 'Lid') {
			const role = seat.roles.at(-1);
			if (
				role &&
				role.role === m.role &&
				role.to &&
				m.from_date &&
				days(role.to, m.from_date) <= ROLE_GAP_DAYS
			)
				role.to = m.to_date && m.to_date < role.to ? role.to : (m.to_date ?? null);
			else seat.roles.push({ role: m.role, from: m.from_date ?? null, to: m.to_date ?? null });
		}
	}

	type Fn = Extract<CareerEntry, { kind: 'function' }>;
	const posts = government
		.filter((g) => g.from_date && g.function)
		.map((g): { post: GovernmentFunction; entry: Fn } => ({
			post: g,
			entry: {
				kind: 'function',
				function: g.function!,
				from: g.from_date!.slice(0, 10),
				to: g.to_date?.slice(0, 10) ?? null,
				count: 0,
				cabinet: g.cabinet ?? null
			}
		}));
	const functions = new Map<string, Fn>();
	for (const s of signatures) {
		if (!s.function || !s.date || s.capacity === 'kamerlid') continue;
		const date = s.date.slice(0, 10);
		const post = posts.find((p) => names(p.post, s.function!) && within(date, p.post));
		if (post) {
			post.entry.count++;
			continue;
		}
		const entry = functions.get(s.function);
		if (!entry)
			functions.set(s.function, {
				kind: 'function',
				function: s.function,
				from: date,
				to: date,
				count: 1,
				cabinet: null
			});
		else {
			entry.count++;
			if (date < entry.from) entry.from = date;
			if (!entry.to || date > entry.to) entry.to = date;
		}
	}

	const start = (e: CareerEntry) => e.from ?? '';
	return [...seats, ...posts.map((p) => p.entry), ...functions.values()].sort((a, b) =>
		start(b).localeCompare(start(a))
	);
}

/**
 * What a person is now, in a word: Kamerlid while they sit; else the function of
 * their latest signature when it is later than their last seat; else Oud-Kamerlid.
 */
export function currentTitle(career: CareerEntry[], sitting: boolean): string {
	const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
	const fns = career.filter(
		(e): e is Extract<CareerEntry, { kind: 'function' }> => e.kind === 'function'
	);
	// A post held now names the person, before a seat.
	const held = fns.find((e) => e.cabinet && e.to === null);
	if (held) return capital(held.function);
	if (sitting) return 'Kamerlid';
	const lastSeat = career
		.filter((e) => e.kind === 'seat')
		.reduce<string | null>((max, e) => (e.to && (!max || e.to > max) ? e.to : max), null);
	const end = (e: (typeof fns)[number]) => e.to ?? '9999';
	const latest = [...fns].sort((a, b) => end(b).localeCompare(end(a)))[0];
	if (latest && (!lastSeat || end(latest) > lastSeat)) return capital(latest.function);
	return career.some((e) => e.kind === 'seat') ? 'Oud-Kamerlid' : 'Persoon';
}

/** `2017–2026`, `2026`, `sinds 2025`. */
export function yearsOf(from: string | null, to: string | null): string {
	const a = from?.slice(0, 4);
	const b = to?.slice(0, 4);
	if (a && b) return a === b ? a : `${a}–${b}`;
	return a ? `sinds ${a}` : b ? `tot ${b}` : '';
}

/** Whether an entry falls in the years `van`..`tot` (open where null). */
export const inYears = (
	from: string | null,
	to: string | null,
	van: number | null,
	tot: number | null
) =>
	(van === null || to === null || Number(to.slice(0, 4)) >= van) &&
	(tot === null || from === null || Number(from.slice(0, 4)) <= tot);
