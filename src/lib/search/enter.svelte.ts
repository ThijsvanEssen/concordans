// Enter right after typing comes before the answer it should open (#79). It is kept for its
// query and done once that answer is in: the article a bare citation names the moment the
// API confirms it, the first row once every answer is in. A changed query drops it.

export class EarlyEnter {
	/** The query whose Enter waits for its answer; '' for none. */
	waiting = $state('');

	/** `open` does what Enter does now, and says whether it opened anything. */
	constructor(private readonly open: () => boolean) {}

	/** Enter: what can open opens; else the Enter waits for the answer to `term`. */
	press(term: string) {
		this.waiting = this.open() ? '' : term;
	}

	/** A key that moves the choice: the reader chooses, the waiting Enter goes. */
	forget() {
		this.waiting = '';
	}

	/** What Enter can open may have changed: `ready` once it opens what is there, or nothing. */
	answer(term: string, ready: boolean) {
		if (!this.waiting) return;
		if (this.waiting !== term) this.waiting = '';
		else if (ready) {
			this.waiting = '';
			this.open();
		}
	}
}
