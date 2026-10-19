<script lang="ts">
	// What is new since the visit before, marked one way wherever it is (Gevolgd, a bundel): a
	// small corner in ink, as a new cell of Gevolgd's grid carries it; with `since`, its words
	// beside it as a label (`nieuw sinds 12 oktober 2026`), never a count.
	import { langeDatum } from '$lib/text/datum';

	let { since = null }: { since?: string | null } = $props();
</script>

{#if since}<span class="nieuw-sinds"
		><span class="nieuwteken" aria-hidden="true"></span>nieuw sinds {langeDatum(since)}</span
	>{:else}<span class="nieuwteken is-los" role="img" aria-label="nieuw"></span>{/if}

<style>
	.nieuw-sinds {
		white-space: nowrap;
	}
	.nieuwteken {
		display: inline-block;
		margin-right: var(--s-2);
		border-style: solid;
		border-width: 0 var(--s-2) var(--s-2) 0;
		border-color: transparent var(--ink) transparent transparent;
	}
	.is-los {
		margin: 0 0 0 var(--s-2);
	}
</style>
