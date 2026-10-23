// Whether the Inhoud of the bron on screen has anything to go by. The three tables of contents
// (LezenNav, DocumentToc, JudgmentToc) tell it once they have their rows; the page leaves the
// column, the tab Inhoud and the button out for a text with one entry or none: a table of
// contents of a single line is no navigation. Until they have told, the place is held.

/** The id of the bron whose Inhoud is empty, as the table of contents told. */
export const contentsEmpty = $state<{ id: string | null }>({ id: null });

/** The fewest entries that make a table of contents. */
const MIN_ENTRIES = 2;

/** The id of the bron whose table of contents has told, whatever it said. */
export const contentsTold = $state<{ id: string | null }>({ id: null });

/** A table of contents says how many entries the bron `id` has. */
export function reportContents(id: string, ingangen: number): void {
	contentsTold.id = id;
	if (ingangen < MIN_ENTRIES) contentsEmpty.id = id;
	else if (contentsEmpty.id === id) contentsEmpty.id = null;
}
