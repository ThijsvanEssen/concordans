// How the Kamer's role of a seat reads in a sentence; one place for a member's page, Verbonden and
// the keten.
/**
 * A seat on a committee in words, where it is more than a seat (API 0.75): "voorzitter",
 * "ondervoorzitter" for the Kamer's `OnderVz`, "fungerend voorzitter" for `FngVz`, "plaatsvervangend lid" for a substitute or
 * `Plv. lid`; null for a plain seat (`Lid`, none).
 */
export function seatWord(role: string | null | undefined, substitute = false): string | null {
	const r = (role ?? '').trim();
	if (substitute || /^plv\.?\s*lid$/i.test(r)) return 'plaatsvervangend lid';
	if (!r || /^lid$/i.test(r)) return null;
	if (/^ondervz\.?$/i.test(r)) return 'ondervoorzitter';
	if (/^fngvz\.?$/i.test(r)) return 'fungerend voorzitter';
	return r.replace(/^plv\.\s*/i, 'plaatsvervangend ').toLowerCase();
}

type SeatPeriod = {
	from_date?: string | null;
	to_date?: string | null;
	role?: string | null;
	substitute?: boolean | null;
};

/** The day after an ISO day. */
const nextDay = (iso: string): string => {
	const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
};

/**
 * The seats of one member on one committee as periods, oldest first. The Kamer seats its
 * committees anew after an election: a seat the next continues in the same word (on the day
 * it ended or the day after) is one period, `2021–` and not `2021–2025` beside `2025–`. A
 * gap or another word stays a period of its own.
 */
export function joinSeats<T extends SeatPeriod>(periods: readonly T[]): T[] {
	const sorted = [...periods].sort((a, b) => (a.from_date ?? '').localeCompare(b.from_date ?? ''));
	const out: T[] = [];
	for (const p of sorted) {
		const last = out.at(-1);
		const same =
			last && seatWord(last.role, !!last.substitute) === seatWord(p.role, !!p.substitute);
		const touches =
			last && (last.to_date == null || (!!p.from_date && p.from_date <= nextDay(last.to_date)));
		if (last && same && touches) {
			const to =
				last.to_date == null || p.to_date == null
					? null
					: last.to_date > p.to_date
						? last.to_date
						: p.to_date;
			out[out.length - 1] = { ...last, to_date: to };
		} else out.push({ ...p });
	}
	return out;
}

/**
 * A seat and its other periods on the same committee (a member's page, API `periods`): the
 * joined period that holds the seat, and the others oldest first.
 */
export function seatAndOthers(
	seat: SeatPeriod,
	periods: readonly SeatPeriod[] | null | undefined
): { seat: SeatPeriod; others: SeatPeriod[] } {
	const joined = joinSeats(periods?.length ? periods : [seat]);
	const from = seat.from_date ?? '';
	const word = seatWord(seat.role, !!seat.substitute);
	// The period in the seat's own word: one in another word may end on the day it begins.
	const i = joined.findIndex(
		(p) =>
			seatWord(p.role, !!p.substitute) === word &&
			(p.from_date ?? '') <= from &&
			(p.to_date == null || from <= p.to_date)
	);
	if (i < 0) return { seat, others: joined };
	return { seat: joined[i], others: joined.filter((_, n) => n !== i) };
}
