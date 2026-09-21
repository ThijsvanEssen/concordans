# State and stores

Where state lives, how it flows, and the patterns we lean on. If you're not sure where to put a new piece of state, read this first.

## The four state surfaces

| Surface                              | Examples                                                           | Survives                                    |
| ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------- |
| **URL query params**                 | `mode`, `focus`, `overlay`, `seed`, `wet`, `q`, `all`              | Reload, deep links, browser back/forward    |
| **Stores (`lib/stores/*`)**          | Watches, profile, overlay parser, reader cache, search opener      | Page session (some persist to localStorage) |
| **GraphStore**                       | Nodes, edges, selection, history, filters                          | Page session (in-memory only)               |
| **Local component state (`$state`)** | UI toggles, hover state, ephemeral fetch results, scroll positions | Component lifecycle                         |

Decision rule when adding new state:

```
Should it survive reload?           ──► URL param
Should multiple unrelated            ──► Store
  components share it?
Is it the graph itself?              ──► GraphStore
Is it just this component's UI?      ──► Local $state
```

When in doubt, prefer URL params for anything deep-linkable, local `$state` for everything else. Stores are the **smallest** of the three populated surfaces — only six of them. We don't reach for a store every time two components share data; we lift state up to a common parent first.

## Svelte 5 runes

This codebase is Svelte 5 throughout. The relevant runes:

| Rune                 | Use                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------- |
| `$state(initial)`    | Reactive local state inside a `<script>`. Replaces `let`-with-reactivity.             |
| `$state<T>(initial)` | Typed version. Common for discriminated unions.                                       |
| `$derived(expr)`     | Computed reactive value — cheap, runs on every dependency change.                     |
| `$derived.by(fn)`    | Computed via a function body — use when the computation needs intermediate variables. |
| `$effect(fn)`        | Side effects (fetches, subscriptions, timers). Cleanup via returned function.         |
| `$props()`           | Component props. Destructured with defaults.                                          |

### Patterns we use

**Discriminated-union state for async resources:**

```ts
let state = $state<
	| { kind: 'idle' }
	| { kind: 'loading' }
	| { kind: 'loaded'; d: DossierDetailResponse }
	| { kind: 'error'; message: string }
	| { kind: 'empty' }
>({ kind: 'idle' });
```

Template:

```svelte
{#if state.kind === 'loading'}<Skeleton />
{:else if state.kind === 'error'}<p>{state.message}</p>
{:else if state.kind === 'loaded'}{@const d = state.d}
	<!-- render d -->
{/if}
```

