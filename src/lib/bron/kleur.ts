// The colour of a kind of bron in a drawing of the network: the sketch in Verbonden, the
// tijdstrook of the werkplek, and (in time) its weergaven. One table, so a kind is one colour
// wherever it is drawn: the colour of its rubriek (indeling.ts), as the Topbalk names it.
import type { Collection } from '$lib/vocabulary';
import { rubriekColour, rubriekOf } from './rubrieken';

/**
 * The colour of a kind, as the canvas draws its groups. `props` tell a bewindspersoon from a
 * Kamerlid: Regering, not Parlement. A regeling is a wet in colour (`hue`).
 */
export function kindColour(
	c: Collection | null,
	hue: string | null = null,
	props?: Record<string, unknown> | null
): string {
	if (hue === 'regelingen') return rubriekColour('wetten');
	return c ? rubriekColour(rubriekOf(c, '', props)) : 'var(--ink-2)';
}
