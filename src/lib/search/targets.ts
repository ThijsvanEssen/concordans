// The bron a row of the search stands for, as ⌘K does its words with it (doen.svelte.ts): the
// one Enter would open now, and the one the keys are on.
import type { Target } from '$lib/keys/doen.svelte';
import type { SearchSession } from './session.svelte';
import { hitName, presentHit } from './present';
import type { Schema } from '$lib/api/types';

type Hit = Schema<'SearchResultItem'>;

const ofHit = (hit: Hit, q: string): Target => ({
	ref: hitName(hit),
	label: presentHit(hit, q, []).title
});

/** The bron Enter would open now: what a word with a bron (`keten awb`) does its work on. */
export function topTarget(search: SearchSession): Target | null {
	const choice = search.choices[0];
	if (choice) return { ref: choice.ref, label: choice.label ?? search.q };
	const cited =
		search.resolvedWith?.term === search.q && search.citation ? search.resolvedWith.target : null;
	const named = cited ?? search.bare;
	if (named) return { ref: named.ref, label: named.label ?? search.q };
	const hit = search.best?.hit ?? (search.answered === search.q ? search.hits[0] : undefined);
	return hit ? ofHit(hit, search.q) : null;
}

/** The bron of the result the keys are on (row `i`): the right column shows what it can do. */
export function rowTarget(search: SearchSession, i: number): Target | null {
	const choice = search.choices[i];
	if (choice) return { ref: choice.ref, label: choice.label ?? search.q };
	if (i < search.offset) return topTarget(search);
	const hit = search.hits[i - search.offset];
	return hit ? ofHit(hit, search.q) : null;
}
