<script lang="ts">
	// Running head of the text readers: sigil + kind label, then the title.
	// Reader-specific rows (citation, meta, in-flux count) go in the snippet.
	import type { Snippet } from 'svelte';

	let {
		sigil,
		tone,
		kind,
		juris,
		title,
		children
	}: {
		sigil: string;
		tone: 'article' | 'judgment';
		kind: string;
		juris?: string | null;
		title: string;
		children?: Snippet;
	} = $props();
</script>

<div class="reader-head">
	<div class="reader-kind">
		<span class="reader-sigil" class:reader-sigil--judgment={tone === 'judgment'} aria-hidden="true"
			>{sigil}</span
		>
		<span>{kind}</span>
		{#if juris}<span class="reader-juris">· {juris}</span>{/if}
	</div>
	<h2 class="reader-title">{title}</h2>
	{@render children?.()}
</div>

<style>
	.reader-head {
		margin-bottom: var(--s-6);
	}

	.reader-kind {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin-bottom: 18px;
	}

	.reader-sigil {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 18px;
		color: var(--accent);
		letter-spacing: 0;
		text-transform: none;
	}

	.reader-sigil--judgment {
		color: var(--indigo);
	}

	.reader-juris {
		color: var(--fg-4);
		text-transform: none;
		letter-spacing: 0;
	}

	.reader-title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 26px;
		line-height: 1.2;
		letter-spacing: -0.01em;
		margin: 0 0 8px;
		color: var(--ink);
		text-wrap: pretty;
	}
</style>
