// The netwerk of chosen bronnen, put on the canvas. It is drawn at once from the light nodes of
// its bronnen (0.1–0.2 s each), and again when their full nodes are in: a bron added stands on
// the canvas before the neighbours of the others (art. 3:2 Awb: 651 kB, 3.8 s on prod). The
// paths between them need only their ids, so they are asked beside the full nodes.
import { getPaths } from '$lib/api/nodes';
import { isAborted, isNotFound, report } from '$lib/api/errors';
import { getNodeFirst } from '$lib/api/records';
import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { getDossierKey } from '$lib/api/dossiers';
import type { GraphStore } from '$lib/graph/store/types';
import { nodeToGraphNode } from '$lib/graph/types';
import { deelVan, syncOn, isOn, type Netwerk, type NetwerkEntry } from '$lib/selection/netwerk';
import { showNetworkFailure } from '$lib/stores/netwerk-melding';
import { parseNodeId, type Relation } from '$lib/vocabulary';
import type { DirectLink } from '$lib/network/shared';

/** The most bronnen `/api/paths` takes in one request. */
export const PATHS_MAX = 5;
/** How many steps a path between two chosen bronnen may take (BE-38). */
const PATHS_DEPTH = 4;
/** A wet, fractie, commissie or dossier ties through its members, at most this many each. */
const EXPAND_CAP = 200;

type NodeResponse = Schema<'NodeGraphResponse'>;
type Settled = PromiseSettledResult<NodeResponse>;
type Paths = { onPath: string[]; tied: string[] };

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

/**
 * The paths between the chosen bronnen, up to four steps: what joins them further than one
 * shared neighbour. A group ties through its children too: VVD and Sr meet through a lid's
 * MEMBER_OF and an article's PART_OF (Thijs, 9 Oct). Null where they did not come: the
 * canvas then draws the shared neighbours only.
 */
async function pathsBetween(ids: string[]): Promise<Schema<'PathsResponse'> | null> {
	const query = {
		ids: ids.join(','),
		max_depth: PATHS_DEPTH,
		expand: 'members',
		expand_cap: EXPAND_CAP
	} as const;
	return getPaths(query).catch((e) => (report('Paden tussen bronnen', e), null));
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

export class NetwerkComposer {
	/** The chosen bronnen as the panel Netwerk lists them. */
	entries = $state<NetwerkEntry[]>([]);
	loading = $state(false);
	/** How many bronnen join the chosen ones. */
	joiningCount = $state(0);
	/** The paths of the last composition are not all there (`partial`, API 0.79.23). */
	partial = $state(false);
	/**
	 * Per kind, the neighbours of the chosen bronnen that came and how many there are, where the
	 * API cut them off: "200 van 6.206" (R3-N B6).
	 */
	cut = $state.raw<{ collection: string; total: number; kept: number }[]>([]);
	/** The weergave Omgeving: each chosen bron with all its neighbours, not only what they share. */
	surroundings = false;
	/** The canvas is shown (Omgeving): the paths between the chosen bronnen are asked for it. */
	drawsPaths = true;
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
	}

	/** Forget every node asked, for a canvas cleared with the store. */
	forget() {
		this.#full.clear();
		this.#fullIn.clear();
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
		const onIds = lights
			.map((r, i) => (r.status === 'fulfilled' && isOn(n, n.ids[i]) ? canvasIdOf(r.value) : null))
			.filter((id): id is string => id !== null)
			// In one order whatever the chips' order: the same netwerk asks the same paths.
			.sort();
		// The route takes 2 to 5 bronnen; a larger netwerk keeps the shared neighbours.
		const paths =
			this.drawsPaths && n.tussen && onIds.length > 1 && onIds.length <= PATHS_MAX
				? pathsBetween(onIds)
				: Promise.resolve(null);
		if (pending) this.#draw(n, lights, null, new Map(), false);
		const [results, route] = await Promise.all([fullRequests, paths]);
		if (epoch !== this.#epoch) return;
		const onPaths = route ? await this.#store.mergePaths(route) : { onPath: [], tied: [] };
		if (epoch !== this.#epoch) return;
		this.partial = !!route?.partial;
		// Per group the API widened, how many of its members it took: "via 200 van 846 leden".
		this.#draw(n, results, onPaths, new Map(Object.entries(route?.expanded ?? {})));
		this.loading = false;
		this.#view()?.fitWhenSettled();
	}

	#draw(
		n: Netwerk,
		results: Settled[],
		paths: Paths | null,
		widened: Map<string, { used: number; total: number }> = new Map(),
		final = true
	) {
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
		const fresh = !this.composed && !this.#keepCanvas;
		this.#keepCanvas = false;
		this.#view()?.suppressFit();
		const { alone, joining } = this.#store.compose({
			participants,
			withJoining: n.tussen,
			surroundings: this.surroundings,
			fresh,
			onPaths: paths?.onPath ?? [],
			tiedByPaths: paths?.tied ?? []
		});
		this.composed = true;
		this.joiningCount = joining.length;
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
					alone: participants.length > 1 && alone.has(canvasId),
					via: deelVan(widened.get(canvasId)),
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
								label: failedIds.has(id) ? 'Bron laden' : 'Bron onbekend',
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
