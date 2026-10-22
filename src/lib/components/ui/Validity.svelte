<script lang="ts">
	// The one status line of a law and of an article that does not hold (besluit 30, 22 Oct):
	// "Vervallen per 1 januari 2020, opvolger: Wet X" or "Nog niet in werking (per …)". Both
	// readers draw it, in the place of their other statements of the stand. Red only for
	// vervallen, the word beside it; a thing that holds draws nothing here.
	import type { Validity } from '$lib/api/validity';
	import { bronHref } from '$lib/bron/href';
	import { statusOf } from '$lib/text/validity';

	let {
		validity,
		opvolger = true
	}: {
		validity: Validity | null | undefined;
		/** Leave the successor out where the page names it already (an article's own). */
		opvolger?: boolean;
	} = $props();

	const status = $derived(statusOf(validity));
	const next = $derived(opvolger ? (validity?.successors[0] ?? null) : null);
	const name = $derived(next ? (next.citation_title ?? next.title) : null);
</script>

{#if status}
	<span class="validity"
		><span class={status.negative ? 'validity__no' : 'validity__status'}>{status.text}</span
		>{#if next && name}, opvolger:
			<a href={bronHref({ collection: 'instruments', key: next.key })} data-sveltekit-noscroll
				>{name}</a
			>{/if}</span
	>
{/if}

<style>
	.validity__no {
		color: var(--uitkomst-nee);
	}
</style>
