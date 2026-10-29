// The netwerk of chosen bronnen, put on the canvas. It is drawn at once from the light nodes of
// its bronnen (0.1–0.2 s each), and again when their full nodes are in: a bron added stands on
// the canvas before the neighbours of the others (art. 3:2 Awb: 651 kB, 3.8 s on prod).
import { isAborted, isNotFound, report } from '$lib/api/errors';
import { getNodeFirst } from '$lib/api/records';
import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { getDossierKey } from '$lib/api/dossiers';
import { inPool } from '$lib/api/pool';
import { SOFT_NODE_CAP, type GraphStore } from '$lib/graph/store/types';
import { nodeToGraphNode } from '$lib/graph/types';
import { syncOn, isOn, type Netwerk, type NetwerkEntry } from '$lib/selection/netwerk';
import { showNetworkFailure } from '$lib/stores/netwerk-melding';
import { parseNodeId, type Relation } from '$lib/vocabulary';
import { depthFor } from './explore-url';
import type { DirectLink } from '$lib/network/shared';

type NodeResponse = Schema<'NodeGraphResponse'>;
type Settled = PromiseSettledResult<NodeResponse>;

/** What the canvas offers the composer: to keep its view while it draws, and to fit after. */
export type CanvasView = { suppressFit(): void; fitWhenSettled(): void };

const canvasIdOf = (r: NodeResponse) => `${r.node.collection}/${r.node.key}`;

/** A link names a dossier by its number (`37020-XV`); the API gives its node key. */
async function apiKey(id: string) {
	const target = parseNodeId(id);
	if (!target) throw new Error(`no bron ${id}`);
	const key = target.collection === 'dossiers' ? await getDossierKey(target.key) : target.key;
	return { collection: target.collection, key };
}

/** Per collection, the neighbours the nodes of `responses` hold and how many there are, where fewer came. */
export function cutOf(
	responses: readonly NodeResponse[]
): { collection: string; total: number; kept: number }[] {
	const per = new Map<string, { collection: string; total: number; kept: number }>();
	for (const r of responses)
		for (const b of r.neighbors?.buckets ?? []) {
			const c = per.get(b.collection) ?? { collection: b.collection, total: 0, kept: 0 };
			c.total += b.total;
			c.kept += b.items.length;
			per.set(b.collection, c);
		}
	return [...per.values()].filter((c) => c.kept < c.total);
}

/**
 * A bron alone brings at most `cap` neighbours per bucket (besluit 29: 150); a composed netwerk
 * keeps the node's 200 per bron. The bucket's `total` stays, so the cut says "150 van 905".
 */
export function withinCap(response: NodeResponse, cap: number): NodeResponse {
	const buckets = response.neighbors?.buckets;
	if (!buckets || buckets.every((b) => b.items.length <= cap)) return response;
	return {
		...response,
		neighbors: {
			...response.neighbors!,
			buckets: buckets.map((b) =>
				b.items.length > cap ? { ...b, items: b.items.slice(0, cap) } : b
			)
		}
	};
}

/**
 * The most chosen bronnen that ask for steps beyond the first (Aantal stappen 2 and 3): one
 * request each, two at a time (measured 28 Oct: 0.2 to 1.5 s warm, 22 s cold at 3 steps). The
 * others stay at one step.
 */
export const REACH_MAX = 6;

/**
 * Per request, the share of the canvas's room one chosen bron takes (at least 50). The room is
 * one budget, SOFT_NODE_CAP places shared by the chosen bronnen, and a group that folds costs
 * one: so a request may bring more than it can show, and the budget picks the most important.
 */
export const reachCap = (bronnen: number) =>
	Math.max(50, Math.floor(SOFT_NODE_CAP / Math.max(1, bronnen)));

export class NetwerkComposer {
	/** The chosen bronnen as the panel Netwerk lists them. */
	entries = $state<NetwerkEntry[]>([]);
	loading = $state(false);
	/**
	 * Per kind, the neighbours of the chosen bronnen that came and how many there are, where the
	 * API cut them off: "200 van 6.206" (R3-N B6).
	 */
	cut = $state.raw<{ collection: string; total: number; kept: number }[]>([]);
	/** The weergave Omgeving: each chosen bron with all its neighbours, not only what they share. */
	surroundings = false;
	/** Aantal stappen as the address says it (?diepte); null: the default of each bron. */
	steps: number | null = null;
	/**
	 * How far the steps beyond the first reached, once they are in: the most steps asked, and
	 * whether the API cut one of the neighbourhoods off at its cap. Null while none is asked.
	 */
	reach = $state.raw<{ depth: number; capped: boolean; cap: number } | null>(null);
	/** The steps beyond the first are on their way. */
	extending = $state(false);
	/** Whether the canvas is a composed netwerk now. */
	composed = false;

