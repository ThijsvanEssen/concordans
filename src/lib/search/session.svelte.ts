// One search: the query, a request per lane and what each answered, and what the list makes
// of it (the rows, the Beste treffer, the states) with what Enter opens. Search.svelte draws
// it; `connect` asks again whenever the query, the period or the scope changes.
//
// Each lane on its own (lanes.ts): its group waits or fails alone, and "Probeer opnieuw" asks
// it again without the rest. The first lane in scope also says what the query cites.
import { untrack } from 'svelte';
import { isTimeout } from '$lib/api/client';
import { search } from '$lib/api/search';
import { report } from '$lib/api/errors';
import type { Schema } from '$lib/api/types';
import type { BronRef } from '$lib/bron/href';
import { EarlyEnter } from './enter.svelte';
import { kamerOf } from './kamer';
import {
	DEBOUNCE_MS,
	FAST_MIN_CHARS,
	LANES,
	SEARCH_KINDS,
	searchMode,
	type Lane,
	type SearchKind
} from './lanes';
import { besteTreffer, bySection, hitName, vakken } from './present';
import {
	bareArticle,
	keuzesOf,
	lawAbbreviation,
	lawTitle,
	parseCitation,
	resolvedOf,
	resolveQuery,
	type Resolved
} from './resolve-query';

type Hit = Schema<'SearchResultItem'>;
type Hits = Partial<Record<SearchKind, Hit[]>>;
type LaneId = Lane['id'];

/** `slow`: it gave up on its own time (`slowApi`, 30 s), not on an error of the API. */
type LaneStatus = 'done' | 'loading' | 'failed' | 'slow';

type LaneState = {
	/** What it last answered: it stays while the next query runs. */
	hits: Hits;
	status: LaneStatus;
	/** The kinds whose live answer to `term` left more out (`partial`). */
	partial: { term: string; kinds: SearchKind[] };
};

/** What the requests are asked for: the query, the kinds in scope, the period and the mode. */
type SearchRequest = {
	term: string;
	kinds: readonly SearchKind[];
	from: string;
	to: string;
	fullFor: string;
};

/** Hits per kind. */
const LIMIT = 6;

const LANE_OF = Object.fromEntries(
	LANES.flatMap((lane) => lane.kinds.map((kind) => [kind, lane.id]))
) as Record<SearchKind, LaneId>;

const idle = (): LaneState => ({ hits: {}, status: 'done', partial: { term: '', kinds: [] } });

const failed = (status: LaneStatus) => status === 'failed' || status === 'slow';

/** A lane's request under way, and the one waiting for it. */
type Run = {
	timer?: ReturnType<typeof setTimeout>;
	controller?: AbortController;
	busy: boolean;
	next: (() => void) | null;
	/** The request asked last: only its answer brings the lane in. */
	asked: number;
};

export class SearchSession {
	query = $state('');
	/** The search by period (Thijs, 9 Oct). */
	from = $state('');
	to = $state('');
	/** The query asked in full after "Meer …" (`mode=full`). */
	fullFor = $state('');
	/** The kinds searched, in the order their groups stand. */
	kinds = $state<readonly SearchKind[]>(SEARCH_KINDS);
	/** The row Enter opens: the first before any key. */
	active = $state(0);

	lanes = $state(Object.fromEntries(LANES.map((l) => [l.id, idle()])) as Record<LaneId, LaneState>);
	/** The lanes asked for the query and not yet in: from the ask on, the pause included (#118). */
	waiting = $state(Object.fromEntries(LANES.map((l) => [l.id, false])) as Record<LaneId, boolean>);
	/** The query the resolving lane answered; '' before the first answer. */
	answered = $state('');
	/** A citation being opened. */
	resolving = $state(false);
	/** The query whose bare article ("6:162 BW") the API is still asked to confirm. */
	confirming = $state('');
	/** A citation the API did not confirm: its row is gone and the results stay. */
	unresolved = $state('');
	/** "55 Gw" typed without "art.", or "AVG", which the API confirmed. */
	confirmed = $state<{ term: string; target: Resolved } | null>(null);
	/** What /api/search resolved the query to (`resolve=true`, API 0.74). */
	resolvedWith = $state<{ term: string; target: Resolved | null } | null>(null);
	/** The articles a citation can mean where it is not one ("artikel 3 BW"), per query. */
	choicesFor = $state<{ term: string; items: Resolved[]; total: number } | null>(null);
	/** A regeling named by its title that the API does not know ("Omgevingswet"). */
	outside = $state('');
	/** Opening a citation failed: the search says so, to try again. */
	citeFailure = $state<{ slow: boolean } | null>(null);
	/** The one hit above the groups, set once every answer is in (#52). */
	best = $state<{ kind: SearchKind; hit: Hit } | null>(null);

