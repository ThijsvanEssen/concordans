// A component in a chunk of its own, asked once, when it is first needed or ahead of that.
// A chunk that does not come (a deploy removed it) is reported and kept as the failure to say
// in its place with Opnieuw (`retry`, a new import), and the page loads again once from the new
// release ($lib/util/reload.ts).
import { report } from '$lib/api/errors';
import { reloadForNewVersion } from '$lib/util/reload';

export class Lazy<T> {
	/** The component, once its chunk is in. */
	component = $state<T | null>(null);
	/** Why its chunk did not come. */
	error = $state<unknown>(null);
	#asked = false;
	#load: () => Promise<{ default: T }>;
	#what: string;

	constructor(load: () => Promise<{ default: T }>, what: string) {
		this.#load = load;
		this.#what = what;
	}

	/** Asks the chunk, once; again after a failure. It never fails: a failure is `error`. */
	load(): void {
		if (this.#asked) return;
		this.#asked = true;
		this.#load().then(
			(m) => {
				this.component = m.default;
				this.error = null;
			},
			(e: unknown) => {
				report(this.#what, e);
				this.error = e;
				this.#asked = false;
				reloadForNewVersion();
			}
		);
	}

	/** Opnieuw after a failure: the chunk asked again. */
	retry = (): void => this.load();
}
