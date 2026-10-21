import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { noSitting } from './chamber-schedule';

type Activity = Schema<'ScheduledActivityDTO'>;
const act = (date: string, over: Partial<Activity> = {}): Activity => ({
	id: 'activities/a',
	key: 'a',
	number: '2026A05413',
	kind: 'Stemmingen',
	date,
	precision: 'Dag',
	agenda_title: null,
	tk_url: 'https://www.tweedekamer.nl/x',
	path: '/activiteiten/2026A05413',
	...over
});
const schedule = (next: Activity | null, votes: Activity | null) => ({
	last_sitting: null,
	last_votes: null,
	next_sitting: next,
	next_votes: votes
});

describe('noSitting', () => {
	const today = '2026-10-21';

	it('says nothing while the Kamer meets today or tomorrow', () => {
		expect(noSitting(schedule(act('2026-10-21'), null), today)).toBeNull();
		expect(noSitting(schedule(act('2026-10-22'), act('2026-10-22')), today)).toBeNull();
		expect(noSitting(schedule(null, null), today)).toBeNull();
	});

	it('names the day of the next sitting and of the next votes, each with its page', () => {
		const r = noSitting(schedule(act('2026-10-27'), act('2026-10-27')), today);
		expect(r).toEqual({
			until: { text: '27 oktober 2026', href: '/activiteiten/2026A05413' },
			votes: { text: 'dinsdag 27 oktober 2026', href: '/activiteiten/2026A05413' }
		});
	});

	it('says the week of an activity planned for a week, not yet for a day', () => {
		const week = act('2026-11-02', { precision: 'Weeknummer', path: null });
		const r = noSitting(schedule(week, week), today);
		expect(r?.until.text).toBe('de week van 2 november 2026');
		expect(r?.votes).toEqual({
			text: 'in de week van 2 november 2026',
			href: 'https://www.tweedekamer.nl/x'
		});
	});

	it('leaves out the votes where none are planned', () => {
		expect(noSitting(schedule(act('2026-10-27'), null), today)?.votes).toBeNull();
	});
});
