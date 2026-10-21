<script lang="ts">
	// The outcome of a vote, read at rest: "Aangenomen op 29 september 2026, 120 voor, 30
	// tegen", then the fracties voor and tegen. One form wherever a vote is read: in the head
	// of the motie or amendement it settled, in its Stemming section, in the opened row of a
	// stemming (Stemmingen, Actueel), where the row already gives the outcome (`head` off). The
	// stemming itself is one step further, by the day. A decision given without its votes is
	// asked whole, after the first paint. Words from vote-line.ts.
	import type { Schema } from '$lib/api/types';
	import { getDecision } from '$lib/api/records';
	import BronLink from '$lib/bron/BronLink.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { langeDatum } from '$lib/text/datum';
	import { load } from '$lib/util/load.svelte';
	import Stem from './Stem.svelte';
	import Uitkomst from './Uitkomst.svelte';
	import { hasSides, voteLineOf } from './vote-line';

	type Decision = Schema<'DecisionDTO'>;

	let {
		decision = null,
		decisionKey = null,
		head = true
	}: {
		/** The decision as the page has it (a stuk's `decisions`). */
		decision?: Decision | null;
		/** The stemming's key, where the page has no decision: it is asked. */
		decisionKey?: string | null;
		/** The outcome, the seats and the day; off where the row already says them. */
		head?: boolean;
	} = $props();

	/** The key to ask: none while the decision as given is whole. */
	const asked = $derived.by(() => {
		if (!decision) return decisionKey;
		return hasSides(decision) ? null : decision.key;
	});
	const full = load(
		() => asked,
		(key) => (key ? getDecision(key) : Promise.resolve(null)),
		'Stemming per fractie'
	);
	const shown = $derived((full.state.status === 'ready' ? full.state.data : null) ?? decision);
	const line = $derived(shown ? voteLineOf(shown) : null);
</script>

{#if line}
	<div class="vote-line">
		{#if head}
			<p class="outcome">
				<Uitkomst tone={line.tone} woord={line.word} />{#if line.date}<span
						>&nbsp;op <BronLink ref={{ collection: 'decisions', key: line.decision }}
							>{langeDatum(line.date)}</BronLink
						></span
					>{/if}{#if line.how}<span>, {line.how}</span>{/if}
			</p>
		{/if}
		{#each line.sides as side (side.choice)}
			{#if side.names.length}
				<p class="side">
					<span class="choice"><Stem keuze={side.choice} /></span>
					<span>{side.names.join(', ')}</span>
				</p>
			{/if}
		{/each}
	</div>
{/if}
{#if full.state.status === 'error'}
	<LoadState state={full.state} what="De stemming per fractie" retry={full.retry} />
{/if}

<style>
	.vote-line {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.outcome {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.outcome :global(a) {
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
	}
	.outcome :global(a:hover) {
		color: var(--ink);
		border-bottom-color: currentColor;
	}
	/* Voor and Tegen in the margin column, the fracties at the text edge, wrapping there. */
	.side {
		display: grid;
		grid-template-columns: minmax(var(--reader-term, var(--s-8)), max-content) minmax(0, 1fr);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.choice {
		padding-right: var(--s-2);
		color: var(--ink);
	}
</style>