	readonly q = $derived(this.query.trim());
	readonly request = $derived<SearchRequest>({
		term: this.q,
		kinds: this.kinds,
		from: this.from,
		to: this.to,
		fullFor: this.fullFor
	});
	/** The lanes with a kind in scope, with only those kinds. */
	readonly inScope = $derived(
		LANES.map((l) => ({ ...l, kinds: l.kinds.filter((k) => this.kinds.includes(k)) })).filter(
			(l) => l.kinds.length > 0
		)
	);

	// The groups stand in one order, the order of the kinds, whichever answer comes first
	// (UX-toets 0.79.47, #52): a group that comes later takes its own place and moves none of
	// the others. The best answer is the Beste treffer above them.
	readonly groups = $derived(
		this.kinds
			.map((kind) => ({ kind, hits: bySection(this.hitsOf(kind)) }))
			.filter((g) => g.hits.length > 0)
	);
	/** Every answer to this query is in: every lane, and the article it may cite. */
	readonly allIn = $derived(
		this.answered === this.q &&
			this.confirming !== this.q &&
			LANES.every((l) => !this.waiting[l.id])
	);
	readonly bestComing = $derived(!this.best && !this.allIn && this.groups.length > 0);
	/** The kinds whose group says "laden…" while their lane waits. */
	readonly loadingKinds = $derived(
		new Set(
			this.inScope
				.filter((l) => l.showsLoading && this.lanes[l.id].status === 'loading')
				.flatMap((l) => l.kinds)
		)
	);
	/** The groups in the one order, with the places of those still coming (#52). */
	readonly shown = $derived(
		vakken(this.kinds, this.groups, this.best, (kind) => !!this.q && this.loadingKinds.has(kind))
	);
	readonly hits = $derived(this.shown.flatMap((g) => g.hits));
	readonly rowOfHit = $derived(new Map(this.hits.map((hit, i) => [hit.id, this.offset + i])));

	/** "Artikel 3 BW" in Boek 1, 3, 6 …: a row each, in place of the citation row. */
	readonly choices = $derived(this.choicesFor?.term === this.q ? this.choicesFor.items : []);
	readonly choicesMore = $derived(
		this.choicesFor?.term === this.q ? this.choicesFor.total - this.choices.length : 0
	);
	readonly citation = $derived(
		this.q && this.q !== this.unresolved && this.choices.length === 0 ? parseCitation(this.q) : null
	);
	readonly bare = $derived(
		!this.citation && this.choices.length === 0 && this.confirmed?.term === this.q
			? this.confirmed.target
			: null
	);
	/** Rows the keys move over: the choices or the citation first, then every hit. */
	readonly offset = $derived(this.choices.length || (this.citation || this.bare ? 1 : 0));
	readonly rowCount = $derived(this.offset + this.hits.length);

