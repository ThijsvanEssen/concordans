// One search: the query, a request per lane and what each answered, and what the list makes
// of it (the rows, the Beste treffer, the states) with what Enter opens. Search.svelte draws
// it; `connect` asks again whenever the query, the period or the scope changes.
//
// Each lane on its own (lanes.ts): its group waits or fails alone, and Opnieuw asks
// it again without the rest. The first lane in scope also says what the query cites.
import { untrack } from 'svelte';
import { search } from '$lib/api/search';
import type { Schema } from '$lib/api/types';
import type { BronRef } from '$lib/bron/href';
import { EarlyEnter } from './enter.svelte';
import { chamberOf } from './kamer';
import {
	DEBOUNCE_MS,
	FAST_MIN_CHARS,
	LANES,
	SEARCH_KINDS,
	searchMode,
	type Lane,
	type SearchKind
} from './lanes';
import { bestHit, bySection, hitName, slots } from './present';
import { narrowerWords } from './results';
import {
	choicesOf,
	lawAbbreviation,
	lawTitle,
	resolvedOf,
	type Notation,
	type Resolved
} from './resolve-query';

type Hit = Schema<'SearchResultItem'>;
type Hits = Partial<Record<SearchKind, Hit[]>>;
type LaneId = Lane['id'];

type LaneStatus = 'done' | 'loading' | 'failed';

/** What a lane's answer says beside its hits (API 0.80.5; absent on an older API). */
type Answer = {
	term: string;
	/** The API names a `best` at all: an older API does not, and the Enter stays as it was. */
	named: boolean;
	best: string | null;
	/** `any`: no hit held every word, the hits hold some of them. */
	matched: 'all' | 'any';
	/** The stop words of the query that were left out. */
	leftOut: string[];
};

const noAnswer = (): Answer => ({
	term: '',
	named: false,
	best: null,
	matched: 'all',
	leftOut: []
});

