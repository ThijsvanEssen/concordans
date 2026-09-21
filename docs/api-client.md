# API client

`src/lib/api/client.ts` exports:

- `api`: an [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) client typed by the schema. Reads go straight to the API (`PUBLIC_CONCORDANS_API_BASE_URL`, default `http://localhost:8000`). Every request times out after 10 s.
- `unwrap(call)`: the body of a successful call. Any other status throws an `ApiError` with the status.
- `writes`: the same client for the server routes that write (see below).

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

| Module                | Adds                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `articles.ts`         | joins concurrent requests for the same article (three components ask on mount)             |
| `nodes.ts`            | lower-cases the key: the node routes are case-sensitive and keys are lower case            |
| `overlays.ts`         | turns the `in-flux` and `heat` maps into `Map` and reduces a dossier's mutations to counts |
| `instrument-cache.ts` | keeps the names of laws (title, short title such as `Sr`) that labels and citations print  |

## Caching

The API sets `Cache-Control` (articles 30 min, judgments 1 h, stats 5 min, the rest 60 s private); the browser applies it. The client keeps no cache of its own except the in-flight joins above and the law names.

## Writes

The write routes need `X-Write-Key`, which a browser cannot hold. `src/routes/proxy/[...path]/+server.ts` receives `POST /proxy/api/watches` and `DELETE /proxy/api/watches/{id}`, adds the key from `LAWGRAPH_WRITE_API_KEY` (server environment, never `PUBLIC_`), calls the API and returns its status and body. Any other method or path is refused with 404, and without a key the route answers 503. The rules are in `src/lib/server/write-proxy.ts` and covered by its test.

The route runs on the server, so a deployment needs an adapter that runs server code (Node, Vercel, Cloudflare); a static adapter cannot serve it. `adapter-auto` picks one from the environment it builds in.

Curation (`POST /api/relationships/tag`) is not exposed.

## Errors

Failed calls throw. A view that shows the resource catches and renders its error state; data that only decorates a view (overlays, names) fails silently.
