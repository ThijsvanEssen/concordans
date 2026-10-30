// The rows Doen of ⌘K: what the line typed asks to do (commands.ts), above the results, or what
// can be done here before anything is typed. The first row stands chosen, so Enter does it; ↓
// past the last goes on into the results, ↑ above the first result comes back.
import { parseCommand, type Parsed } from '$lib/keys/commands';
import { hereRows, rowsFor, type DoRow, type Target } from '$lib/keys/doen.svelte';
import { recentRows } from '$lib/keys/recent.svelte';
import { page } from '$app/state';

export class PaletteActions {
	/** The line as typed, the word included; the search gets what is left (searchTextOf). */
	line = $state('');

	// Set by the constructor; the derived rows below read them only when asked.
	#on: () => boolean = () => false;
	#target: () => Target | null = () => null;
	/** Enter on a row still looking for its bron: the line it was pressed on. */
	#waiting = $state<string | null>(null);
	/** The row the keys chose, for the line it was chosen on. */
	#chosen = $state<{ line: string; at: number | null } | null>(null);

	/** `on`: only in the dialog of ⌘K; `target`: the bron the search would open now. */
	constructor(on: () => boolean, target: () => Target | null) {
		this.#on = on;
		this.#target = target;
	}

	readonly parsed = $derived<Parsed | null>(this.#on() ? parseCommand(this.line) : null);
	readonly empty = $derived(this.#on() && !this.line.trim());
	readonly rows = $derived<DoRow[]>(
		this.parsed
			? rowsFor(this.parsed, this.#target())
			: this.empty
				? [...hereRows(), ...recentRows(page.url)]
				: []
	);

	/** The row the keys are on; null where they are in the results. */
	get at(): number | null {
		if (this.#chosen?.line === this.line) return this.#chosen.at;
		if (!this.rows.length) return null;
		// The first that can be done: the weergave that stands now is not the one asked for.
		return Math.max(
			0,
			this.rows.findIndex((r) => !r.why && !r.now)
		);
	}

	#choose(at: number | null) {
		this.#chosen = { line: this.line, at };
	}

	/**
	 * A key in the field: true where the rows Doen took it. `results` are the search's rows:
	 * how many, whether the first is the one the keys are on, and the way onto it.
	 */
	key(
		e: KeyboardEvent,
		results: { count: number; atFirst: boolean; enter: () => void },
		done: () => void
	): boolean {
		const { at, rows } = this;
		if (e.key === 'ArrowDown' && at !== null) {
			if (at < rows.length - 1) this.#choose(at + 1);
			else if (results.count > 0) {
				this.#choose(null);
				results.enter();
			}
		} else if (e.key === 'ArrowUp' && at !== null) this.#choose(Math.max(0, at - 1));
		else if (e.key === 'ArrowUp' && rows.length && results.atFirst) this.#choose(rows.length - 1);
		else if (e.key === 'Enter' && at !== null) this.do(rows[at], done);
		else return false;
		e.preventDefault();
		return true;
	}

	point(at: number) {
		this.#choose(at);
	}

	/** The keys left the rows (the pointer onto a result). */
	leave() {
		if (this.at !== null) this.#choose(null);
	}

	/** Does `row`: one that cannot, or that is what stands, does nothing; `done` closes ⌘K. */
	do(row: DoRow | undefined, done: () => void) {
		if (row?.pending) this.#waiting = this.line;
		if (!row || row.why || row.now) return;
		if (row.fill !== undefined) {
			this.line = row.fill;
			return;
		}
		done();
		row.run?.();
	}

	/** An Enter that waited: done once its row found its bron, on the line it was pressed on. */
	settle(done: () => void) {
		if (this.#waiting === null) return;
		const row = this.at === null ? undefined : this.rows[this.at];
		if (this.#waiting !== this.line) this.#waiting = null;
		else if (row && !row.pending) {
			this.#waiting = null;
			this.do(row, done);
		}
	}

	/** A result chosen while the word asks for a bron: the command does its work on it. */
	withBron(target: Target, done: () => void): boolean {
		if (this.parsed?.command.arg !== 'bron') return false;
		const row = rowsFor(this.parsed, target).find((r) => r.run && !r.why);
		if (!row) return false;
		this.do(row, done);
		return true;
	}
}
