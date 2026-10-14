<script lang="ts">
	// A framed list of key and value on a text page (/bronnen, /docs, /docs/methode), one row
	// per KeyRow: the keys in a column on the left, on a phone above their value. A value
	// breaks where it must (an address on /docs), never wider than its row.
	import type { Snippet } from 'svelte';

	let {
		columns = 1,
		children
	}: {
		/** Two: short rows side by side (the kinds of verbindingen), one column on a phone. */
		columns?: 1 | 2;
		children: Snippet;
	} = $props();
</script>

<div class="key-list" class:two={columns === 2}>
	{@render children()}
</div>

<style>
	.key-list {
		margin-bottom: var(--s-3);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
	}
	.key-list > :global(.key-row + .key-row) {
		border-top: 1px solid var(--rule);
	}
	.two {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.two > :global(.key-row:nth-child(2n)) {
		border-left: 1px solid var(--rule);
	}
	.two > :global(.key-row:nth-child(2)) {
		border-top: 0;
	}
	@media (max-width: 560px) {
		.two {
			grid-template-columns: minmax(0, 1fr);
		}
		.two > :global(.key-row:nth-child(2n)) {
			border-left: 0;
		}
		.two > :global(.key-row:nth-child(2)) {
			border-top: 1px solid var(--rule);
		}
	}
</style>
