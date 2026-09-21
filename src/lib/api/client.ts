// Voorkeur voor de nieuwe env-naam; PUBLIC_LAWGRAPH_API_BASE_URL wordt nog
// gelezen als fallback zodat bestaande deployments niet stuk gaan voor de
// .env van de host is bijgewerkt.
const API_BASE =
	(import.meta.env.PUBLIC_CONCORDANS_API_BASE_URL as string | undefined) ??
	(import.meta.env.PUBLIC_LAWGRAPH_API_BASE_URL as string | undefined) ??
	(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000');

type FetchOptions = {
	signal?: AbortSignal;
	params?: Record<string, string | number | boolean | undefined>;
};

const DEFAULT_TIMEOUT_MS = 10_000;

export async function apiGet<T>(path: string, opts: FetchOptions = {}): Promise<T> {
	const url = new URL(path, API_BASE);

	if (opts.params) {
		for (const [k, v] of Object.entries(opts.params)) {
			if (v !== undefined) url.searchParams.set(k, String(v));
		}
	}

	// Compose caller signal with a default timeout so requests never hang forever.
	const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
	const signal = opts.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal;

	const t0 = performance.now();
	const res = await fetch(url.toString(), {
		headers: { Accept: 'application/json' },
		signal
	});
	const tFetch = performance.now() - t0;

	if (!res.ok) {
		throw new Error(`API GET ${url} failed with status ${res.status}`);
	}

	const text = await res.text();
	const tBody = performance.now() - t0;
	const data = JSON.parse(text) as T;
	const tParse = performance.now() - t0;

	// Always log API calls — they're the most common cause of "why is this slow".
	const sizeKb = (text.length / 1024).toFixed(1);
	const tag = tParse > 300 ? '[perf!]' : '[perf]';
	console.log(
		`${tag} api ${path} — ${Math.round(tParse)}ms (${sizeKb}kB; ` +
			`fetch ${Math.round(tFetch)}ms, body ${Math.round(tBody - tFetch)}ms, ` +
			`parse ${Math.round(tParse - tBody)}ms)`
	);

	return data;
}

export async function apiPost<T>(
	path: string,
	body: unknown,
	opts: { signal?: AbortSignal } = {}
): Promise<T> {
	const url = new URL(path, API_BASE);
	const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
	const signal = opts.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal;

	const res = await fetch(url.toString(), {
		method: 'POST',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal
	});

	if (!res.ok) throw new Error(`API POST ${url} failed with status ${res.status}`);
	return res.json() as Promise<T>;
}

export async function apiDelete(path: string, opts: { signal?: AbortSignal } = {}): Promise<void> {
	const url = new URL(path, API_BASE);
	const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
	const signal = opts.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal;

	const res = await fetch(url.toString(), {
		method: 'DELETE',
		headers: { Accept: 'application/json' },
		signal
	});

	if (!res.ok) throw new Error(`API DELETE ${url} failed with status ${res.status}`);
}
