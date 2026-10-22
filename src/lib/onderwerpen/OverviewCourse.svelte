<script lang="ts">
	// The Verloop of a topic: its events in the Kruiswoord, with the switches over it (the
	// strekking as a layer, per week) and a line for what was not counted in full.
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import KeuzeKnoppen from '$lib/components/ui/Keuze.svelte';
	import Kruiswoord from './Kruiswoord.svelte';
	import StrekkingTeken from './StrekkingTeken.svelte';
	import { LAAG_LABEL, STREKKING_LAGEN, type StrekkingLaag } from './strekking';
	import type { ComponentProps } from 'svelte';

	let {
		layer,
		notes,
		onLayer,
		onWeek,
		grid
	}: {
		/** The strekking chosen: every number counts only the moties so read. */
		layer: StrekkingLaag | null;
		/** What was not counted in full, or a coding file without a coding: one line each. */
		notes: string[];
		onLayer: (layer: StrekkingLaag | null) => void;
		onWeek: () => void;
		grid: ComponentProps<typeof Kruiswoord>;
	} = $props();
</script>

<section class="sectie" aria-labelledby="t-verloop">
	<div class="sectie__kop">
		<h2 id="t-verloop">Verloop</h2>
		<span class="schakels">
			<!-- The strekking as a layer: one chosen, every number counts its moties. -->
			<span class="as">
				<span class="as__label" aria-hidden="true">Strekking</span>
				<KeuzeKnoppen
					klein
					label="Strekking"
					opties={[
						{ waarde: 'alle', label: 'Alle' },
						...STREKKING_LAGEN.map((r) => ({ waarde: r, label: LAAG_LABEL[r] }))
					]}
					waarde={layer ?? 'alle'}
					onSelect={(w) => onLayer(w === 'alle' ? null : (w as StrekkingLaag))}
				>
					{#snippet voor(w)}{#if w !== 'alle'}<StrekkingTeken
								strekking={w as StrekkingLaag}
							/>{/if}{/snippet}
				</KeuzeKnoppen>
			</span>
			<FilterOptie inline label="Per week" on={!!grid.week} onToggle={onWeek} />
		</span>
	</div>
	{#if notes.length}
		<p class="sectie__regel">
			{#each notes as note (note)}<span>{note}</span>{/each}
		</p>
	{/if}
	<Kruiswoord {...grid} />
</section>

<style>
	.sectie h2 {
		margin: 0 0 var(--s-2);
		font-size: var(--t-h3);
		font-weight: 600;
		color: var(--ink);
	}
	/* A state line under a heading, with its quiet actions (rung 6). */
	.sectie__regel {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-1) var(--s-4);
		margin: 0 0 var(--s-2);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The section's head: its title at the left, its two switches at the right. */
	.sectie__kop {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-1) var(--s-4);
		padding-top: var(--s-3);
		border-top: 2px solid var(--ink);
	}
	.sectie__kop h2 {
		margin: 0 0 var(--s-2);
	}
	.schakels {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
	}
	/* An axis as a choice: its name before it, over it on a phone. */
	.as {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
	}
	.as__label {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	@media (max-width: 640px) {
		/* The Strekking on a phone: its name over it, its options in words only and a step
		   closer, so the five fit the width. */
		.as {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--s-1);
		}
		.as :global(.st) {
			display: none;
		}
		.as :global(.keuze button) {
			padding: 0 var(--s-1);
			white-space: nowrap;
		}
	}
</style>
