// /api/decisions counts its total and facets per set of filters, once per change of the data
// (API 0.79.41). A set not counted yet waits 3 s for them, then answers with the whole page,
// `total` null, empty facets and `partial`; a question a moment later has them. The page
// shows at once; the counts are asked for once more.
import { api, unwrap } from './client';
import type { operations } from './generated/openapi-types';

type Query = NonNullable<operations['list_decisions_api_decisions_get']['parameters']['query']>;
type Antwoord = Awaited<ReturnType<typeof besluiten>>;

/** How long before the second question: the counting goes on after the first answer. */
const WACHT = 1500;

export const besluiten = (query: Query, signal?: AbortSignal) =>
	unwrap(api.GET('/api/decisions', { params: { query }, signal }));

/** The total and facets were still being counted when this answer was made. */
export const nogTeTellen = (r: Pick<Antwoord, 'total' | 'partial'>) =>
	r.partial === true && r.total === null;

const wacht = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((klaar, mis) => {
		const t = setTimeout(klaar, ms);
		signal?.addEventListener('abort', () => {
			clearTimeout(t);
			mis(signal.reason);
		});
	});

/** The same question once more, a moment later, for its counts; null where it needs none. */
export async function telling(r: Antwoord, query: Query, signal?: AbortSignal) {
	if (!nogTeTellen(r)) return null;
	await wacht(WACHT, signal);
	return besluiten(query, signal);
}

/** For a question that is about its counts (limit 1, the facets): the counted answer. */
export async function geteld(query: Query, signal?: AbortSignal): Promise<Antwoord> {
	const r = await besluiten(query, signal);
	return (await telling(r, query, signal)) ?? r;
}
