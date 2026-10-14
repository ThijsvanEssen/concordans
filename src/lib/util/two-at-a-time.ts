// One request per item, two at a time: the API's limit per address.

/** `work` for each item in turn, two running at once; done when every item is. */
export async function twoAtATime<T>(
	items: readonly T[],
	work: (item: T) => Promise<void>
): Promise<void> {
	const queue = [...items];
	const worker = async () => {
		for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
	};
	await Promise.all([worker(), worker()]);
}
