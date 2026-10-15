// How current the data of the Kamers is: one line on every page (the footer) and above
// Actueel, from `data_as_of` of a feed or stats response.
import type { Schema } from '$lib/api/types';
import { korteDatum } from './datum';

/** The sources Actueel's events come from, as `data_as_of` names them. */
const FEED_SOURCES = ['tk', 'eerstekamer'];

/**
 * How current Actueel is: the newest dated record of the Kamers, and when it was fetched.
 * From `data_as_of` of a feed response; null when it names neither.
 */
export function feedStand(
	dataAsOf: Record<string, Schema<'DataAsOfDTO'>> | null | undefined
): { newest: string; retrievedAt: string | null } | null {
	const known = FEED_SOURCES.flatMap((s) => {
		const d = dataAsOf?.[s];
		return d?.newest ? [{ newest: d.newest, retrievedAt: d.retrieved_at ?? null }] : [];
	}).sort((a, b) => b.newest.localeCompare(a.newest));
	return known[0] ?? null;
}

/** `Stukken van de Kamers tot en met 24 sep. 2026, opgehaald op 24 sep. 2026` */
export function standLine(stand: NonNullable<ReturnType<typeof feedStand>>): string {
	const fetched = stand.retrievedAt
		? `, opgehaald op ${korteDatum(stand.retrievedAt.slice(0, 10))}`
		: '';
	return `Stukken van de Kamers tot en met ${korteDatum(stand.newest)}${fetched}`;
}
