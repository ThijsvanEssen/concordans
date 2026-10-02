// The order of the judgments that cite an article (API 0.73, BE-42): newest first, or the
// most cited first, so that the standard judgments stand on top (UX-15). The article's
// loader reads it; Verbonden sets it and loads again.
import { writable } from 'svelte/store';

export type UitspraakVolgorde = 'date_desc' | 'citation_count';

export const uitspraakVolgorde = writable<UitspraakVolgorde>('date_desc');

/** The judgments that cite a law (API 0.74, BE-47): newest first, or by its articles cited. */
export type WetVolgorde = 'date' | 'cited';
export const wetUitspraakVolgorde = writable<WetVolgorde>('date');

/** The year the judgments that cite a law are asked for (API 0.74, BE-51); null for all. */
export const wetUitspraakJaar = writable<number | null>(null);
