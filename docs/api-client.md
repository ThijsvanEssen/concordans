# API client

Every request is a named function in `src/lib/api`, one module per family of routes (`dossiers.ts`, `feed.ts`, `members.ts`, …); a component, a store or a page calls that function and never a client or `fetch`. The module knows nothing of how a bron is shown. `src/lib/guards/lagen.test.ts` holds both. The API is read-only: every route is a GET, without a key, at `PUBLIC_CONCORDANS_API_BASE_URL` (`base-url.ts`).

- `api` and `slowApi` (`client.ts`): two [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) clients typed by the schema. `api` gives up after `TIMEOUT_MS`; `slowApi` waits as long as the API does (`SLOW_TIMEOUT_MS`), for the search lanes, the feed, a full node and a person's votes. A function that serves both takes `wait: 'short' | 'long'` (`clientFor`).
- `unwrap(call)`: the body of a successful call; any other status throws an `ApiError`.
- `once(id, load)` (`records.ts`): a record asked once per session and shared by every view that reads it; a failure is asked again.
- `Schema<'Name'>` and `QueryOf<'/api/path'>` (`types.ts`): the generated type of a body, and the query of a route.

```ts
// $lib/api/dossiers.ts
export const getDossier = (number: string) =>
	once(`dossier/${number}`, () =>
		unwrap(api.GET('/api/dossiers/{number}', { params: { path: { number } } }))
	);
```

A path, parameter or field that is not in the schema fails `npm run check`. Array parameters are sent repeated (`types=a&types=b`).

## Errors

`errors.ts` says what a failure means: `isAborted` (the caller left, nothing to say), `isSlow` (our deadline, or a 503 or 504), `isNotFound` (a 404: not in the data, not an error) and `ifExists(call)` (null on a 404). A failure the page goes on without goes to `report(where, e)`, and the view shows it in its own place (`LoadState`); a prefetch nobody waits for takes `ignore(where)`.

## Caching

The API sends `Cache-Control: max-age=60` and an ETag that changes with every migration. The client keeps records per session (`once`), the article list per law, the stats, the law names and the party colours.

## Stopgaps

Where a field or route does not yet carry data for every bron, the front end derives the same thing itself and marks it `TODO(backend…)` (`git grep "TODO(backend"`). The fallback goes once the data covers every bron.
