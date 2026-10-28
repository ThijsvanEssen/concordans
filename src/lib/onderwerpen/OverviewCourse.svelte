<script lang="ts">
	// The Verloop of a topic: its events in the Kruiswoord, with the switches over it (the
	// strekking as a layer, per week) and a line for what was not counted in full.
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import Choice from '$lib/components/ui/Keuze.svelte';
	import Section from '$lib/components/ui/Sectie.svelte';
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

<!-- The switches stand in the heading's line; on a phone they are too wide for it and stand
     under it, the same snippet in the other place. -->
{#snippet switches(cls: string)}
	<span class="switches {cls}">
		<!-- The strekking as a layer: one chosen, every number counts its moties. -->
		<span class="as">
			<span class="as__label" aria-hidden="true">Strekking</span>
			<Choice
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
			</Choice>
		</span>
		<FilterOptie inline label="Per week" on={!!grid.week} onToggle={onWeek} />
	</span>
{/snippet}

<Section title="Verloop" id="t-verloop" niveau={2} inklapbaar={false}>
	{#snippet naast()}{@render switches('switches--kop')}{/snippet}
	{@render switches('switches--onder')}
	{#if notes.length}
		<p class="regel">
			{#each notes as note (note)}<span>{note}</span>{/each}
		</p>
	{/if}
	<Kruiswoord {...grid} />
</Section>

<style>
	/* A state line under a heading, with its quiet actions (rung 6). */
	.regel {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-1) var(--s-4);
		margin: 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.switches {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
	}
	.switches--onder {
		display: none;
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
		.switches--kop {
			display: none;
		}
		.switches--onder {
			display: flex;
		}
		/* The Strekking on a phone: its name over it, its options in words only and a step
		   closer, so the five fit the width of the page. */
		.switches,
		.as {
			width: 100%;
		}
		.as {
			flex-direction: column;
			align-items: stretch;
			gap: var(--s-1);
		}
		.as :global(.st) {
			display: none;
		}
		/* The width of the page, in the desktop letter as Keuze vol: Niet beoordeeld on two
		   lines. */
		.as :global(.keuze) {
			display: flex;
		}
		.as :global(.keuze button) {
			flex: 1 1 auto;
			justify-content: center;
			padding: 0 var(--s-1);
			font-size: var(--t-ui);
			line-height: 1.15;
			text-align: center;
		}
	}
</style>
