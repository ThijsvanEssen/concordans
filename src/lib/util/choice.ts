// A choice filter as the URL holds it. A value the site does not know (an old link, a typo) is
// ignored, so the list shows as without it; a chosen value always stands among its options, so
// a filter in force is never out of sight.
import type { Schema } from '$lib/api/types';

/** A choice from the URL: one of `allowed`, else none. */
export const choiceOf = <T extends string>(
	value: string | null | undefined,
	allowed: readonly T[]
): T | undefined => allowed.find((a) => a === value);

/**
 * The options of a facet whose values the API names (`soort`, `ministry`): those it counts,
 * and the chosen one always, with 0 where the API counts none of it.
 */
export function facetOptions(
	counts: ReadonlyMap<string, number>,
	gekozen: string | null | undefined
): [string, number][] {
	const opties = [...counts].filter(([k, n]) => k !== 'null' && (n > 0 || k === gekozen));
	return gekozen && !counts.has(gekozen) ? [...opties, [gekozen, 0]] : opties;
}

/** The ministries the API knows by key (`MinistryKey`), current and former. */
export const MINISTRY_KEYS = [
	'az',
	'aok',
	'bz',
	'jenv',
	'venj',
	'justitie',
	'bzk',
	'biza',
	'bzbpbo',
	'ocw',
	'ow',
	'okw',
	'fin',
	'def',
	'oorlog',
	'marine',
	'ienw',
	'ienm',
	'venw',
	'vene',
	'owen',
	'ezk',
	'ez',
	'eli',
	'hn',
	'kgg',
	'lvvn',
	'lnv',
	'lnbv',
	'lenv',
	'lvv',
	'szw',
	'sz',
	'szv',
	'vws',
	'wvc',
	'vm',
	'crm',
	'mw',
	'vro',
	'vb',
	'wv',
	'vrom',
	'aenm',
	'scheepvaart',
	'ogd',
	'uor',
	'or',
	'zo'
] as const satisfies readonly Schema<'MinistryKey'>[];
