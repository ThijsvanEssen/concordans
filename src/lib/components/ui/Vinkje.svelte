<script lang="ts">
	// The mark of a choice that is on or off, the same everywhere: only the tick, in a column of
	// a fixed width so the names beside it stay aligned. Off leaves the column empty. Drawn, not
	// a glyph of the font, so it stands in the middle whatever the letter around it. Decorative:
	// the row around it carries the role and the state.
	let { aan = false, gedimd = false }: { aan?: boolean; gedimd?: boolean } = $props();
</script>

<span class="vinkje" class:is-active={aan} class:is-dim={gedimd} aria-hidden="true"
	>{#if aan}<svg viewBox="0 0 14 14" width="14" height="14" focusable="false"
			><path d="M2.6 7.4 5.7 10.4 11.4 3.8" /></svg
		>{/if}</span
>

<style>
	.vinkje {
		display: inline-grid;
		place-items: center;
		flex: none;
		box-sizing: border-box;
		width: var(--vink);
		height: var(--vink);
		color: var(--ink);
	}
	.is-dim {
		color: var(--ink-3);
	}
	svg {
		display: block;
		width: var(--vink);
		height: var(--vink);
	}
	path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
