<script lang="ts">
	// The box of a choice that is on or off, the same everywhere (Thijs, 10 Oct: "checkboxes
	// zijn een beetje out-of-balance"): 12 px, the radius of a control, the tick drawn, not a
	// glyph of the font, so it stands in the middle whatever the letter around it.
	let { aan = false, gedimd = false }: { aan?: boolean; gedimd?: boolean } = $props();
</script>

<span class="vinkje" class:aan class:gedimd aria-hidden="true"
	>{#if aan}<svg viewBox="0 0 12 12" width="12" height="12" focusable="false"
			><path d="M3.1 6.3 5.2 8.4 8.9 4" /></svg
		>{/if}</span
>

<style>
	.vinkje {
		display: inline-grid;
		place-items: center;
		flex: none;
		box-sizing: border-box;
		width: var(--s-3);
		height: var(--s-3);
		/* The frame as an inset line, so the tick's 12 px fill the box exactly. */
		box-shadow: inset 0 0 0 1px var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		color: var(--paper);
	}
	.aan {
		box-shadow: none;
		background: var(--ink);
	}
	.gedimd {
		box-shadow: none;
		background: var(--rule-strong);
	}
	svg {
		display: block;
		width: var(--s-3);
		height: var(--s-3);
	}
	path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
