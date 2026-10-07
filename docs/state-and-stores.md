# State and stores

| State                                                    | Lives in                                   | Survives                      |
| -------------------------------------------------------- | ------------------------------------------ | ----------------------------- |
| The bron (path), the view and its filters, the fragment  | URL ([`routes.md`](routes.md))             | reload, sharing, back/forward |
| Nodes, edges, selection, pinned, filters                 | `GraphStore`                               | view switches, not reload     |
| Records read from the API                                | `$lib/api/records.ts` and the other caches | the session                   |
| The sequence of bronnen                                  | browser history                            | reload                        |
| State shared by unrelated components                     | a store in `src/lib/stores`                | the page session              |
| Column widths, the last netwerk, the legend open or shut | `localStorage`                             | sessions                      |
| Everything else                                          | component `$state`                         | the component                 |

Prefer the URL for anything that can be linked to, `$state` for the rest. A store is for state that several branches of the tree change and that no close ancestor can hold.

There is no history in the store. Every link to a bron is a navigation (`bronHref`, see [`routes.md`](routes.md#links-to-a-bron)), so the browser's history is the history of bronnen; back and forward are `history.back()` and `history.forward()`.

## Stores

| File                | Holds                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `overlay.ts`        | Not a store: `parseOverlay` and `serializeOverlay` for `?overlay=`. See [`overlays.md`](overlays.md).       |
| `search-trigger.ts` | `provideSearchOpener` and `useSearchOpener`: Svelte context that lets any component open the search dialog. |

Module-level caches: `$lib/api/records.ts` (`once`, the records of readers and of `GraphStore`), `law-articles.ts` (the articles of a law), `stats.ts`, `instrument-cache.ts` (law names by BWB id), `src/lib/utils/party-color.svelte.ts` (party colours; a party the API does not list is grey) and the address ↔ focus maps of `bron/leesbaar.ts`.

## GraphStore

`createGraphStore()` in `src/lib/graph/graph-store.ts`, assembled from `src/lib/graph/store/`. One instance lives as long as the `/explore` page.

- `nodes`, `edges`, `selection`, `pinned`, `filters` and `trimmedCount` are `Readable`; components subscribe.
- `nodeResponse(collection, key)` reads a bron through `getNode` (`records.ts`): one request serves the canvas and the panel Verbonden.
- The graphology graph belongs to `GraphView`, built from the store's arrays. Components never receive the store's maps.
- `reset()` aborts every request in flight and empties the canvas; the records stay.
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
