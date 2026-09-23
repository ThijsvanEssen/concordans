# API client

`src/lib/api/client.ts` exports:

- `api`: an [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) client typed by the schema. The API is read-only, so every call goes straight to it (`PUBLIC_CONCORDANS_API_BASE_URL`, default `http://localhost:8000`), no key involved. Every request times out after 10 s.
- `unwrap(call)`: the body of a successful call. Any other status throws an `ApiError` with the status.

`src/lib/api/types.ts` exports `Schema<'Name'>`, the generated type of a request or response body.

```ts
const dossier = await unwrap(
	api.GET('/api/dossiers/{number}', { params: { path: { number } }, signal })
);
```

A path, parameter or field that is not in the schema fails `npm run check`. There is no other way to call the API: components do not call `fetch`.
Array parameters are sent repeated (`types=a&types=b`).

## Adding a call

Call `unwrap(api.GET(...))` where the data is used. A helper is worth having only when it adds logic:

| Module                | Adds                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `articles.ts`         | joins concurrent requests for the same article (reader, panel and hover preview ask at once)                                    |
| `judgments.ts`        | joins concurrent requests for the same judgment (reader and panel)                                                              |
| `nodes.ts`            | lower-cases the key (the node routes are case-sensitive); `neighborsOf` and `bucketTotals` read the bucketed neighbour response |
| `overlays.ts`         | turns the `in-flux` and `heat` maps into `Map` and reduces a dossier's mutations to counts                                      |
| `instrument-cache.ts` | keeps the names of laws (title, short title such as `Sr`) that labels and citations print; primes the 200 largest laws once     |

`src/lib/components/parliamentary/data.ts` joins the dossier, document and committee requests the reader and the panel Verbonden share.

## Stopgaps

The snapshot is API 0.6.0. Where a field or route does not yet carry data for every bron (the ingest pipeline has not reached it), the front end falls back to deriving the same thing itself: `chamberOf` reads `chamber` or the key prefix, `explanatoryDocuments` reads `explained-by` or merges the node's neighbours with the dossiers of the law, `LezenNav` groups by `breadcrumb` or shows a flat list when every article's is empty. Each fallback is marked `TODO(backend Bn)` in the code (`git grep "TODO(backend"`); it goes once the pipeline covers every bron, not on an API version alone.

## Caching

The API sets `Cache-Control` (articles 30 min, judgments 1 h, stats 5 min, the rest 60 s private); the browser applies it. The client keeps no cache of its own except the in-flight joins above and the law names. `GraphStore` caches one node response per bron (`nodeResponse`), which the canvas and the panel Verbonden share; see [`graph-system.md`](graph-system.md).

## Errors

Failed calls throw. A view that shows the resource catches and renders its error state; data that only decorates a view (overlays, names, a group of the panel) fails silently.
