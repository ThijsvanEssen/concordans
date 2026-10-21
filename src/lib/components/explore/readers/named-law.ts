// A law a transposition table names by its title (`blijft in Waterwet`, `naar Gratiewet`):
// asked of /api/resolve once per name (`once`), and linked only where the API knows it by that
// exact name or abbreviation (confidence 0.9 or more); otherwise the name stays plain text.
import { once } from '$lib/api/records';
import { resolveQuery } from '$lib/api/search';
import type { Schema } from '$lib/api/types';

/** The law a name means, by its node id. */
type NamedLaw = { id: string };

/** The law of an answer of /api/resolve, where it is one by its exact name. */
function lawOfAnswer(answer: Schema<'ResolveResponse'>): NamedLaw | null {
	const m = answer.match;
	if (!m || m.kind !== 'instrument' || m.confidence < 0.9) return null;
	return { id: m.id };
}

/** The law a name means, or null; a failure is null too (the name stays text). */
export const namedLaw = (name: string): Promise<NamedLaw | null> =>
	once(`resolve/${name}`, () => resolveQuery(name)).then(lawOfAnswer, () => null);
