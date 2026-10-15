// One way to load what a key names: the state is loading, an error or the data, never a
// null that could mean all three. A new key aborts the request for the old one and starts
// over from loading; an answer for a key no longer asked is dropped; a failure is reported
// (errors.ts) and kept for LoadState to show, with retry to ask again.
import { untrack } from 'svelte';
import { isAborted, report } from '$lib/api/errors';

export type LoadState<T> =
	| { status: 'loading' }
	| { status: 'error'; error: unknown }
	| { status: 'ready'; data: T };

type Fetch<K, T> = (key: K, signal: AbortSignal) => Promise<T>;

/** The loader without the runes: `load` starts a key, `retry` the last one, `stop` drops it. */
export function createLoader<K, T>(
	fetch: Fetch<K, T>,
	onState: (state: LoadState<T>) => void,
	where: string
) {
	let current: { key: K; controller: AbortController } | null = null;

	function load(key: K) {
		current?.controller.abort();
		const controller = new AbortController();
		const asked = (current = { key, controller });
		onState({ status: 'loading' });
		let request: Promise<T>;
		try {
			request = fetch(key, controller.signal);
		} catch (e) {
			request = Promise.reject(e);
		}
		request.then(
			(data) => {
				if (current === asked) onState({ status: 'ready', data });
			},
			(error) => {
				if (current !== asked || isAborted(error)) return;
				report(where, error);
				onState({ status: 'error', error });
			}
		);
	}

	return {
		load,
		retry: () => {
			if (current) load(current.key);
		},
		stop: () => {
			current?.controller.abort();
			current = null;
		}
	};
}

/**
 * What `key()` names, loaded by `fetch` for as long as the component lives:
 * `const lid = load(() => id, (id, signal) => getMember(id, { signal }), 'Lid')`, then
 * `<LoadState state={lid.state} what="Het lid" retry={lid.retry}>`. Only the key is
 * tracked: what `fetch` reads does not start it again.
 */
export function load<K, T>(key: () => K, fetch: Fetch<K, T>, where = 'load') {
	let state = $state.raw<LoadState<T>>({ status: 'loading' });
	const loader = createLoader<K, T>(fetch, (s) => (state = s), where);
	const asked = $derived(key());
	$effect(() => {
		const k = asked;
		untrack(() => loader.load(k));
		return loader.stop;
	});
	return {
		get state() {
			return state;
		},
		retry: loader.retry
	};
}
