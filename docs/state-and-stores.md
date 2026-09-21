# State and stores

| State                                                    | Lives in                    | Survives                      |
| -------------------------------------------------------- | --------------------------- | ----------------------------- |
| Mode, focus, seed, overlay, index category and filters   | URL query                   | reload, sharing, back/forward |
| Nodes, edges, selection, history, filters of the network | `GraphStore`                | mode switches, not reload     |
| State shared by unrelated components                     | a store in `src/lib/stores` | the page session              |
| Everything else                                          | component `$state`          | the component                 |

Prefer the URL for anything that can be linked to, `$state` for the rest. A store is for state that several branches of the tree change and that no close ancestor can hold.

## Stores

| File                | Holds                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overlay.ts`        | Not a store: `parseOverlay` and `serializeOverlay` for `?overlay=`. See [`overlays.md`](overlays.md).                                                                             |
| `search-trigger.ts` | `provideSearchOpener` and `useSearchOpener`: Svelte context that lets any component open the search overlay.                                                                      |
| `watches.ts`        | Saved watches: a list in `localStorage`, mirrored to the API through the write proxy ([`api-client.md`](api-client.md#writes)). No page mounts `WatchControl`, its only consumer. |

`src/lib/api/instrument-cache.ts` is a store as well: law names by BWB id, filled as responses pass by.

## GraphStore

`createGraphStore()` in `src/lib/graph/graph-store.ts`, assembled from `src/lib/graph/store/`. One instance lives as long as the `/explore` page.

- Every observable field is a `Readable`; components subscribe.
- It owns the graphology graph. Components never receive it.
- Loads that a new load replaces are aborted; `reset()` aborts all.
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

An effect that fetches passes an `AbortSignal` and aborts in its cleanup, so a view that was left does not write late results:

```ts
$effect(() => {
	const controller = new AbortController();
	unwrap(api.GET('/api/search', { params: { query: { q } }, signal: controller.signal }))
		.then((result) => (results = result))
		.catch(() => {});
	return () => controller.abort();
});
```

Do not keep the URL and a store in sync: parse the URL in a `$derived` and write it with `goto(url, { replaceState: true })`. Do not mutate `$state` inside `$derived`.
