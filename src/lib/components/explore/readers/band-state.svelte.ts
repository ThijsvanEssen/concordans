// Whether the band "Behoort bij" of a reader has lines, as the band tells once its light node
// is in. A class, as the reader's frame has a prop called `state` that hides the rune.
export class BandState {
	/** Null until the band has told. */
	has = $state<boolean | null>(null);
	/** The bron whose band the column no longer waits for: a second has passed. */
	waited = $state<string | null>(null);
}
