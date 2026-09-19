<script lang="ts">
	// Scroll container and load/empty/error states shared by the text readers
	// (Article, Judgment). explore/+page.svelte sizes `.reader-frame` per mode.
	import type { Snippet } from 'svelte';

	let {
		status,
		message = '',
		children
	}: {
		status: 'empty' | 'loading' | 'error' | 'ready';
		message?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="reader-frame">
	{#if status === 'empty'}
		<div class="reader-empty">
			<p>Selecteer een artikel, arrest of parlementaire bron om de inhoud hier te lezen.</p>
		</div>
	{:else if status === 'loading'}
		<div class="reader-loading">
			<div class="skeleton-h"></div>
			<div class="skeleton-body"></div>
			<div class="skeleton-body skeleton-body--short"></div>
		</div>
	{:else if status === 'error'}
		<div class="reader-error">{message}</div>
	{:else}
		{@render children?.()}
	{/if}
</div>

<style>
	.reader-frame {
		height: 100%;
		overflow-y: auto;
		padding: var(--s-6) var(--s-6) var(--s-8);
		box-sizing: border-box;
	}

	.reader-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 17px;
		color: var(--fg-3);
		text-align: center;
		padding: var(--s-6);
	}

	.reader-error {
		padding: var(--s-5);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--accent);
	}

	.reader-loading {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-5) 0;
	}

	.skeleton-h,
	.skeleton-body {
		border-radius: var(--r-1);
		background: linear-gradient(90deg, var(--paper-2) 25%, var(--paper-3) 50%, var(--paper-2) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.4s infinite;
	}

	.skeleton-h {
		height: 32px;
		width: 60%;
	}

	.skeleton-body {
		height: 14px;
	}

	.skeleton-body--short {
		width: 70%;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
</style>
