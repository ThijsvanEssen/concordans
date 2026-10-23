// The colour of a kind of bron in a drawing of the network: the sketch in Verbonden, the
// tijdstrook of the werkplek, and (in time) its weergaven. One table, so a kind is one colour
// wherever it is drawn.
import type { Collection } from '$lib/vocabulary';

/** The colour of a kind, as the canvas draws its groups; the regulations a hue of their own. */
export function kleurVanSoort(c: Collection | null, hue: string | null = null): string {
	if (hue === 'regelingen') return 'var(--groep-regeling)';
	switch (c) {
		case 'instruments':
		case 'articles':
		case 'annexes':
			return 'var(--groep-wet)';
		case 'documents':
		case 'dossiers':
		case 'activities':
			return 'var(--groep-dossier)';
		case 'judgments':
			return 'var(--indigo)';
		case 'members':
		case 'factions':
			return 'var(--groep-fractie)';
		case 'committees':
			return 'var(--groep-commissie)';
		default:
			return 'var(--ink-2)';
	}
}
