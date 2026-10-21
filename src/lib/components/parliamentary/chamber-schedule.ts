// When the Tweede Kamer meets and votes next, where it does not meet for days (API 0.80,
// `chamber_schedule` of /api/feed/summary, #861). The Kamer publishes no recess as data: no
// sitting planned for days is what tells, so the line names no recess, only the days.
import type { Schema } from '$lib/api/types';
import { getChamberSchedule } from '$lib/api/feed';
import { onForget } from '$lib/util/forget';
import { addDays, langeDatum, vandaag, weekdag } from '$lib/text/datum';

type Schedule = Schema<'ChamberScheduleDTO'>;
type Activity = Schema<'ScheduledActivityDTO'>;

/** A day of the line, with where it leads: the activity's page here, else the Kamer's. */
export type SittingDay = { text: string; href: string | null };

export type NoSitting = {
	/** `2 november 2026`, or `de week van 2 november 2026`. */
	until: SittingDay;
	/** `dinsdag 3 november 2026`, `in de week van 2 november 2026`; null without votes planned. */
	votes: SittingDay | null;
};

/** Planned for a week, not yet for a day: dated on its Monday. */
const forWeek = (a: Activity) => a.precision === 'Weeknummer';

const hrefOf = (a: Activity) => a.path ?? a.tk_url ?? null;

/**
 * The line where the next sitting lies after tomorrow; null while the Kamer meets today or
 * tomorrow, or without a sitting planned.
 */
export function noSitting(s: Schedule | null | undefined, today = vandaag()): NoSitting | null {
	const next = s?.next_sitting;
	if (!next?.date || next.date <= addDays(today, 1)) return null;
	const votes = s?.next_votes?.date ? s.next_votes : null;
	return {
		until: {
			text: forWeek(next) ? `de week van ${langeDatum(next.date)}` : langeDatum(next.date),
			href: hrefOf(next)
		},
		votes: votes
			? {
					text: forWeek(votes)
						? `in de week van ${langeDatum(votes.date)}`
						: weekdag(votes.date).toLowerCase(),
					href: hrefOf(votes)
				}
			: null
	};
}

let asked: { day: string; schedule: Promise<Schedule | null> } | null = null;
onForget(() => (asked = null));

/** The schedule as of today, asked once a day for every page that shows it (Actueel, Stemmingen). */
export function chamberSchedule(today = vandaag()): Promise<Schedule | null> {
	if (asked?.day !== today) {
		const schedule = getChamberSchedule().catch((e) => {
			asked = null;
			throw e;
		});
		asked = { day: today, schedule };
	}
	return asked.schedule;
}
