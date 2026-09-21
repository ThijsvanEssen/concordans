/** The only writes the app makes: method and API path (without the leading slash). */
const ALLOWED_WRITES: ReadonlyArray<readonly [method: string, path: RegExp]> = [
	['POST', /^api\/watches$/],
	['DELETE', /^api\/watches\/[\w-]+$/]
];

export const isAllowedWrite = (method: string, path: string) =>
	ALLOWED_WRITES.some(([m, pattern]) => m === method && pattern.test(path));

/**
 * Sends an allowed write to the API with the key and passes status and body back.
 * The key stays on this side: nothing of the API's headers is returned.
 */
export async function forwardWrite(
	request: Request,
	path: string,
	{
		apiBaseUrl,
		writeKey,
		fetch
	}: { apiBaseUrl: string; writeKey: string | undefined; fetch: typeof globalThis.fetch }
): Promise<Response> {
	if (!isAllowedWrite(request.method, path)) return new Response(null, { status: 404 });
	if (!writeKey) return new Response('Schrijven is niet ingesteld.', { status: 503 });

	const upstream = await fetch(new URL(`/${path}`, apiBaseUrl), {
		method: request.method,
		headers: {
			Accept: 'application/json',
			'Content-Type': request.headers.get('content-type') ?? 'application/json',
			'X-Write-Key': writeKey
		},
		body: request.method === 'DELETE' ? undefined : await request.text()
	});

	return new Response(upstream.status === 204 ? null : upstream.body, {
		status: upstream.status,
		headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' }
	});
}
