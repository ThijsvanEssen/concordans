<script lang="ts" module>
	/** A 429: the reader asked too much in a while, whatever failed. */
	export const RATE_LIMIT_TEXT = 'Even te veel verzoeken';

	/**
	 * When a 429 of `what` was last asked again by itself: once, also where its LoadState goes
	 * and comes back with the next try (a failure the page keeps, not a loader).
	 */
	const autoRetried = new Map<string, number>();
	const AUTO_RETRY_MS = 120_000;

	/** An answer for `what` came: its next 429 asks again by itself. */
	export const answered = (what: string) => autoRetried.delete(what);
</script>

<script lang="ts">
	// The wait of a 429 (LoadState): its Retry-After counted down, then the same asked again
	// by itself, once per subject. LoadState says it, with the seconds left and whether the
	// repeat comes by itself.
	import { untrack, type Snippet } from 'svelte';
	import { retryAt } from '$lib/api/errors';
	import type { ApiError } from '$lib/api/client';

	let {
		error,
		what,
		retry,
		children
	}: {
		error: ApiError;
		/** What was asked: the subject of the one repeat by itself. */
		what: string;
		retry?: () => void;
		/** The seconds left, and whether the repeat comes by itself. */
		children: Snippet<[number, boolean]>;
	} = $props();

	let now = $state(Date.now());
	let repeated = $state((autoRetried.get(untrack(() => what)) ?? 0) > Date.now() - AUTO_RETRY_MS);
	const wait = $derived(Math.max(0, Math.ceil((retryAt(error) - now) / 1000)));
	const auto = $derived(!!retry && !repeated);

	$effect(() => {
		const e = error;
		untrack(() => {
			now = Date.now();
		});
		const tick = setInterval(() => {
			now = Date.now();
			if (now < retryAt(e)) return;
			clearInterval(tick);
			if (!retry || repeated) return;
			repeated = true;
			autoRetried.set(what, Date.now());
			retry();
		}, 1000);
		return () => clearInterval(tick);
	});
</script>

{@render children(wait, auto)}