type LaneState = {
	/** What it last answered: it stays while the next query runs. */
	hits: Hits;
	answer: Answer;
	status: LaneStatus;
	/** Why it failed: slow or broken, for failureText. */
	error?: unknown;
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

const idle = (): LaneState => ({
	hits: {},
	answer: noAnswer(),
	status: 'done',
	partial: { term: '', kinds: [] }
});

const failed = (status: LaneStatus) => status === 'failed';

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
	/** A citation the API did not confirm: its row is gone and the results stay. */
	unresolved = $state('');
	/** "AVG", which the API confirmed as a law. */
	confirmed = $state<{ term: string; target: Resolved } | null>(null);
	/**
	 * What /api/search resolved the query to (`resolve=true`, API 0.74): the bron, and the
	 * notation the query is (API 0.79.60).
	 */
	resolvedWith = $state<{
		term: string;
		target: Resolved | null;
		notation: Notation | null;
	} | null>(null);
	/** The articles a citation can mean where it is not one ("artikel 3 BW"), per query. */
	choicesFor = $state<{ term: string; items: Resolved[]; total: number } | null>(null);
	/** A regeling named by its title that the API does not know ("Omgevingswet"). */
	outside = $state('');
	/** What the search of each kind reads, as the answers say it (`searched`, API 0.79.67). */
	searched = $state<Partial<Record<SearchKind, Schema<'SearchedDTO'>>>>({});
	/** The one hit above the groups, set once every answer is in (#52). With an API that names
	 * the `best`, only that hit; else the best by score. */
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
	/** Every answer to this query is in: every lane. */
	readonly allIn = $derived(this.answered === this.q && LANES.every((l) => !this.waiting[l.id]));
	/** The answers to this query. */
	readonly answers = $derived(
		LANES.map((l) => this.lanes[l.id].answer).filter((a) => a.term === this.q)
	);
	/** The API says what the query names (`best`); else the older Enter stands. */
	readonly names = $derived(this.answers.some((a) => a.named));
	/**
	 * The id Enter may open: the best of the lane that resolves, else of another lane, else
	 * the one hit the query names exactly (`exact`) over the lanes; none for words.
	 */
	readonly bestId = $derived.by((): string | null => {
		const lane = LANES.find((l) => l.kinds.some((k) => this.kinds.includes(k)));
		const own = lane ? this.lanes[lane.id].answer : null;
		if (own?.term === this.q && own.best) return own.best;
		const other = this.answers.find((a) => a.best);
		if (other?.best) return other.best;
		const exact = this.groups.flatMap((g) => g.hits).filter((h) => h.exact);
		return exact.length === 1 ? exact[0].id : null;
	});
	/** The kinds whose hits hold only some of the words. */
	readonly partialKinds = $derived(
		new Set(
			LANES.flatMap((l) =>
				this.lanes[l.id].answer.term === this.q && this.lanes[l.id].answer.matched === 'any'
					? l.kinds
					: []
			)
		)
	);
	/** The stop words left out of the query, said where some hits hold only some words. */
	readonly leftOut = $derived(
		this.partialKinds.size === 0 ? [] : [...new Set(this.answers.flatMap((a) => a.leftOut))]
	);
	/** Words of the query to try alone where it found nothing: the longer ones, at most three. */
	readonly narrower = $derived(narrowerWords(this.q));
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
		slots(this.kinds, this.groups, this.best, (kind) => !!this.q && this.loadingKinds.has(kind))
	);
	readonly hits = $derived(this.shown.flatMap((g) => g.hits));
	readonly rowOfHit = $derived(new Map(this.hits.map((hit, i) => [hit.id, this.offset + i])));

	/** "Artikel 3 BW" in Boek 1, 3, 6 …: a row each, in place of the citation row. */
	readonly choices = $derived(this.choicesFor?.term === this.q ? this.choicesFor.items : []);
	readonly choicesMore = $derived(
		this.choicesFor?.term === this.q ? this.choicesFor.total - this.choices.length : 0
	);
	/** The notation the query is, as the API read it: its row, before the hits. */
	readonly citation = $derived(
		this.q && this.q !== this.unresolved && this.choices.length === 0
			? (this.#ofQuery(this.resolvedWith)?.notation ?? null)
			: null
	);
	readonly bare = $derived(
		!this.citation && this.choices.length === 0 && this.confirmed?.term === this.q
			? this.confirmed.target
			: null
	);
	/** Rows the keys move over: the choices or the citation first, then every hit. */
	readonly offset = $derived(this.choices.length || (this.citation || this.bare ? 1 : 0));
	readonly rowCount = $derived(this.offset + this.hits.length);
	/** A row stands chosen before a key: the Beste treffer, a citation, or the older API's first. */
	readonly preselects = $derived(!this.names || this.best !== null || this.offset > 0);

	/** A citation the API does not know: said where its row was, not dropped without a word. */
	readonly notFound = $derived(this.unresolved !== '' && this.unresolved === this.q);
	readonly chamber = $derived(chamberOf(this.q));
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
	/** The search as a whole failed: its fast lane, or a citation that could not be opened. */
	readonly failure = $derived.by((): { error: unknown } | null => {
		const lane = this.inScope.find((l) => !l.failsAlone);
		const state = lane ? this.lanes[lane.id] : null;
		return state && failed(state.status) ? { error: state.error } : null;
	});
	/**
	 * The lanes that failed on their own: each says so in its group, the others stand. Where
	 * the search as a whole failed, its one line says it for all (retrySearch).
	 */
	readonly failedLanes = $derived(
		this.failure ? [] : this.inScope.filter((l) => l.failsAlone && failed(this.lanes[l.id].status))
	);
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
			this.inScope.every((l) => this.lanes[l.id].status === 'done') &&
			// Never "Geen resultaten" while the live mode left kinds out.
			this.moreKinds.size === 0 &&
			this.hits.length === 0 &&
			!this.citation &&
			!this.bare &&
			!this.outsideLaw
	);
	/** The field turns: the fast kinds on their way. */
	readonly spinning = $derived(this.lanes.fast.status === 'loading');
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
	/** The first ↓ confirms the preselected row instead of skipping it. */
	#moved = $state(false);
	// An Enter before the answer waits for it (#79): the article the moment the API confirms
	// it, else the first row once every answer is in and the Beste treffer stands above.
	readonly #earlyEnter = new EarlyEnter(() => this.enter());

	readonly #results?: (q: string, from: string, to: string) => void;

	/**
	 * `open` opens a bron, or a hit by the name a link uses; `results` goes to the page of
	 * results of a query that names nothing exactly.
	 */
	constructor(
		open: (ref: BronRef | string, at: string | null) => void,
		results?: (q: string, from: string, to: string) => void
	) {
		this.#open = open;
		this.#results = results;
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
			if (this.allIn) this.best = this.#bestOf(this.groups);
			else if (this.groups.length === 0) this.best = null;
		});
		$effect(() => {
			void this.q;
			void this.answered;
			this.active = 0;
			this.#moved = false;
		});
		$effect(() =>
			this.#earlyEnter.answer(
				this.q,
				this.bare !== null ||
					(!!this.#ofQuery(this.resolvedWith)?.target &&
						!!this.#ofQuery(this.resolvedWith)?.notation) ||
					this.allIn
			)
		);
		$effect(() => () => this.stop());
	}

	/** Ask every lane for `request`; what the query before asked stops. */
	ask(request: SearchRequest) {
		this.#asked = request;
		if (request.term.length < FAST_MIN_CHARS) this.answered = '';
		for (const lane of LANES) this.#schedule(lane);
	}

	/** Opnieuw in a lane's group: that lane is asked again, the rest not. */
	retry(id: LaneId) {
		this.#schedule(LANES.find((l) => l.id === id)!);
	}

	/** Opnieuw under the search: the fast kinds, what the query cites, and every lane that failed. */
	retrySearch() {
		for (const lane of LANES)
			if (!lane.failsAlone || failed(this.lanes[lane.id].status)) this.#schedule(lane);
	}

	/** "Meer …": the whole query again, in full. */
	askInFull() {
		this.fullFor = this.q;
	}

	/** The requests stop: the search is gone. */
	stop() {
		this.#stopped.abort();
		for (const run of Object.values(this.#runs)) {
			clearTimeout(run.timer);
			run.controller?.abort();
			run.next = null;
		}
	}

	/** The Beste treffer: the hit the API names, else (an older API) the best by score. */
	#bestOf(groups: { kind: SearchKind; hits: Hit[] }[]): { kind: SearchKind; hit: Hit } | null {
		if (!this.names) return bestHit(groups);
		const id = this.bestId;
		for (const g of groups) {
			const hit = g.hits.find((h) => h.id === id);
			if (hit) return { kind: g.kind, hit };
		}
		return null;
	}

	/** Is the row the one a key now acts on? Not before a key, where nothing is preselected. */
	isActive(row: number): boolean {
		return this.active === row && (this.#moved || this.preselects);
	}

	/** What Enter opens now, the active row; false where there is nothing to open yet. */
	enter(): boolean {
		const { active, choices, citation, bare, offset } = this;
		if (active < choices.length) this.#open(choices[active].ref, choices[active].at);
		else if (citation && active === 0) this.openCitation();
		else if (bare && active === 0) this.#open(bare.ref, bare.at);
		// A hit opens only when the list answers what is typed: the first row once every answer
		// is in (#118), a row the reader chose at once.
		else if (
			this.answered === this.q &&
			(this.#moved || (this.allIn && this.preselects)) &&
			this.hits[active - offset]
		)
			this.#open(hitName(this.hits[active - offset]), null);
		// Words name nothing: Enter goes to the page of results (besluit 31); where there is none
		// (a panel that picks, a scope) it keeps the list and chooses its first row, a second
		// Enter opens it (besluit 30).
		else if (this.answered === this.q && this.allIn && this.hits.length > 0) {
			if (this.#results) this.#results(this.q, this.from, this.to);
			else {
				this.active = offset;
				this.#moved = true;
			}
		} else if (
			this.answered === this.q &&
			this.allIn &&
			searchMode(this.q, this.fullFor) === 'live'
		) {
			// Nothing in the live list: the whole query in full, which also tries any word of it.
			this.askInFull();
			return false;
		} else return false;
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

	/** The citation's bron, as the API named it; "staat niet in de gegevens" where it named none. */
	openCitation() {
		const target = this.#ofQuery(this.resolvedWith)?.target;
		if (target) this.#open(target.ref, target.at);
		else this.unresolved = this.q;
	}

	/** What the API answered for this query, not an earlier one. */
	#ofQuery<T extends { term: string }>(answer: T | null): T | null {
		return answer?.term === this.q ? answer : null;
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
				this.searched = { ...this.searched, ...r.searched };
				// The live mode names the kinds it cut off at its time: more on "Meer …".
				const cut = query.types.filter((k) => r.partial?.[k]);
				const answer: Answer = {
					term,
					named: 'best' in r,
					best: r.best ?? null,
					matched: r.matched ?? 'all',
					leftOut: r.left_out ?? []
				};
				this.lanes[lane.id] = { hits, answer, status: 'done', partial: { term, kinds: cut } };
				settled();
				this.#askInFullIfNothing(term, cut, hits);
				if (query.resolve) this.#resolved(term, r.resolved, lane.namesLaws);
			})
			.catch((e) => {
				if (!current()) return;
				this.lanes[lane.id] = { ...idle(), status: 'failed', error: e };
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
		this.resolvedWith = { term, target, notation: resolved?.notation ?? null };
		this.choicesFor = { term, ...choicesOf(resolved) };
		this.answered = term;
		if (!laws || resolved?.notation) return;
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
