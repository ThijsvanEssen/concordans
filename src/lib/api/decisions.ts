// /api/decisions counts its total and facets per set of filters, once per change of the data
// (API 0.79.41). A set not counted yet waits 3 s for them, then answers with the whole page,
// `total` null, empty facets and `partial`; a later question has them. The page shows at
// once; the counts are asked for again, a little later each time, until they come.
import { api, unwrap } from './client';
import type { operations } from './generated/openapi-types';

type Query = NonNullable<operations['list_decisions_api_decisions_get']['parameters']['query']>;
type Antwoord = Awaited<ReturnType<typeof besluiten>>;

/** The waits before each new question: a big set can take many seconds to count. */
export const WACHTEN = [1500, 3000, 6000, 12000];

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

/**
 * The same question again, later each time, until its counts come: the counted answer, or
 * the last one still counting after the last wait; null where it needed none. The signal
 * (a new filter) ends the asking.
 */
export async function telling(r: Antwoord, query: Query, signal?: AbortSignal) {
	if (!nogTeTellen(r)) return null;
	let laatst = r;
	for (const ms of WACHTEN) {
		await wacht(ms, signal);
		laatst = await besluiten(query, signal);
		if (!nogTeTellen(laatst)) break;
	}
	return laatst;
}

/** For a question that is about its counts (limit 1, the facets): the counted answer. */
export async function geteld(query: Query, signal?: AbortSignal): Promise<Antwoord> {
	const r = await besluiten(query, signal);
	return (await telling(r, query, signal)) ?? r;
}
