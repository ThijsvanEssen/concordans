// The composer of the netwerk as the page holds it: what it shows and asks is here from the
// start, the composer itself (netwerk-logic) comes with the first netwerk to compose. A
// reader's page never composes, so never loads it (B178).
import type { GraphStore } from '$lib/graph/store/types';
import { countOn, type Netwerk, type NetwerkEntry } from '$lib/selection/netwerk';
import type { DirectLink } from '$lib/network/shared';
import { showNetworkFailure } from '$lib/stores/netwerk-melding';
import type { NetwerkComposer } from './netwerk-compose.svelte';
import { loadLogic } from './netwerk-logic-load.svelte';

const NONE: NetwerkEntry[] = [];
const NO_CUT: { collection: string; total: number; kept: number }[] = [];

export class ComposerHandle {
	#real = $state.raw<NetwerkComposer | null>(null);
	#keep = false;
	#epoch = 0;
	/** Set by the page before `compose`; handed to the composer when it is in. */
	surroundings = false;
	light = false;
	steps: number | null = null;

	constructor(
		private store: GraphStore,
		private room: number
	) {}

	get entries() {
		return this.#real?.entries ?? NONE;
	}
	get loading() {
		return this.#real?.loading ?? false;
	}
	get cut() {
		return this.#real?.cut ?? NO_CUT;
	}
	get reach() {
		return this.#real?.reach ?? null;
	}
	get extending() {
		return this.#real?.extending ?? false;
	}
	get composed() {
		return this.#real?.composed ?? false;
	}

	/** The composer, once its chunk is in. */
	#ready(): Promise<NetwerkComposer> {
		if (this.#real) return Promise.resolve(this.#real);
		return loadLogic().then(({ NetwerkComposer: Composer }) => {
			if (!this.#real) {
				const real = new Composer(this.store, this.room);
				if (this.#keep) real.keepCanvas();
				this.#real = real;
			}
			return this.#real;
		});
	}

	keepCanvas() {
		if (this.#real) this.#real.keepCanvas();
		else this.#keep = true;
	}
	release() {
		this.#epoch++;
		this.#real?.release();
	}
	forget() {
		this.#epoch++;
		this.#real?.forget();
	}
	countOn(n: Netwerk) {
		return this.#real ? this.#real.countOn(n) : countOn(n, NONE);
	}
	hasFull(ids: readonly string[]) {
		return this.#real?.hasFull(ids) ?? false;
	}
	async directLinks(ids: readonly string[]): Promise<DirectLink[]> {
		return (await this.#ready()).directLinks(ids);
	}

	/** Draws `n` once the composer is in; a later call wins. */
	compose(n: Netwerk): void {
		const epoch = ++this.#epoch;
		const { surroundings, light, steps } = this;
		this.#ready().then(
			(real) => {
				if (epoch !== this.#epoch) return;
				real.surroundings = surroundings;
				real.light = light;
				real.steps = steps;
				real.compose(n);
			},
			(e: unknown) =>
				showNetworkFailure({ what: 'Het netwerk', error: e, retry: () => this.compose(n) })
		);
	}
}
