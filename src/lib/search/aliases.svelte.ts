// The abbreviations of the laws ("BW", "Sr", "Awb") ⌘K offers as a prefix is typed: the one
// table the API keeps (`/api/aliases`, 108 KB, 18 KB gzip). Asked when ⌘K opens, once, never
// with a page.
import { aliases } from '$lib/api/aliases';
import type { Schema } from '$lib/api/types';
import type { DoRow } from '$lib/keys/doen.svelte';
import { NL } from '$lib/text/collator';

type Aliases = Schema<'AliasesResponse'>;

/** An abbreviation the line can become, with the name it goes by where the API gives one. */
type Suggestion = { abbreviation: string; name: string | null; family: boolean };

/** Most suggestions shown: "A" is the prefix of hundreds. */
const MAX = 6;

/** The suggestions of one table: one word each (`BW 7` is a book, not an abbreviation). */
export function suggestionsOf(data: Aliases): Suggestion[] {
	const seen = new Set<string>();
	const out: Suggestion[] = [];
	const add = (abbreviation: string, family: boolean) => {
		const key = abbreviation.toLowerCase();
		if (/\s/.test(abbreviation) || seen.has(key)) return;
		seen.add(key);
		out.push({ abbreviation, name: data.names[abbreviation]?.[0] ?? null, family });
	};
	for (const code of Object.keys(data.families)) add(code, true);
	for (const { abbreviation } of data.codes) add(abbreviation, false);
	return out;
}

/** The suggestions a line is the beginning of, none once it is a whole abbreviation: shortest first. */
export function suggest(all: readonly Suggestion[], line: string): Suggestion[] {
	const q = line.trim().toLowerCase();
	if (!q || /\s/.test(q)) return [];
	// A line that is a whole abbreviation is done: it names its law, the search opens it.
	if (all.some((s) => s.abbreviation.toLowerCase() === q)) return [];
	return all
		.filter((s) => s.abbreviation.length > q.length && s.abbreviation.toLowerCase().startsWith(q))
		.sort(
			(a, b) =>
				a.abbreviation.length - b.abbreviation.length || NL.compare(a.abbreviation, b.abbreviation)
		)
		.slice(0, MAX);
}

export const aliasRow = (s: Suggestion): DoRow => ({
	id: `alias-${s.abbreviation}`,
	label: s.abbreviation,
	word: s.name ?? undefined,
	group: 'Afkortingen',
	// A code of books waits for its book: `BW ` then `7:658`.
	fill: s.family ? `${s.abbreviation} ` : s.abbreviation,
	suggest: true
});

/** The table, asked at the first ⌘K; nothing before, and nothing at all where it fails. */
export class AliasSuggestions {
	#all = $state<Suggestion[]>([]);

	/** Asks the table, once. A failure leaves ⌘K without suggestions. */
	load() {
		if (this.#all.length) return;
		aliases().then(
			(data) => (this.#all = suggestionsOf(data)),
			() => {}
		);
	}

	rows(line: string): DoRow[] {
		return suggest(this.#all, line).map(aliasRow);
	}
}
