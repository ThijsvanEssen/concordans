// A list counts its total and facets once per change of the data (API 0.79.41): a set of
// filters not counted yet waits 3 s for them, then answers with the whole page, empty facets
// and `partial` (the total null, unless it was counted apart). A later question has them.
// It is asked again past the browser's cache: that keeps every answer 60 s, and after that
// the ETag of the data version answers a 304 for the partial one until the data changes
// (B127: Rechtsgebied stayed empty on Wetten).

/** The waits before each new question: a big set can take many seconds to count. */
export const WAITS = [1500, 3000, 6000, 12000];

const pause = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((done, fail) => {
		const t = setTimeout(done, ms);
		signal?.addEventListener('abort', () => {
			clearTimeout(t);
			fail(signal.reason);
		});
	});

/**
 * The answer of `ask`, asked again (`fresh`: past the browser's cache), later each time,
 * while it is `counting`: the counted answer, or the last one still counting after the last
 * wait. The signal (a new filter) ends the asking. From `first` where it was asked already.
 */
export async function untilCounted<T>(
	ask: (fresh: boolean) => Promise<T>,
	counting: (answer: T) => boolean,
	signal?: AbortSignal,
	first?: T
): Promise<T> {
	let answer = first ?? (await ask(false));
	for (const ms of WAITS) {
		if (!counting(answer)) break;
		await pause(ms, signal);
		answer = await ask(true);
	}
	return answer;
}

/** Past the browser's cache, where `fresh`: the init of an openapi-fetch call. */
export const freshInit = (fresh: boolean) => (fresh ? { cache: 'reload' as const } : {});
