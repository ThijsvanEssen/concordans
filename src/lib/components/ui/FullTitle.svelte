<script lang="ts">
	// The full title of a bron where it is longer than its name, folded under the title: a
	// dossier's bill, a law's official title (Wet van 8 juli 2026, houdende …). One form on
	// every page that has one (Thijs, 23 Oct, A190), and for what else the head folds: a
	// regulation's aanhef (studie-aanhef, variant B), with its own label and content.
	import type { Snippet } from 'svelte';

	let {
		title = '',
		label = 'Volledige titel',
		open = $bindable(false),
		children
	}: { title?: string; label?: string; open?: boolean; children?: Snippet } = $props();
</script>

<details class="full-title" bind:open>
	<summary class="raakvlak">{label}</summary>
	{#if children}{@render children()}{:else}<p>{title}</p>{/if}
</details>

<style>
	.full-title summary {
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink-2);
		cursor: pointer;
	}
	/* A finger's target on a touch screen. */
	@media (pointer: coarse), (max-width: 768px) {
		.full-title summary {
			line-height: var(--veld-h-raak);
		}
	}
	.full-title p {
		margin: var(--s-1) 0 0;
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
</style>
