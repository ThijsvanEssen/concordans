<script lang="ts">
	// De as van elke horizontale tijdweergave. Een lijn van 1px, het begin en het eind altijd
	// (een lopende periode eindigt op "nu"), daartussen de streepjes die passen. Boven een
	// figuur met rijen, onder een figuur van één rij. De fasen erboven (Fasen), alleen boven.
	import Fasen from './Fasen.svelte';
	import { labelBreedte, streepjes, type Periode } from './tijdas';

	let {
		periode,
		begin,
		eind,
		plaats,
		fasen = [],
		lijnen = false
	}: {
		periode: Periode;
		begin: string;
		eind: string;
		plaats: 'boven' | 'onder';
		fasen?: { at: number; label: string }[];
		/** Streepjes als lijnen door de figuur erboven (kabinetten): de hoogte geeft de ouder. */
		lijnen?: boolean;
	} = $props();

	let breedte = $state(0);
	// Een streepje blijft een half label plus lucht weg van de randen.
	const ticks = $derived(
		breedte
			? streepjes(periode, breedte, {
					begin: labelBreedte(begin) + 24,
					eind: labelBreedte(eind) + 24
				})
			: []
	);
</script>

<div class="tijdas">
	{#if plaats === 'boven' && fasen.length}<Fasen {fasen} />{/if}
	<div class="as as--{plaats}" bind:clientWidth={breedte}>
		<span class="rand rand--begin">{begin}</span>
		{#each ticks as t (t.at)}
			<span class="tick" style:left="{t.at * 100}%">{t.label}</span>
			{#if lijnen}<span class="lijn" style:left="{t.at * 100}%" aria-hidden="true"></span>{/if}
		{/each}
		<span class="rand rand--eind">{eind}</span>
	</div>
</div>

<style>
	.tijdas {
		min-width: 0;
	}
	.as {
		position: relative;
		height: var(--s-6);
		font-family: var(--font-serif);
		font-size: var(--t-label); /* a chart's own labels, below the ladder: docs/typografie.md */
		line-height: var(--s-4);
		color: var(--ink-3);
	}
	.as--boven {
		border-bottom: 1px solid var(--rule-strong);
	}
	.as--onder {
		border-top: 1px solid var(--rule-strong);
	}
	.tick,
	.rand {
		position: absolute;
		white-space: nowrap;
	}
	.as--boven .tick,
	.as--boven .rand {
		bottom: var(--s-1);
	}
	.as--onder .tick,
	.as--onder .rand {
		top: var(--s-1);
	}
	.tick {
		transform: translateX(-50%);
	}
	.rand--begin {
		left: 0;
	}
	.rand--eind {
		right: 0;
	}
	.lijn {
		position: absolute;
		bottom: 100%;
		height: var(--lijnen, 0);
		border-left: 1px solid var(--rule);
	}
</style>
