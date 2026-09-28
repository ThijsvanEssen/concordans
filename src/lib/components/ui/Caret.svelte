<script lang="ts">
	// The mark of a control that opens a menu or a section: a chevron drawn in the text's
	// colour, pointing down, turned up while open. One mark for every dropdown, so they
	// read alike. `side` points it right, for a section that unfolds below its head.
	let { open = false, side = false }: { open?: boolean; side?: boolean } = $props();
</script>

<svg
	class="caret"
	class:is-open={open}
	class:is-side={side}
	viewBox="0 0 10 10"
	width="10"
	height="10"
	aria-hidden="true"
	focusable="false"><path d="M2 3.75 5 6.75 8 3.75" /></svg
>

<style>
	.caret {
		flex: none;
		margin-left: var(--s-1);
		vertical-align: -1px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
		opacity: 0.6;
		transition: transform var(--dur-1) var(--ease);
	}
	.caret.is-side {
		transform: rotate(-90deg);
	}
	.caret.is-open {
		transform: rotate(180deg);
	}
	.caret.is-side.is-open {
		transform: rotate(0deg);
	}
</style>
