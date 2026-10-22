<script lang="ts" module>
	/** A 429: the reader asked too much in a while, whatever failed. */
	export const RATE_LIMIT_TEXT = 'Even te veel verzoeken';

	/**
	 * When a 429 of `what` was last asked again by itself: once, also where its LoadState goes
	 * and comes back with the next try (a failure the page keeps, not a loader).
	 */
	const vanzelfBij = new Map<string, number>();
	const VANZELF_MS = 120_000;

	/** An answer for `what` came: its next 429 asks again by itself. */
	export const answered = (what: string) => vanzelfBij.delete(what);
</script>

<script lang="ts">
	// A 429 in place of a failure (LoadState): the wait of its Retry-After counted down, then
	// the same asked again by itself, once per subject; after that Opnieuw, once the wait is
	// over. The seconds are for the eye; a screen reader hears the sentence once.
	import { untrack } from 'svelte';
	import { retryAt } from '$lib/api/errors';
	import type { ApiError } from '$lib/api/client';
	import TekstLink from './TekstLink.svelte';

	let {
		error,
		what,
		retry,
		tag = 'p',
		block = false
	}: {
		error: ApiError;
		/** What was asked: the subject of the one repeat by itself. */
		what: string;
		retry?: () => void;
		tag?: 'p' | 'span';
		block?: boolean;
	} = $props();

	let now = $state(Date.now());
	let repeated = $state((vanzelfBij.get(untrack(() => what)) ?? 0) > Date.now() - VANZELF_MS);
	const wait = $derived(Math.max(0, Math.ceil((retryAt(error) - now) / 1000)));
	const vanzelf = $derived(!!retry && !repeated);

	$effect(() => {
		const e = error;
		untrack(() => (now = Date.now()));
		const tick = setInterval(() => {
			now = Date.now();
			if (now < retryAt(e)) return;
			clearInterval(tick);
			if (!retry || repeated) return;
			repeated = true;
			vanzelfBij.set(what, Date.now());
			retry();
		}, 1000);
		return () => clearInterval(tick);
	});
</script>

<svelte:element this={tag} class="stil" class:block role="status">
	{#if wait > 0}
		<span aria-hidden="true">{RATE_LIMIT_TEXT}, opnieuw over {wait} s.</span>
		<span class="sr-only">{RATE_LIMIT_TEXT}{vanzelf ? ', zo meteen opnieuw' : ''}.</span>
	{:else}
		{RATE_LIMIT_TEXT}.
		{#if retry}<TekstLink onclick={retry}>Opnieuw</TekstLink>{/if}
	{/if}
</svelte:element>

<style>
	.block {
		padding: var(--s-5) 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
</style>
