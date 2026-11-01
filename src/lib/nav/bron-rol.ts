// The props of the person the page reads, once its node is there: the Topbalk marks a
// bewindspersoon under Regering and a Kamerlid under Parlement by their current role
// (rubrieken.ts, `isMinister`). Until the node is there a person stands under Parlement.
import { writable } from 'svelte/store';

export const bronRol = writable<Record<string, unknown> | null>(null);

/** The bron the lezer shows, once its node is there: the wissel names it (B85). */
export const leesNaam = writable<{ naam: string; titel: string } | null>(null);
