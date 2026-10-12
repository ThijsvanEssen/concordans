<script lang="ts">
	// De namen van de fasen van een kabinet (demissionair en verder) boven een horizontale
	// tijdweergave: elk aan een stippellijn in `rule-strong`, de naam op 600 in `ink-2`. Botst
	// een naam met de vorige, dan gaat hij een regel lager; aan de rechterrand staat hij naar
	// binnen. De lijnen door de figuur zelf trekt de figuur.
	import { faseRegels } from './tijdas';

	let { fasen }: { fasen: { at: number; label: string }[] } = $props();

	let breedte = $state(0);
	const regels = $derived(breedte ? faseRegels(fasen, breedte) : []);
</script>

<div
	class="fasen"
	aria-hidden="true"
	bind:clientWidth={breedte}
	style:--regels={Math.max(1, ...regels.map((f) => f.regel + 1))}
>
	{#each regels as f (f.at)}<span
			class="fase"
			class:fase--binnen={f.binnen}
			style:left="{f.at * 100}%"
			style:top="calc({f.regel} * var(--s-4))">{f.label}</span
		>{/each}
</div>

<style>
	.fasen {
		position: relative;
		height: calc(var(--regels, 1) * var(--s-4));
		font-family: var(--font-serif);
		font-size: var(--t-label); /* a chart's own labels, below the ladder: docs/typografie.md */
		line-height: var(--s-4);
		font-weight: 600;
		color: var(--ink-2); /* the word that decides, as in a meta line (docs/typografie.md) */
	}
	.fase {
		position: absolute;
		padding-left: var(--s-1);
		border-left: 1px dotted var(--rule-strong);
		white-space: nowrap;
	}
	.fase--binnen {
		transform: translateX(-100%);
		padding-right: var(--s-1);
		border-right: 1px dotted var(--rule-strong);
		border-left: 0;
	}
</style>
