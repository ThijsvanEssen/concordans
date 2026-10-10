// What a dossier holds, in one sentence: the counts that are there, then what it lacks.
// "1 stuk, 4 stemmingen, geen activiteiten", not three tiles of which two read 0.

import { formatCount } from '$lib/text/getal';

const NOUNS = {
	documents: ['stuk', 'stukken'],
	decisions: ['stemming', 'stemmingen'],
	activities: ['activiteit', 'activiteiten']
} as const;

type Counted = keyof typeof NOUNS;

export function dossierCounts(counts: Partial<Record<Counted, number | null>>): string {
	const present: string[] = [];
	const absent: string[] = [];
	for (const kind of Object.keys(NOUNS) as Counted[]) {
		const n = counts[kind] ?? 0;
		const [one, many] = NOUNS[kind];
		if (n > 0) present.push(`${formatCount(n)} ${n === 1 ? one : many}`);
		else absent.push(many);
	}
	const list =
		absent.length > 1 ? `${absent.slice(0, -1).join(', ')} of ${absent.at(-1)}` : absent[0];
	const none = list ? `geen ${list}` : '';
	return [...present, none].filter(Boolean).join(', ');
}
