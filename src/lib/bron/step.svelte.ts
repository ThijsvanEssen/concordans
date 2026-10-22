// A step to the bron before or after (Vorig, Volgend): its text is asked first, and only
// once it is in does the address change. A step that fails leaves the bron on the screen as
// it was, with a line that says what failed and Opnieuw (E3, B23: a failed Volgend artikel
// cleared the whole Verkenner, its address already on the next article).
import { goto } from '$app/navigation';
import { isAborted, report } from '$lib/api/errors';
import type { LoadFailure } from '$lib/util/load.svelte';

export type Step = {
	href: string;
	/** As the failure names it: "Artikel 6:163". */
	name: string;
	/** What the bron needs to stand (its text), asked before the address changes. */
	load: () => Promise<unknown>;
};

/** A click that opens elsewhere (a new tab, a download): the browser's, not ours. */
const elsewhere = (e: MouseEvent) =>
	e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

export class Steps {
	/** The step on its way. */
	pending = $state<string | null>(null);
	/** The step that failed, for LoadState. */
	failure = $state.raw<LoadFailure | null>(null);

	/** Follows `step` once its text is in; a click elsewhere goes as it would. */
	follow = (step: Step, e?: MouseEvent): void => {
		if (e && elsewhere(e)) return;
		e?.preventDefault();
		this.pending = step.href;
		this.failure = null;
		step.load().then(
			() => {
				if (this.pending !== step.href) return;
				this.pending = null;
				goto(step.href, { noScroll: true }).catch((error) => report('Step', error));
			},
			(error) => {
				if (this.pending !== step.href || isAborted(error)) return;
				report('Step', error);
				this.pending = null;
				this.failure = { what: step.name, error, retry: () => this.follow(step) };
			}
		);
	};
}
