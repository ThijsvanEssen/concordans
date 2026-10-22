// A step to the bron before or after (Vorig, Volgend): its text is asked first, and only
// once it is in does the address change. A step that fails leaves the bron on the screen as
// it was, with a line that says what failed and Opnieuw (E3, B23: a failed Volgend artikel
// cleared the whole Verkenner, its address already on the next article).
import { goto } from '$app/navigation';
import { isAborted, report } from '$lib/api/errors';
import type { LoadFailure } from '$lib/util/load.svelte';

export type Stap = {
	href: string;
	/** As the failure names it: "Artikel 6:163". */
	naam: string;
	/** What the bron needs to stand (its text), asked before the address changes. */
	laad: () => Promise<unknown>;
};

/** A click that opens elsewhere (a new tab, a download): the browser's, not ours. */
const elders = (e: MouseEvent) =>
	e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

export class Stappen {
	/** The step on its way. */
	bezig = $state<string | null>(null);
	/** The step that failed, for LoadState. */
	fout = $state.raw<LoadFailure | null>(null);

	/** Follows `stap` once its text is in; a click elsewhere goes as it would. */
	volg = (stap: Stap, e?: MouseEvent): void => {
		if (e && elders(e)) return;
		e?.preventDefault();
		this.bezig = stap.href;
		this.fout = null;
		stap.laad().then(
			() => {
				if (this.bezig !== stap.href) return;
				this.bezig = null;
				goto(stap.href, { noScroll: true }).catch((error) => report('Stap', error));
			},
			(error) => {
				if (this.bezig !== stap.href || isAborted(error)) return;
				report('Stap', error);
				this.bezig = null;
				this.fout = { what: stap.naam, error, retry: () => this.volg(stap) };
			}
		);
	};
}
