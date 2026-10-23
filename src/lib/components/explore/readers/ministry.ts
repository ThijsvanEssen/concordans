// The words of a ministry's page: the name it had, and the stretches in which it had it.
import { langeDatum, sinceDate, untilDate } from '$lib/text/datum';

export type Stretch = { from: string | null | undefined; to: string | null | undefined };

/** `Ministerie van Financiën`; a name it no longer has says until when: `(tot 2017)`. */
export function ministryTitle(name: string, to?: string | null): string {
	const until = to?.slice(0, 4);
	return `Ministerie van ${name}${until ? ` (tot ${until})` : ''}`;
}

/** One stretch: `1 januari 2017 tot 26 oktober 2017`, `sinds 1 januari 2017`, `tot 1 januari 2010`. */
export function stretchWords({ from, to }: Stretch): string | null {
	if (from && to) return `${langeDatum(from)} ${untilDate(to)}`;
	if (from) return sinceDate(from);
	if (to) return untilDate(to);
	return null;
}

/** Every stretch it had the name, oldest first, as the sources date them. */
export function periodWords(stretches: readonly Stretch[]): string | null {
	const words = stretches.map(stretchWords).filter((w): w is string => !!w);
	return words.length ? words.join('; ') : null;
}
