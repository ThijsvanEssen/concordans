// A bound on how many requests one action sends: at most `parallel` at a time and at most
// `max` in all. The API has a limit per visitor (200 a minute); one composed netwerk
// must not spend it on the dossiers of every stuk on its paths.

/** `work` for each item, `parallel` at a time, for the first `max` items only. */
export async function inPool<T, R>(
	items: readonly T[],
	work: (item: T) => Promise<R>,
	{ parallel = 4, max = Number.POSITIVE_INFINITY }: { parallel?: number; max?: number } = {}
): Promise<R[]> {
	const todo = items.slice(0, max);
	const results: R[] = new Array(todo.length);
	let next = 0;
	const worker = async () => {
		while (next < todo.length) {
			const i = next++;
			results[i] = await work(todo[i]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(parallel, todo.length) }, worker));
	return results;
}
