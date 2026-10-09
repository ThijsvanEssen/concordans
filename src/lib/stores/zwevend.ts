// The two cards over the network, Netwerk and under it the legend (Thijs, 10 Oct: "legenda
// en netwerk onder elkaar"). Both may stand open while the canvas has the height; when the one
// opened does not leave room for the other, the other folds, and opens again by itself once
// there is room, unless someone closed it.
import { writable } from 'svelte/store';

export type Zwevend = 'legenda' | 'netwerk';

/** Which card was opened last: the other one gives way. */
export const laatstOpen = writable<Zwevend | null>(null);

/** The card folded for want of room (not by a click), until the canvas has room again. */
export const opzij = writable<Zwevend | null>(null);

/**
 * Whether two cards of these heights stand open together in a canvas of this height, with
 * their margins and the gap between them.
 */
export const passenSamen = (boven: number, onder: number, hoogte: number, rand = 12, tussen = 8) =>
	boven + tussen + onder <= hoogte - 2 * rand;
