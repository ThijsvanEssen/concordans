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

Call `unwrap(api.GET(...))` where the data is used. A helper is worth having when it adds logic:

| Module                | Adds                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `records.ts`          | `once(id, load)`: a record asked once per session, the 400 most recent kept, a failure asked again; getters for the records of readers |
| `articles.ts`         | one article, through `once`                                                                                                            |
| `judgments.ts`        | one judgment, through `once`                                                                                                           |
| `law-articles.ts`     | the articles of a law in order, one request per law, shared by the table of contents and Vorig/Volgend                                 |
| `stats.ts`            | `/api/stats` and `/api/stats/coverage`, once per page load                                                                             |
| `nodes.ts`            | lower-cases the key (the node routes are case-sensitive); `neighborsOf` and `bucketTotals` read the bucketed neighbour response        |
| `overlays.ts`         | turns the `in-flux` and `heat` maps into `Map` and reduces a dossier's mutations to counts                                             |
| `instrument-cache.ts` | the names of laws (title, short title such as `Sr`) that labels and citations print                                                    |
| `pool.ts`             | `inPool`: at most a few requests at a time for one action; the API limits requests per visitor                                         |

`src/lib/components/parliamentary/data.ts` holds the dossier, document and committee requests the reader and the panel Verbonden share, through `once`.

## Stopgaps

Where a field or route does not yet carry data for every bron, the front end derives the same thing itself and marks it `TODO(backend…)` (`git grep "TODO(backend"`). A fallback goes once the data covers every bron, not on an API version alone.

## Caching

The API sends `Cache-Control: max-age=60` (public for articles, judgments and stats, private for the rest) and an ETag that changes with every migration. The client keeps records per session (`once`), the article list per law, the stats, the law names and the party colours. `GraphStore` reads a node through the same `getNode` record the readers use; see [`graph-system.md`](graph-system.md).

## Errors

Failed calls throw. A view that shows the resource catches and renders its error state; data that only decorates a view (overlays, names, a group of the panel) fails silently.
