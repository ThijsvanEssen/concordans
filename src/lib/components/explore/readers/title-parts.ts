// Where a reader's title may break on a phone: after a colon, so a long number does not run
// past the column. An ECLI breaks only between its court and its year
// (`ECLI:NL:GHSHE:` `2026:2880`), never after `ECLI:` or its country (B33).

/** A colon an ECLI holds together: after `ECLI`, its country, or its year. */
const HELD = /(?:\bECLI:|\bECLI:[A-Z]{2}:|\bECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:)$/i;

/** The title in the pieces a break may fall between. */
export function titleParts(title: string): string[] {
	const parts: string[] = [];
	let held = '';
	let read = '';
	for (const piece of title.split(/(?<=:)/)) {
		held += piece;
		read += piece;
		if (!HELD.test(read)) {
			parts.push(held);
			held = '';
		}
	}
	if (held) parts.push(held);
	return parts;
}
