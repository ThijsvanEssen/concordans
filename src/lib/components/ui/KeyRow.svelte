<script lang="ts">
	// One row of a KeyList: its key, where it has one, and its value.
	import type { Snippet } from 'svelte';

	let { key, children }: { key?: string; children: Snippet } = $props();
</script>

<div class="key-row">
	{#if key}<span class="key">{key}</span>{/if}<span class="value">{@render children()}</span>
</div>

<style>
	.key-row {
		display: flex;
		gap: var(--s-4);
		padding: var(--s-2) var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.key {
		flex: none;
		width: 10em;
		color: var(--ink-3);
	}
	.value {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	/* A phone: the key above its value, not in a narrow column beside it. */
	@media (max-width: 560px) {
		.key-row {
			flex-direction: column;
			gap: var(--s-1);
		}
		.key {
			width: auto;
		}
	}
</style>
