// Paging through the whole text of a law, both ways: a division opens alone (`?division=`)
// and the reader pages on down (Volgende artikelen) and back up (Vorige artikelen) from it.
// The two controls are one: the same label, the same count, the same page size.

export type Richting = 'vorige' | 'volgende';

/** How many articles lie before the first shown, and after the last. */
export function nog(richting: Richting, start: number, shown: number, total: number): number {
	return Math.max(richting === 'vorige' ? start : total - start - shown, 0);
}

/** The page right before the first article shown: up to `size`, never past the start. */
export function vorigeBladzijde(start: number, size: number): { offset: number; limit: number } {
	const offset = Math.max(start - size, 0);
	return { offset, limit: start - offset };
}

/** The offsets of the pages after the last article shown, up to the `upTo`th (or one page). */
export function volgendeBladzijden(from: number, upTo: number, total: number, size: number) {
	const offsets: number[] = [];
	const end = Math.max(Math.min(upTo, total), from + 1);
	for (let o = from; o < end; o += size) offsets.push(o);
	return offsets;
}
