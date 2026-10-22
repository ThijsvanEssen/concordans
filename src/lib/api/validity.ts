// Whether a law or an article holds today, as the API gives it (`validity` on
// /api/instruments/{id} and `article.validity` on /api/articles/{bwb}/{n}, API 0.80.4). The
// generated types of the release the explorer stands on lack it: it is read here, from any
// answer, and an answer without it (an older API) reads as undefined, which changes nothing.

import { addDays } from '$lib/text/datum';

type ValiditySuccessor = {
	id: string;
	key: string;
	bwb_id: string | null;
	celex: string | null;
	official_id: string | null;
	title: string | null;
	citation_title: string | null;
	articles: number;
	path: string | null;
};

export type Validity = {
	state: 'in_force' | 'expired' | 'not_in_force_yet';
	/** Expired: the first day it no longer held. Not in force yet: the day it comes into force. */
	date: string | null;
	/** The day the data stands on: the day to cite its text as holding on. */
	as_of: string | null;
	successors: ValiditySuccessor[];
};

const STATES = new Set(['in_force', 'expired', 'not_in_force_yet']);

/**
 * The validity of an answer: the object; null where the API says it is not known (an act of
 * the EU, some treaties); undefined where the answer has no such field (an older API).
 */
export function validityOf(answer: unknown): Validity | null | undefined {
	if (typeof answer !== 'object' || answer === null || !('validity' in answer)) return undefined;
	const v = (answer as { validity: unknown }).validity;
	if (v === null) return null;
	if (typeof v !== 'object') return undefined;
	const o = v as Partial<Validity>;
	if (typeof o.state !== 'string' || !STATES.has(o.state)) return undefined;
	return {
		state: o.state,
		date: typeof o.date === 'string' ? o.date : null,
		as_of: typeof o.as_of === 'string' ? o.as_of : null,
		successors: Array.isArray(o.successors) ? o.successors : []
	};
}

/**
 * The day to cite a text as holding on: the day its data stands on (`as_of`); of what has
 * expired the last day it held, the day before `date`; else undefined (today).
 */
export function citeDate(v: Validity | null | undefined): Date | undefined {
	const day = v?.state === 'expired' && v.date ? addDays(v.date, -1) : v?.as_of?.slice(0, 10);
	// Noon, so the reader's own time zone reads the same day.
	return day ? new Date(`${day}T12:00:00`) : undefined;
}
