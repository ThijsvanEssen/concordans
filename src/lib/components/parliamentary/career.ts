// The career of a person as the graph records it: their seats in a fractie (the
// dated faction memberships) and the functions they signed stukken in (AUTHORED
// meta.function, when not as Kamerlid). A function has no term in the source, only
// the dates of the stukken signed in it, so its years are those of the stukken.
import type { Schema } from '$lib/api/types';

type Membership = Schema<'FactionMembershipDTO'>;

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
	| { kind: 'function'; function: string; from: string; to: string; count: number };

/** Two seats in one fractie with at most this many days between them are one seat. */
const GAP_DAYS = 31;
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

export function careerOf(memberships: Membership[], signatures: Signature[]): CareerEntry[] {
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
				days(role.to, m.from_date) <= GAP_DAYS
			)
				role.to = m.to_date ?? null;
			else seat.roles.push({ role: m.role, from: m.from_date ?? null, to: m.to_date ?? null });
		}
	}

	const functions = new Map<string, Extract<CareerEntry, { kind: 'function' }>>();
	for (const s of signatures) {
		if (!s.function || !s.date || s.capacity === 'kamerlid') continue;
		const date = s.date.slice(0, 10);
		const entry = functions.get(s.function);
		if (!entry)
			functions.set(s.function, {
				kind: 'function',
				function: s.function,
				from: date,
				to: date,
				count: 1
			});
		else {
			entry.count++;
			if (date < entry.from) entry.from = date;
			if (date > entry.to) entry.to = date;
		}
	}

	const start = (e: CareerEntry) => e.from ?? '';
	return [...seats, ...functions.values()].sort((a, b) => start(b).localeCompare(start(a)));
}

/**
 * What a person is now, in a word: Kamerlid while they sit; else the function of
 * their latest signature when it is later than their last seat; else Oud-Kamerlid.
 */
export function currentTitle(career: CareerEntry[], sitting: boolean): string {
	if (sitting) return 'Kamerlid';
	const lastSeat = career
		.filter((e) => e.kind === 'seat')
		.reduce<string | null>((max, e) => (e.to && (!max || e.to > max) ? e.to : max), null);
	const latest = career
		.filter((e): e is Extract<CareerEntry, { kind: 'function' }> => e.kind === 'function')
		.sort((a, b) => b.to.localeCompare(a.to))[0];
	if (latest && (!lastSeat || latest.to > lastSeat))
		return latest.function.charAt(0).toUpperCase() + latest.function.slice(1);
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