	#store: GraphStore;
	#view: () => CanvasView | null;
	#epoch = 0;
	/** The first composition grows out of the current canvas instead of starting anew. */
	#keepCanvas = false;
	#full = new Map<string, Promise<NodeResponse>>();
	/** The chosen bronnen whose full node is in. */
	#fullIn = new Set<string>();
	/** Per chosen bron and steps asked (`id:2`), whether the API cut that neighbourhood off. */
	#reached = new Map<string, boolean>();
	/** How far the last composition went: 0 only the chosen, 1 their surroundings, n steps. */
	#level = 0;

	constructor(store: GraphStore, view: () => CanvasView | null) {
		this.#store = store;
		this.#view = view;
	}

	/** The next composition keeps what is on the canvas, as context. */
	keepCanvas() {
		this.#keepCanvas = true;
	}

	/** The canvas is no netwerk any more: the store lets it go. */
	release() {
		this.#store.releaseNetwerk();
		this.composed = false;
		this.entries = [];
		this.#reached.clear();
		this.#level = 0;
		this.reach = null;
	}

	/** Forget every node asked, for a canvas cleared with the store. */
	forget() {
		this.#full.clear();
		this.#fullIn.clear();
		this.#reached.clear();
		this.#level = 0;
		this.reach = null;
		this.composed = false;
		this.entries = [];
	}

