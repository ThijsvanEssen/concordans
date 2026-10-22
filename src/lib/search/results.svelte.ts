// The asking of the results page: the whole query in full (`mode=full`), a request per lane
// (lanes.ts) so the fast kinds stand at once and the judgments fill in as they come. Each lane
// fails and retries alone. The live list (session.svelte.ts) asks while typing; this asks
// once per query, for up to RESULT_LIMIT hits per kind.
import { search } from '$lib/api/search';
import type { Schema } from '$lib/api/types';
import { LANES, type Lane, type SearchKind } from './lanes';
import { RESULT_LIMIT } from './results';

type Hit = Schema<'SearchResultItem'>;
type LaneId = Lane['id'];

export type ResultsLane = {
	status: 'loading' | 'done' | 'failed';
	hits: Partial<Record<SearchKind, Hit[]>>;
	/** `any`: no hit held every word. */
	matched: 'all' | 'any';
	leftOut: string[];
	searched: Partial<Record<SearchKind, Schema<'SearchedDTO'>>>;
	error?: unknown;
};

const fresh = (status: ResultsLane['status']): ResultsLane => ({
	status,
	hits: {},
	matched: 'all',
	leftOut: [],
	searched: {}
});

export type ResultsRequest = { q: string; from: string; to: string };

export class SearchResults {
	lanes = $state(
		Object.fromEntries(LANES.map((l) => [l.id, fresh('done')])) as Record<LaneId, ResultsLane>
	);

	readonly #controllers = new Map<LaneId, AbortController>();
	#asked: ResultsRequest = { q: '', from: '', to: '' };

	/** Every lane has answered (or failed) for the query asked last. */
	readonly done = $derived(LANES.every((l) => this.lanes[l.id].status !== 'loading'));
	readonly failed = $derived(LANES.filter((l) => this.lanes[l.id].status === 'failed'));

	/** The hits of a kind, as its lane last answered. */
	hitsOf(kind: SearchKind): Hit[] {
		const lane = LANES.find((l) => l.kinds.includes(kind))!;
		return this.lanes[lane.id].hits[kind] ?? [];
	}

	/** The lane that answered for a kind: whether its hits hold only some of the words. */
	laneOf(kind: SearchKind): ResultsLane {
		return this.lanes[LANES.find((l) => l.kinds.includes(kind))!.id];
	}

	/** Ask every lane for `request`; what was asked before stops. */
	ask(request: ResultsRequest) {
		this.#asked = request;
		for (const lane of LANES) this.#request(lane);
	}

	/** Opnieuw: only the lane that failed. */
	retry(id: LaneId) {
		this.#request(LANES.find((l) => l.id === id)!);
	}

	/** The requests stop: the page is gone. */
	stop() {
		for (const c of this.#controllers.values()) c.abort();
		this.#controllers.clear();
	}

	#request(lane: Lane) {
		const { q, from, to } = this.#asked;
		this.#controllers.get(lane.id)?.abort();
		if (q.length < 2) {
			this.lanes[lane.id] = fresh('done');
			return;
		}
		const controller = new AbortController();
		this.#controllers.set(lane.id, controller);
		const current = () => !controller.signal.aborted;
		// The hits of the query before stay under their old state until the new ones are in.
		this.lanes[lane.id] = { ...fresh('loading') };
		search(
			{
				q,
				types: [...lane.kinds],
				limit: RESULT_LIMIT,
				mode: 'full',
				from: from || undefined,
				to: to || undefined
			},
			{ signal: controller.signal }
		)
			.then((r) => {
				if (!current()) return;
				this.lanes[lane.id] = {
					status: 'done',
					hits: r.results as ResultsLane['hits'],
					matched: r.matched ?? 'all',
					leftOut: r.left_out ?? [],
					searched: r.searched as ResultsLane['searched']
				};
			})
			.catch((error) => {
				if (!current()) return;
				this.lanes[lane.id] = { ...fresh('failed'), error };
			});
	}
}