	/** A citation the API does not know: said where its row was, not dropped without a word. */
	readonly notFound = $derived(this.unresolved !== '' && this.unresolved === this.q);
	readonly chamber = $derived(kamerOf(this.q));
	// A regeling named by its title that the API does not know ("Omgevingswet"): the network
	// holds a selection of laws, and the hits only mention it.
	readonly outsideLaw = $derived(
		this.outside !== '' &&
			this.outside === this.q &&
			this.answered === this.q &&
			!this.bare &&
			!this.hitsOf('instruments').some((h) =>
				(h.display_name ?? '').toLowerCase().includes(this.q.toLowerCase())
			)
	);
	/** The lanes that failed on their own: each says so in its group, the others stand. */
	readonly failedLanes = $derived(
		this.inScope.filter((l) => l.failsAlone && failed(this.lanes[l.id].status))
	);
	/** The search as a whole failed: its fast lane, or a citation that could not be opened. */
	readonly failure = $derived.by((): { slow: boolean } | null => {
		const lane = this.inScope.find((l) => !l.failsAlone);
		const status = lane ? this.lanes[lane.id].status : 'done';
		return failed(status) ? { slow: status === 'slow' } : this.citeFailure;
	});
	/** Kinds whose live answer left more out for this query, not yet asked in full. */
	readonly moreKinds = $derived(
		new Set(
			LANES.flatMap(({ id }) => {
				const { term, kinds } = this.lanes[id].partial;
				return term === this.q && this.fullFor !== this.q ? kinds : [];
			})
		)
	);
	readonly empty = $derived(
		this.q.length > 0 &&
			this.answered === this.q &&
			!this.citeFailure &&
			this.inScope.every((l) => this.lanes[l.id].status === 'done') &&
			// Never "Geen resultaten" while the live mode left kinds out.
			this.moreKinds.size === 0 &&
			this.hits.length === 0 &&
			!this.citation &&
			!this.bare &&
			!this.outsideLaw
	);
	/** The field turns: the fast kinds on their way, or a citation being opened. */
	readonly spinning = $derived(this.lanes.fast.status === 'loading' || this.resolving);
	/** The list has something to show, a row or a state. */
	readonly filled = $derived(
		this.rowCount > 0 ||
			!!this.failure ||
			this.empty ||
			this.notFound ||
			this.outsideLaw ||
			!!this.chamber ||
			(!!this.q &&
				this.inScope.some((l) => {
					const status = this.lanes[l.id].status;
					return status !== 'done' && (status !== 'loading' || l.showsLoading);
				}))
	);