	/** Draw `n`; a later call wins. A failure leaves the canvas and says so in the network, with Opnieuw. */
	compose(n: Netwerk): void {
		this.#compose(n).catch((e) => {
			if (isAborted(e)) return;
			report('Netwerk samenstellen', e);
			this.loading = false;
			showNetworkFailure({ what: 'Het netwerk', error: e, retry: () => this.compose(n) });
		});
	}

	#fullOf(id: string): Promise<NodeResponse> {
		let request = this.#full.get(id);
		if (!request) {
			request = apiKey(id).then(({ collection, key }) => this.#store.nodeResponse(collection, key));
			request.then(
				() => this.#fullIn.add(id),
				() => this.#full.delete(id)
			);
			this.#full.set(id, request);
		}
		return request;
	}

	/**
	 * The verbindingen between the chosen bronnen themselves (`ids`, as the netwerk names them),
	 * read from their full nodes, by canvas id: `members/d MEMBER_OF factions/v`. For Verband.
	 */
	async directLinks(ids: readonly string[]): Promise<DirectLink[]> {
		const responses = (await Promise.allSettled(ids.map((id) => this.#fullOf(id))))
			.filter((r): r is PromiseFulfilledResult<NodeResponse> => r.status === 'fulfilled')
			.map((r) => r.value);
		const chosen = new Set(responses.map(canvasIdOf));
		const seen = new Set<string>();
		const links: DirectLink[] = [];
		for (const r of responses) {
			const self = canvasIdOf(r);
			for (const b of r.neighbors?.buckets ?? [])
				for (const item of b.items) {
					if (item.id === self || !chosen.has(item.id)) continue;
					const [from, to] = b.direction === 'inbound' ? [item.id, self] : [self, item.id];
					const key = `${from}|${to}|${b.relation}`;
					if (seen.has(key)) continue;
					seen.add(key);
					links.push({ from, to, relation: b.relation as Relation });
				}
		}
		return links;
	}

	/** A chosen bron's light node (one neighbour per bucket), or its full one where that is in. */
	async #lightOf(id: string): Promise<NodeResponse> {
		if (this.#fullIn.has(id)) return this.#fullOf(id);
		const { collection, key } = await apiKey(id);
		return getNodeFirst(collection, key);
	}

	async #compose(n: Netwerk) {
		const epoch = ++this.#epoch;
		this.loading = true;
		this.entries = syncOn(this.entries, n);
		const fullRequests = Promise.allSettled(n.ids.map((id) => this.#fullOf(id)));
		const pending = n.ids.some((id) => !this.#fullIn.has(id));
		const lights = await Promise.allSettled(n.ids.map((id) => this.#lightOf(id)));
		if (epoch !== this.#epoch) return;
		if (pending) this.#draw(n, lights, false);
		const results = await fullRequests;
		if (epoch !== this.#epoch) return;
		this.#draw(n, results);
		this.loading = false;
		this.#view()?.fitWhenSettled();
		await this.#extend(n, results, epoch);
	}

	/**
	 * Steps beyond the first: the neighbourhood of each chosen bron that is on, `steps` deep, added
	 * to the canvas. The union of them is the netwerk; a bron that two reach is drawn once.
	 */
	async #extend(n: Netwerk, results: Settled[], epoch: number) {
		const ends = n.ids.flatMap((id, i) => {
			const r = results[i];
			if (!this.surroundings || r.status !== 'fulfilled' || !isOn(n, id)) return [];
			const node = nodeToGraphNode(r.value.node);
			const steps = node ? depthFor(node.drawClass, { explicit: this.steps, all: false }) : 1;
			return steps >= 2
				? [{ id, collection: r.value.node.collection, key: r.value.node.key, steps }]
				: [];
		});
		const asked = new Set(ends.map((e) => `${e.id}:${e.steps}`));
		for (const k of this.#reached.keys()) if (!asked.has(k)) this.#reached.delete(k);
		const cap = reachCap(Math.min(ends.length, REACH_MAX));
		const todo = ends.slice(0, REACH_MAX).filter((e) => !this.#reached.has(`${e.id}:${e.steps}`));
		const sum = () => {
			const done = ends.filter((e) => this.#reached.has(`${e.id}:${e.steps}`));
			this.reach = done.length
				? {
						depth: Math.max(...done.map((e) => e.steps)),
						capped: done.some((e) => this.#reached.get(`${e.id}:${e.steps}`)),
						cap
					}
				: null;
		};
		sum();
		if (todo.length === 0) return;
		this.extending = true;
		this.#view()?.suppressFit();
		try {
			await inPool(
				todo,
				async (e) => {
					if (epoch !== this.#epoch) return;
					await this.#store
						.expandNeighborhood(e.collection as NetwerkEntry['collection'], e.key, {
							depth: e.steps,
							cap,
							additive: true,
							onCut: (capped) => this.#reached.set(`${e.id}:${e.steps}`, capped)
						})
						.catch((error) => {
							if (!isAborted(error)) report('Netwerk, stappen', error);
						});
					if (epoch === this.#epoch) sum();
				},
				{ parallel: 2 }
			);
		} finally {
			if (epoch === this.#epoch) {
				this.extending = false;
				this.#view()?.fitWhenSettled();
			}
		}
	}

	/** 0: the chosen bronnen alone; 1: with their surroundings; more: the steps asked. */
	#levelOf(n: Netwerk, found: { id: string; response: NodeResponse }[]) {
		if (!this.surroundings) return 0;
		let level = 1;
		for (const { id, response } of found) {
			const node = isOn(n, id) ? nodeToGraphNode(response.node) : null;
			if (node)
				level = Math.max(level, depthFor(node.drawClass, { explicit: this.steps, all: false }));
		}
		return level;
	}

	#draw(n: Netwerk, results: Settled[], final = true) {
		const participants: { response: NodeResponse }[] = [];
		const found: { id: string; response: NodeResponse }[] = [];
		const missing: string[] = [];
		let failed: unknown = null;
		const failedIds = new Set<string>();
		results.forEach((r, i) => {
			if (r.status !== 'fulfilled') {
				missing.push(n.ids[i]);
				// Unknown to the API is a gap; any other answer (a 502) may be asked again.
				if (!isNotFound(r.reason) && !isAborted(r.reason)) {
					failed = r.reason;
					failedIds.add(n.ids[i]);
				}
				return;
			}
			found.push({ id: n.ids[i], response: r.value });
			if (isOn(n, n.ids[i])) participants.push({ response: r.value });
		});
		if (participants.length === 1)
			participants[0] = { response: withinCap(participants[0].response, SOFT_NODE_CAP) };
		// A shorter reach than the last one lets the farther bronnen go: the canvas starts anew.
		const level = this.#levelOf(n, found);
		const shorter = level < this.#level;
		this.#level = level;
		if (shorter) {
			this.#reached.clear();
			this.reach = null;
		}
		const fresh = (!this.composed && !this.#keepCanvas) || shorter;
		this.#keepCanvas = false;
		this.#view()?.suppressFit();
		const { alone } = this.#store.compose({
			participants,
			surroundings: this.surroundings,
			steps: level,
			fresh
		});
		this.composed = true;
		this.cut = cutOf(participants.map((p) => p.response));
		this.entries = [
			...found.map(({ id, response }): NetwerkEntry => {
				const node = nodeToGraphNode(response.node);
				const canvasId = canvasIdOf(response);
				return {
					id,
					label: node?.label ?? naamVanId(id, response.node.display_name),
					node: node ?? undefined,
					collection: response.node.collection as NetwerkEntry['collection'],
					on: isOn(n, id),
					// A Staatsblad-publicatie is drawn with the wetten it changes, so it is not "without
					// connection" however little it shares with the other bronnen.
					alone:
						participants.length > 1 &&
						alone.has(canvasId) &&
						node?.raw?.props?.kind !== 'publicatie',
					connections: response.neighbors?.total
				};
			}),
			// A chosen bron the API does not know (an old link, a removed record) stays listed,
			// so the netwerk does not shrink without a word.
			...missing.flatMap((id): NetwerkEntry[] => {
				const ref = parseNodeId(id);
				return ref
					? [
							{
								id,
								// Never the raw key (`bwbr0005289`): the name is not there yet.
								label: failedIds.has(id) ? 'Bron laden' : 'Bron niet in de gegevens',
								collection: ref.collection as NetwerkEntry['collection'],
								on: false,
								alone: false,
								missing: true
							}
						]
					: [];
			})
		];
		// A bron that did not come is asked again with Opnieuw, the others with it.
		if (failed && final) {
			report('Netwerk samenstellen', failed);
			showNetworkFailure({ what: 'Het netwerk', error: failed, retry: () => this.compose(n) });
		}
	}
}
