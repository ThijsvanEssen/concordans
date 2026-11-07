// A list of the API asked a page at a time, kept as it grows: the rows so far, the total, and
// whether the next page is on its way or failed. A new list (another seat) starts over.
import { isAborted, report } from '$lib/api/errors';

type Page<T> = { items: T[]; total: number };

export class Paged<T> {
	rows = $state.raw<T[]>([]);
	total = $state<number | null>(null);
	laden = $state(false);
	fout = $state<unknown>(null);
	#ask: (offset: number) => Promise<Page<T>>;
	#what: string;
	#round = 0;

	constructor(ask: (offset: number) => Promise<Page<T>>, what: string) {
		this.#ask = ask;
		this.#what = what;
	}

	/** How many are still to come. */
	get rest(): number {
		return this.total == null ? 0 : Math.max(0, this.total - this.rows.length);
	}

	/** Asks the first page again, the rows so far dropped. */
	start(): Promise<void> {
		this.#round++;
		this.rows = [];
		this.total = null;
		return this.next();
	}

	/** Asks the page after the rows so far. */
	async next(): Promise<void> {
		const round = this.#round;
		this.laden = true;
		this.fout = null;
		try {
			const page = await this.#ask(this.rows.length);
			if (round !== this.#round) return;
			this.rows = [...this.rows, ...page.items];
			this.total = page.total;
		} catch (e) {
			if (round !== this.#round || isAborted(e)) return;
			report(this.#what, e);
			this.fout = e;
		} finally {
			if (round === this.#round) this.laden = false;
		}
	}
}
