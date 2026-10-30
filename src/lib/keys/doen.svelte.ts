// What the page can do from ⌘K: the rows Doen above the results. A page that can do a command
// (register.ts, COMMANDS) offers a doer for as long as it stands, as it answers a key
// (dispatch.svelte.ts); the last to offer is asked first, and the first with rows answers.
// Nothing here knows what a command does: the register says what it is, the page what happens.
import type { Parsed } from './commands';
import type { BronRef } from '$lib/bron/ref';

/** The bron the search would open now, the one a command with a bron does its work on. */
export type Target = { ref: BronRef | string; label: string };

export type DoRow = {
	/** Unique among the rows shown. */
	id: string;
	/** What it does, in words: "Weergave Keten". */
	label: string;
	/** The word that calls it, shown at the right. */
	word?: string;
	/** The key of the register that does the same. */
	key?: string;
	/** Why it cannot be done here: the row says it, Enter does nothing. */
	why?: string;
	/** The search has not found its bron yet: Enter waits for it, and then does the row. */
	pending?: boolean;
	/** The heading it stands under, where not Doen or Hier: Recent. */
	group?: string;
	/** The state it stands in now: shown, not done again. */
	now?: boolean;
	run?: () => void;
	/** In place of `run`: the field gets this text, to type the rest ("+ "). */
	fill?: string;
};

export type Doer = {
	/** The rows for a command, with the bron the search found for its object (or none yet). */
	rows: (parsed: Parsed, target: Target | null) => DoRow[];
	/** What can be done here, shown before anything is typed. */
	here?: () => DoRow[];
};

let doers = $state.raw<Doer[]>([]);

/** Offers `doer` until the returned function is called. */
export function offer(doer: Doer): () => void {
	doers = [...doers, doer];
	return () => (doers = doers.filter((d) => d !== doer));
}

/** The rows of the doer offered last that has any. */
export function rowsFor(parsed: Parsed, target: Target | null): DoRow[] {
	for (let i = doers.length - 1; i >= 0; i--) {
		const rows = doers[i].rows(parsed, target);
		if (rows.length) return rows;
	}
	return [];
}

/** What can be done where the reader is: the doer offered last that says. */
export function hereRows(): DoRow[] {
	for (let i = doers.length - 1; i >= 0; i--) {
		const rows = doers[i].here?.() ?? [];
		if (rows.length) return rows;
	}
	return [];
}