	readonly #open: (ref: BronRef | string, at: string | null) => void;
	readonly #runs = Object.fromEntries(
		LANES.map((l) => [l.id, { busy: false, next: null, asked: 0 }])
	) as Record<LaneId, Run>;
	/** Aborted when the search goes: the requests that wait their turn. */
	readonly #stopped = new AbortController();
	#asked: SearchRequest = {
		term: '',
		kinds: SEARCH_KINDS,
		from: '',
		to: '',
		fullFor: ''
	};
	#cite?: { timer: ReturnType<typeof setTimeout>; controller: AbortController };
	/** The first ↓ confirms the preselected row instead of skipping it. */
	#moved = false;
	// An Enter before the answer waits for it (#79): the article the moment the API confirms
	// it, else the first row once every answer is in and the Beste treffer stands above.
	readonly #earlyEnter = new EarlyEnter(() => this.enter());

	/** `open` opens a bron, or a hit by the name a link uses. */
	constructor(open: (ref: BronRef | string, at: string | null) => void) {
		this.#open = open;
	}

	/** The hits a kind's lane last answered. */
	hitsOf(kind: SearchKind): Hit[] {
		return this.lanes[LANE_OF[kind]].hits[kind] ?? [];
	}

	/** The session's effects, for as long as its owner lives. */
	connect() {
		$effect(() => {
			const request = this.request;
			untrack(() => this.ask(request));
		});
		// The one before stands while the next query is under way; a query too short for any
		// answer clears it. Only once every answer is in, so the top does not change under the
		// pointer.
		$effect(() => {
			if (this.allIn) this.best = besteTreffer(this.groups);
			else if (this.groups.length === 0) this.best = null;
		});
		$effect(() => {
			void this.q;
			void this.answered;
			this.active = 0;
			this.#moved = false;
		});
		$effect(() => this.#earlyEnter.answer(this.q, this.bare !== null || this.allIn));
		$effect(() => () => this.stop());
	}

	/** Ask every lane for `request`, and confirm what it cites; what the query before asked stops. */
	ask(request: SearchRequest) {
		this.#asked = request;
		this.citeFailure = null;
		if (request.term.length < FAST_MIN_CHARS) this.answered = '';
		this.#confirmBareArticle(request.term);
		for (const lane of LANES) this.#schedule(lane);
	}

	/** "Probeer opnieuw" in a lane's group: that lane is asked again, the rest not. */
	retry(id: LaneId) {
		this.#schedule(LANES.find((l) => l.id === id)!);
	}

	/** "Probeer opnieuw" under the search: the fast kinds and what the query cites. */
	retrySearch() {
		this.citeFailure = null;
		this.#confirmBareArticle(this.#asked.term);
		for (const lane of LANES) if (!lane.failsAlone) this.#schedule(lane);
	}

	/** "Meer …": the whole query again, in full. */
	askInFull() {
		this.fullFor = this.q;
	}

	/** The requests stop: the search is gone. */
	stop() {
		this.#stopped.abort();
		this.#cite?.controller.abort();
		if (this.#cite) clearTimeout(this.#cite.timer);
		for (const run of Object.values(this.#runs)) {
			clearTimeout(run.timer);
			run.controller?.abort();
			run.next = null;
		}
	}

	/** What Enter opens now, the active row; false where there is nothing to open yet. */
	enter(): boolean {
		const { active, choices, citation, bare, offset } = this;
		if (active < choices.length) this.#open(choices[active].ref, choices[active].at);
		else if (citation && active === 0) this.openCitation().catch((e) => report('Zoeken', e));
		else if (bare && active === 0) this.#open(bare.ref, bare.at);
		// A hit opens only when the list answers what is typed: the first row once every answer
		// is in (#118), a row the reader chose at once.
		else if (this.answered === this.q && (this.allIn || this.#moved) && this.hits[active - offset])
			this.#open(hitName(this.hits[active - offset]), null);
		else return false;
		return true;
	}

	/** Enter: what can open opens, else it waits for the answer. */
	pressEnter() {
		this.#earlyEnter.press(this.q);
	}

	down() {
		this.#earlyEnter.forget();
		if (this.#moved) this.active = Math.min(this.active + 1, this.rowCount - 1);
		this.#moved = true;
	}

	up() {
		this.#earlyEnter.forget();
		this.active = Math.max(this.active - 1, 0);
		this.#moved = true;
	}

	/** The pointer moved onto a row. */
	point(row: number) {
		this.active = row;
		this.#moved = true;
	}

	async openCitation() {
		if (this.resolving) return;
		const term = this.q;
		this.resolving = true;
		// The answer that came with the hits, where it names the bron; else the full way.
		const known = this.resolvedWith?.term === term ? this.resolvedWith.target : null;
		try {
			const target = known ?? (await resolveQuery(term));
			if (target) this.#open(target.ref, target.at);
			else this.unresolved = term;
		} catch (e) {
			// The API failed: not "niet in de gegevens", but the failure, to try again.
			report('Zoeken', e);
			this.citeFailure = { slow: isTimeout(e) };
		} finally {
			this.resolving = false;
		}
	}

	/** Beside the words, the article they may cite: shown only once the API has it. */
	#confirmBareArticle(term: string) {
		if (this.#cite) {
			clearTimeout(this.#cite.timer);
			this.#cite.controller.abort();
		}
		const written = term.length >= FAST_MIN_CHARS ? bareArticle(term) : null;
		if (!written) return;
		const controller = new AbortController();
		const timer = setTimeout(() => {
			this.confirming = term;
			// A failure leaves the row out: the words are searched all the same.
			resolveQuery(written)
				.then((target) => {
					if (!controller.signal.aborted && target) this.confirmed = { term, target };
				})
				.catch((e) => report('Zoeken', e))
				.finally(() => {
					if (this.confirming === term) this.confirming = '';
				});
		}, DEBOUNCE_MS);
		this.#cite = { timer, controller };
	}

	/** The lane asked for the request, once the typing pauses. */
	#schedule(lane: Lane) {
		const run = this.#runs[lane.id];
		const { term, kinds, from, to, fullFor } = this.#asked;
		clearTimeout(run.timer);
		run.next = null;
		if (lane.abortsOnRetype) {
			run.controller?.abort();
			if (failed(this.lanes[lane.id].status)) this.lanes[lane.id].status = 'done';
		}
		const types = lane.kinds.filter((k) => kinds.includes(k));
		if (types.length === 0 || term.length < lane.minChars) {
			this.lanes[lane.id] = idle();
			this.waiting[lane.id] = false;
			return;
		}
		const asked = ++run.asked;
		this.waiting[lane.id] = true;
		const resolves = LANES.find((l) => l.kinds.some((k) => kinds.includes(k)))?.id === lane.id;
		const query = {
			q: term,
			types,
			limit: LIMIT,
			resolve: resolves || undefined,
			mode: searchMode(term, fullFor),
			from: from || undefined,
			to: to || undefined
		};
		run.timer = setTimeout(() => this.#request(lane, query, asked), DEBOUNCE_MS);
	}

	#request(
		lane: Lane,
		query: { q: string; types: SearchKind[]; resolve?: boolean },
		asked: number
	) {
		const run = this.#runs[lane.id];
		if (!lane.abortsOnRetype && run.busy) {
			run.next = () => this.#request(lane, query, asked);
			return;
		}
		const { signal } = lane.abortsOnRetype
			? (run.controller = new AbortController())
			: this.#stopped;
		const term = query.q;
		// An answer to an older query is not shown; the hits before it stay.
		const current = () => !signal.aborted && term === this.q;
		// The lane is in once the request asked last answers, not an older one before it.
		const settled = () => {
			if (asked === run.asked) this.waiting[lane.id] = false;
		};
		run.busy = true;
		this.lanes[lane.id].status = 'loading';
		// The search client waits as long as the API may (30 s): a cold path took longer than
		// the 10 s of the others (Thijs, 10 Oct).
		search(query, { signal })
			.then((r) => {
				if (!current()) return;
				const hits = r.results as Hits;
				// The live mode names the kinds it cut off at its time: more on "Meer …".
				const cut = query.types.filter((k) => r.partial?.[k]);
				this.lanes[lane.id] = { hits, status: 'done', partial: { term, kinds: cut } };
				settled();
				this.#askInFullIfNothing(term, cut, hits);
				if (query.resolve) this.#resolved(term, r.resolved, lane.namesLaws);
			})
			.catch((e) => {
				if (!current()) return;
				this.lanes[lane.id] = { ...idle(), status: isTimeout(e) ? 'slow' : 'failed' };
				settled();
				if (query.resolve) this.answered = term;
			})
			.finally(() => {
				run.busy = false;
				const next = run.next;
				run.next = null;
				next?.();
			});
	}

	/** What the query cites, as the answer of the resolving lane says. */
	#resolved(term: string, resolved: Schema<'ResolveResponse'> | null | undefined, laws: boolean) {
		const target = resolvedOf(resolved);
		this.resolvedWith = { term, target };
		this.choicesFor = { term, ...keuzesOf(resolved) };
		this.answered = term;
		if (!laws || bareArticle(term)) return;
		// The law an abbreviation stands for, first: "AVG" has its law the moment its hits are
		// there, so Enter cannot open a hit before the law is known. A title the API does not
		// know is a law outside the selection.
		const title = lawTitle(term);
		if (!lawAbbreviation(term) && !title) return;
		if (target?.ref.collection === 'instruments') this.confirmed = { term, target };
		else if (title) this.outside = term;
	}

	/**
	 * A live answer that left kinds out and found nothing in them is no answer yet: the query
	 * is asked once more in full, by itself, as "Meer …" would (Thijs, 10 Oct: "126ffa"). With
	 * hits, the hits stand and "Meer …" asks for the rest.
	 */
	#askInFullIfNothing(term: string, cut: SearchKind[], found: Hits) {
		if (this.fullFor === term || term !== this.q || cut.length === 0) return;
		if (cut.every((k) => !(found[k] ?? []).length)) this.fullFor = term;
	}
}
