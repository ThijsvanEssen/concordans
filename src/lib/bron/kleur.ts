// The colour of a kind of bron in a drawing of the network: the sketch in Verbonden, the
// tijdstrook of the werkplek, and (in time) its weergaven. One table, so a kind is one colour
// wherever it is drawn.
import type { Collection } from '$lib/vocabulary';

/** The colour of a kind, as the canvas draws its groups; the regulations a hue of their own. */
export function kindColour(c: Collection | null, hue: string | null = null): string {
	if (hue === 'regelingen') return 'var(--soort-wet)';
	switch (c) {
		case 'instruments':
		case 'articles':
		case 'annexes':
			return 'var(--soort-wet)';
		case 'documents':
		case 'dossiers':
		case 'activities':
			return 'var(--soort-parlement)';
		case 'judgments':
			return 'var(--soort-rechtspraak)';
		case 'members':
		case 'factions':
			return 'var(--soort-personen)';
		case 'committees':
			return 'var(--soort-parlement)';
		default:
			return 'var(--ink-2)';
	}
}
