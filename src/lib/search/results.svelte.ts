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

type ResultsLane = {
	status: 'loading' | 'done' | 'failed';
	hits: Partial<Record<SearchKind, Hit[]>>;
	/** `any`: no hit held every word. */
	matched: 'all' | 'any';
	leftOut: string[];
	/** The concept block the query is a term of (`best_block`). */
	block: Schema<'BestBlockDTO'> | null;
	/** Of a query that found nothing: what to try instead. */
	suggestions: string[];
	searched: Partial<Record<SearchKind, Schema<'SearchedDTO'>>>;
	error?: unknown;
};

const fresh = (status: ResultsLane['status']): ResultsLane => ({
	status,
	hits: {},
	matched: 'all',
	leftOut: [],
	block: null,
	suggestions: [],
	searched: {}
});

/** The order of the hits: best first, or the newest first (`sort` of /api/search). */
export type ResultsSort = 'relevance' | 'newest';

type ResultsRequest = { q: string; from: string; to: string; sort?: ResultsSort };

export class SearchResults {
	lanes = $state(
		Object.fromEntries(LANES.map((l) => [l.id, fresh('done')])) as Record<LaneId, ResultsLane>
	);

	readonly #controllers = new Map<LaneId, AbortController>();
	#asked: ResultsRequest = { q: '', from: '', to: '' };

	/** Every lane has answered (or failed) for the query asked last. */
	readonly done = $derived(LANES.every((l) => this.lanes[l.id].status !== 'loading'));
	readonly failed = $derived(LANES.filter((l) => this.lanes[l.id].status === 'failed'));

	/** The concept block the query is a term of, as the first lane that names one says. */
	readonly block = $derived(
		LANES.map((l) => this.lanes[l.id].block).find((b) => b != null) ?? null
	);

	/** What to try instead of a query that found nothing: the lanes' suggestions, each once, three at most. */
	readonly suggestions = $derived(
		[...new Set(LANES.flatMap((l) => this.lanes[l.id].suggestions))].slice(0, 3)
	);

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
		const { q, from, to, sort } = this.#asked;
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
				sort: sort === 'newest' ? sort : undefined,
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
					block: r.best_block ?? null,
					suggestions: r.suggestions ?? [],
					searched: r.searched as ResultsLane['searched']
				};
			})
			.catch((error) => {
				if (!current()) return;
				this.lanes[lane.id] = { ...fresh('failed'), error };
			});
	}
}
