<script lang="ts">
	// Every vote taken on a motie or an amendement, on the page of the stuk itself (API 0.73,
	// BE-33), each in the one form of a vote's outcome (VoteLine): an earlier
	// "Uitstellen" too. The vote that settled it stands in the head, at rest, and not again
	// here (`except`): each vote is said once.
	import type { Schema } from '$lib/api/types';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import VoteLine from './VoteLine.svelte';

	let {
		decisions,
		except = null
	}: {
		decisions: Schema<'DecisionDTO'>[];
		/** The key of the vote the head already says. */
		except?: string | null;
	} = $props();

	const rest = $derived(decisions.filter((d) => d.key !== except));
</script>

{#if rest.length > 0}
	<Sectie title="Stemming">
		{#each rest as d (d.key)}
			<div class="stemming"><VoteLine decision={d} /></div>
		{/each}
	</Sectie>
{/if}

<style>
	.stemming + .stemming {
		margin-top: var(--s-3);
	}
</style>
