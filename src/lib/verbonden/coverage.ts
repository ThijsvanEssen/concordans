// How many judgments the network holds for the rechter the filter names, so that a
// short list reads as a fact about the selection, not about the case law.
import type { Coverage } from '$lib/api/stats';
import type { Tier } from '$lib/vocabulary';
import type { Rechter } from './filter';

export type Span = { count: number; first: string | null; last: string | null; of: string };

type Part = { count: number; first_date?: string | null; last_date?: string | null };

function sum(parts: Part[], of: string): Span | null {
	if (parts.length === 0) return null;
	const firsts = parts
		.map((p) => p.first_date)
		.filter((d): d is string => !!d)
		.sort();
	const lasts = parts
		.map((p) => p.last_date)
		.filter((d): d is string => !!d)
		.sort();
	return {
		count: parts.reduce((n, p) => n + p.count, 0),
		first: firsts[0] ?? null,
		last: lasts.at(-1) ?? null,
		of
	};
}

/** The judgments of the rechter, or of every court when the filter names none. */
export function coverageFor(coverage: Coverage, rechter: Rechter | null): Span | null {
	const tiers = (...names: Tier[]) =>
		coverage.tiers.filter((t) => names.some((name) => name === t.tier));
	switch (rechter) {
		case null:
			return {
				count: coverage.total,
				first: coverage.first_date ?? null,
				last: coverage.last_date ?? null,
				of: 'uitspraken'
			};
		// The filter Hoge Raad takes the conclusions of the Parket with it (rechterOf).
		case 'hr':
			return sum(tiers('hoge_raad', 'parket'), 'uitspraken en conclusies van de Hoge Raad');
		case 'hof':
			return sum(tiers('gerechtshof'), 'uitspraken van gerechtshoven');
		case 'rechtbank':
			return sum(tiers('rechtbank'), 'uitspraken van rechtbanken');
		case 'rvs':
			return sum(tiers('raad_van_state'), 'uitspraken van de Raad van State');
		case 'ehrm':
			return sum(
				coverage.courts.filter((c) => c.source === 'echr'),
				'uitspraken van het EHRM'
			);
	}
}