Always include `kind: 'empty'` and `kind: 'idle'` if those are distinguishable user-facing states. Use `{@const}` inside the matching `{#if}` block to narrow the type (Svelte 5 requires `@const` as an immediate child of the conditional block — see [`gotchas.md`](gotchas.md#svelte-5-const-placement-gotcha)).

**`$effect` with abort + cancel flag:**

```ts
$effect(() => {
	const q = query;
	if (!q) {
		results = [];
		return;
	}
	let cancelled = false;
	const ctrl = new AbortController();
	fetchSomething(q, { signal: ctrl.signal })
		.then((r) => {
			if (!cancelled) results = r;
		})
		.catch(() => {
			/* swallow on abort */
		});
	return () => {
		cancelled = true;
		ctrl.abort();
	};
});
```

The `cancelled` flag handles the race where the fetch resolves _after_ the effect cleanup ran but _before_ the next effect started. `ctrl.abort()` cancels the in-flight HTTP request. Use both — the flag protects assignment, the abort saves bandwidth.

**Debounced reactive search:**

```ts
let debounceTimer: ReturnType<typeof setTimeout>;
let inflightAbort: AbortController | null = null;
$effect(() => {
	const q = query;
	clearTimeout(debounceTimer);
	inflightAbort?.abort();
	if (!q.trim()) {
		results = empty;
		return;
	}
	debounceTimer = setTimeout(async () => {
		const ctrl = new AbortController();
		inflightAbort = ctrl;
		try {
			/* fetch */
		} finally {
			if (inflightAbort === ctrl) inflightAbort = null;
		}
	}, 60);
	return () => {
		clearTimeout(debounceTimer);
		inflightAbort?.abort();
	};
});
```

Pattern from `SearchOverlay.svelte`. 60 ms debounce is the sweet spot for our typing latency.

**URL-driven derived state:**

```ts
const overlayParam = $derived($page.url.searchParams.get('overlay'));
const overlay = $derived<Overlay>(parseOverlay(overlayParam));
```

Then an `$effect` keyed on `overlay` does the fetching. The parser lives in a store (`stores/overlay.ts`), not in the route — keeps route components thin.

**Reading from a `writable` store with `subscribe`:**

```ts
let selectedNode = $state<GraphNode | null>(null);
store.selection.subscribe((n) => {
	selectedNode = n;
});
```

Bridging legacy `Readable<T>` stores into `$state` lets template code use plain reactivity instead of `$store` syntax everywhere. Done at the top of route components.

## The six stores

All live in `src/lib/stores/`. They cover state that genuinely needs to be cross-component or persisted, and no more.

### `overlay.ts` — overlay URL contract

Not a store at runtime, despite the directory. Exports `Overlay`, `parseOverlay`, `serializeOverlay`, `HEAT_PERIODS`, `DEFAULT_HEAT_MONTHS`. Pure functions for parsing the `?overlay=` param into a discriminated union.

We keep it under `stores/` because it conceptually owns a piece of cross-component state — the overlay choice — even though the storage medium is the URL, not a writable. See [`overlays.md`](overlays.md).

### `watches.ts` — saved watches

`writable<WatchEntry[]>` initially seeded from `localStorage`, then synced via `getWatches` / `createWatch` / `deleteWatch` API calls. Intended for "notify me when this dossier changes". `WatchControl.svelte` is the only consumer and is not mounted in any route or reader, so the store is currently unused.

Watches are entity-typed (`instrument`, `article`, `dossier`). Adding a new watch type means extending `WatchEntityType` and updating the watch CRUD UI.

### `profile.ts` — domain profile

`writable<ProfileId>('strafrecht')`. Lightweight: which legal domain to favour in the empty-state hints, sidebar defaults, search ordering. Persistence is in-memory only currently; if you want it to stick across reloads, add `localStorage` like `watches.ts` does.

Profiles: `strafrecht`, `bestuursrecht`, `belasting`, `alles`. The set lives in `AVAILABLE_PROFILES` — add to that array if you introduce a new one.

### `reader.ts` — reader bridge state

Tiny store holding `{ activeArticleId, focusedCitationKey }`. Used to coordinate between the reader and the citation rail — when the user clicks a citation chip in the rail, the reader scrolls to it via this store.

If you find yourself wanting another field on this store, consider whether it should be a prop instead. This store is the last resort for state that crosses component branches that don't share an ancestor close enough to lift to.

### `search-trigger.ts` — Svelte context for opening cmd-K

Not a writable — uses Svelte `getContext` / `setContext` to expose an `open` function from `AppShell` (which owns the overlay's `open` state) to deep descendants without prop-drilling. Pattern:

```ts
// AppShell:
provideSearchOpener(() => { searchOpen = true; });

// Anywhere downstream:
const openSearch = useSearchOpener();
<button onclick={openSearch}>Zoek</button>
```

If multiple components need this pattern, mimic the shape: a `provideX` / `useX` pair in a small file under `stores/`. Don't reach for context for arbitrary state.

## The GraphStore

A different beast entirely. See [`graph-system.md`](graph-system.md#graphstore) for the full surface. Key things to understand for state purposes:

- It's instantiated **once per `/explore` page life** with `createGraphStore()`.
- It exposes `Readable<T>` stores for every observable field — components subscribe.
- It is the **only place** where graphology data lives. Components never receive a graphology instance directly.
- It survives mode switches (graph ↔ split ↔ read) because the route component holds the reference. It does **not** survive reload.

## Anti-patterns

### Don't sync URL and store

Pick one. The overlay state is a clean example: parsed from the URL on read, written to the URL on change. We _don't_ have an `overlayStore = writable(initialFromUrl)` that also writes back to the URL — that's a recipe for double sources of truth.

If you need a derived view of URL state that's expensive to recompute, use `$derived` not a store.

### Don't use stores for component-local UI state

`writable<boolean>` for "is this panel open?" is wrong. Use `$state(false)` in the component. The threshold for a store is: _more than one branch of the tree needs to mutate this_.

### Don't subscribe outside a component

`store.subscribe(...)` inside a `.ts` module without unsubscribing leaks. Always subscribe inside a `$effect` or a component's top-level so cleanup happens.

### Don't mutate `$state` inside `$derived`

`$derived` is meant to be pure. Mutation goes in `$effect`. Crossing this wire produces infinite-loop warnings or silent inconsistency.

## When to add a new store

Add a new store when:

1. State is logically global and used by ≥2 branches of the component tree with no close common ancestor.
2. State should be persisted to `localStorage` (cleanest place to encapsulate the serialisation).
3. State has a URL serialisation (mirror the `overlay.ts` pattern — pure parse/serialise, no writable).

Don't add a new store when:

1. The state is one route's local concern (use route-level `$state`).
2. Two components share state but have a shared parent within 2-3 hops (lift it up).
3. The state derives from another store (use `$derived` against it).

## Related files

| Concern                   | File                                                   |
| ------------------------- | ------------------------------------------------------ |
| URL contract (overlays)   | `src/lib/stores/overlay.ts`                            |
| Server watches            | `src/lib/stores/watches.ts`                            |
| Domain profile            | `src/lib/stores/profile.ts`                            |
| Reader/rail bridge        | `src/lib/stores/reader.ts`                             |
| Search opener context     | `src/lib/stores/search-trigger.ts`                     |
| Graph data                | `src/lib/graph/graph-store.ts`, `src/lib/graph/store/` |
| Instrument metadata cache | `src/lib/api/instrument-cache.ts` (also a writable)    |
