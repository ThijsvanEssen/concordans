// Known breaches of a house rule that the suite tolerates until they are fixed. The lists
// only shrink: a breach that is not here fails its test, and so does an entry that is no
// longer seen (take it out). Labels as the accessible name of the control, without its size.

/** Controls under 44 by 44 px on touch (375), per page of the smoke test. */
export const KNOWN_SMALL_TARGETS: Record<string, string[]> = {
	// The lines of Behoort bij stand 22 px apart: the targets of two links above each other meet.
	'/uitspraken/ECLI:NL:HR:2019:2006': ['Rb. Den Haag 24 juni 2015']
};

/** Console errors per page of the smoke test. */
export const KNOWN_CONSOLE_ERRORS: Record<string, RegExp[]> = {};
