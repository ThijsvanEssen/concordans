// The career of a person as the graph records it: their seats in a fractie (the
// dated faction memberships), their posts in a cabinet (Wikidata, with their terms)
// and the functions they signed stukken in (AUTHORED meta.function, when not as
// Kamerlid). A function known only from stukken has no term, only the dates of the
// stukken signed in it; one that falls in a post is counted with that post.
import { daysBetween } from '$lib/text/datum';
import { capitalize } from '$lib/text/words';
import type { Schema } from '$lib/api/types';
import { fractieNaam } from '$lib/bron/menselijk';

type Membership = Schema<'FactionMembershipDTO'>;
type GovernmentFunction = Schema<'GovernmentFunctionDTO'>;

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
			(last.to === null || !m.from_date || daysBetween(last.to, m.from_date) <= GAP_DAYS);
		const seat = joins
			? last
			: {
					kind: 'seat' as const,
					faction: fractieNaam({ key: m.faction_key, abbreviation: m.abbreviation, name: m.name }),
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
				daysBetween(role.to, m.from_date) <= ROLE_GAP_DAYS
			)
				role.to = m.to_date && m.to_date < role.to ? role.to : (m.to_date ?? null);
			else seat.roles.push({ role: m.role, from: m.from_date ?? null, to: m.to_date ?? null });
		}
	}

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
	return foldPremier([...seats, ...posts.map((p) => p.entry), ...functions.values()]).sort((a, b) =>
		start(b).localeCompare(start(a))
	);
}

type Fn = Extract<CareerEntry, { kind: 'function' }>;
const isPremier = (e: CareerEntry): e is Fn =>
	e.kind === 'function' && /^minister-president\b/i.test(e.function);
const isGeneralAffairs = (e: CareerEntry): e is Fn =>
	e.kind === 'function' && /^minister van algemene zaken$/i.test(e.function);

/**
 * The minister-president is minister of Algemene Zaken: stukken signed as the one and
 * posts named as the other are one post, not two lines of the same years. The post keeps
 * the name minister-president.
 */
export function foldPremier(entries: CareerEntry[]): CareerEntry[] {
	const premier = entries.filter(isPremier);
	if (premier.length === 0) return entries;
	const overlaps = (a: Fn, b: Fn) =>
		(a.to === null || b.from <= a.to) && (b.to === null || a.from <= b.to);
	const folded = new Set<CareerEntry>();
	for (const az of entries.filter(isGeneralAffairs)) {
		const mp = premier.find((p) => overlaps(p, az));
		if (!mp) continue;
		mp.count += az.count;
		if (az.from < mp.from) mp.from = az.from;
		mp.to = mp.to === null || az.to === null ? null : az.to > mp.to ? az.to : mp.to;
		mp.cabinet ??= az.cabinet;
		folded.add(az);
	}
	return entries.filter((e) => !folded.has(e));
}

/**
 * What a person is now, in a word: Kamerlid while they sit; else the function of
 * their latest signature when it is later than their last seat; else Oud-Kamerlid.
 */
export function currentTitle(career: CareerEntry[], sitting: boolean): string {
	const fns = career.filter(
		(e): e is Extract<CareerEntry, { kind: 'function' }> => e.kind === 'function'
	);
	// A post held now names the person, before a seat.
	const held = fns.find((e) => e.cabinet && e.to === null);
	if (held) return capitalize(held.function);
	if (sitting) return 'Kamerlid';
	const lastSeat = career
		.filter((e) => e.kind === 'seat')
		.reduce<string | null>((max, e) => (e.to && (!max || e.to > max) ? e.to : max), null);
	const end = (e: (typeof fns)[number]) => e.to ?? '9999';
	const latest = [...fns].sort((a, b) => end(b).localeCompare(end(a)))[0];
	if (latest && (!lastSeat || end(latest) > lastSeat)) return capitalize(latest.function);
	return career.some((e) => e.kind === 'seat') ? 'Oud-Kamerlid' : 'Persoon';
}

/** Whether an entry falls in the years `van`..`tot` (open where null). */
export const inYears = (
	from: string | null,
	to: string | null,
	van: string | null,
	tot: string | null
) =>
	// Days, as the bronfilter's period holds them ($lib/text/periode).
	(van === null || to === null || to.slice(0, 10) >= van) &&
	(tot === null || from === null || from.slice(0, 10) <= tot);
