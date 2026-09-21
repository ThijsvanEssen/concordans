<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		active = false,
		onclick
	}: {
		children?: Snippet;
		active?: boolean;
		onclick?: (e: MouseEvent) => void;
	} = $props();
</script>

<button type="button" class="pill" class:pill--active={active} {onclick}>
	{@render children?.()}
</button>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
		font-size: var(--text-sm);
		font-family: var(--font-sans);
		font-weight: 500;
		border-radius: var(--radius-pill);
		padding: 0.3rem 0.85rem;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		color: var(--muted);
		cursor: pointer;
		transition:
			background 120ms,
			border-color 120ms,
			color 120ms;
		white-space: nowrap;
	}

	.pill:hover {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}

	.pill--active {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
