# State and stores

| State                                                             | Lives in                    | Survives                      |
| ----------------------------------------------------------------- | --------------------------- | ----------------------------- |
| Mode, focus, naast, overlay, index category and filters, fragment | URL                         | reload, sharing, back/forward |
| Nodes, edges, selection, pinned, filters, node response cache     | `GraphStore`                | mode switches, not reload     |
| The sequence of bronnen                                           | browser history             | reload                        |
| State shared by unrelated components                              | a store in `src/lib/stores` | the page session              |
| Column widths of the explorer                                     | `localStorage`              | sessions                      |
| Everything else                                                   | component `$state`          | the component                 |

Prefer the URL for anything that can be linked to, `$state` for the rest. A store is for state that several branches of the tree change and that no close ancestor can hold.

There is no history in the store. Every link to a bron is a navigation (`bronHref`, see [`routes.md`](routes.md#links-to-a-bron)), so the browser's history is the history of bronnen; back and forward are `history.back()` and `history.forward()`.

## Stores

| File                | Holds                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `overlay.ts`        | Not a store: `parseOverlay` and `serializeOverlay` for `?overlay=`. See [`overlays.md`](overlays.md).       |
| `search-trigger.ts` | `provideSearchOpener` and `useSearchOpener`: Svelte context that lets any component open the search dialog. |

`src/lib/api/instrument-cache.ts` is a store as well: law names by BWB id, filled as responses pass by and primed once with the 200 largest laws.

## GraphStore

`createGraphStore()` in `src/lib/graph/graph-store.ts`, assembled from `src/lib/graph/store/`. One instance lives as long as the `/explore` page.

- `nodes`, `edges`, `selection`, `pinned`, `filters` and `trimmedCount` are `Readable`; components subscribe.
- `nodeResponse(collection, key)` is the cached node response of a bron: one request serves the canvas and the panel Verbonden.
- The graphology graph belongs to `GraphView`, built from the store's arrays. Components never receive the store's maps.
- `reset()` aborts every request in flight and empties the canvas.
- Node kinds, edge categories and labels come from `src/lib/graph/types.ts`; collections and relations from `src/lib/vocabulary.ts`.

## Patterns

Async resources are a discriminated union, so a template cannot forget a state:

```ts
let view = $state<
	| { kind: 'loading' }
	| { kind: 'loaded'; dossier: Schema<'DossierDetailResponse'> }
	| { kind: 'error'; message: string }
>({ kind: 'loading' });
```

An effect that fetches passes an `AbortSignal` and aborts in its cleanup, so a view the user has left does not write late results:

```ts
$effect(() => {
	const controller = new AbortController();
	unwrap(api.GET('/api/search', { params: { query: { q } }, signal: controller.signal }))
		.then((result) => (results = result))
		.catch(() => {});
	return () => controller.abort();
});
```

An effect depends on primitives (the key, the `bwb_id`), so a new selection object for the same bron does not reload it.

Do not keep the URL and a store in sync: parse the URL in a `$derived` and write it with `goto(url, { replaceState: true })`. Do not mutate `$state` inside `$derived`.
