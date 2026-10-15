<script lang="ts">
	// The navigation column beside a reader, one form for the three that stood apart
	// (LezenNav for a law, DocumentToc for a stuk, JudgmentToc for a uitspraak; audit
	// 23-opruimen): the paper-2 column, its head (the name of the bron, a line under it), and
	// the rows, notes and lists of what it holds (`nav-kolom__rij`, `__note`, `__lijst`). Each
	// adds only the steps of its own hierarchy.
	import type { Snippet } from 'svelte';

	let {
		label,
		title,
		titleHref = null,
		onder = null,
		el = $bindable(null),
		children
	}: {
		/** What the column is, for a screen reader: `Overzicht`, `Inhoud`. */
		label: string;
		title: string | null;
		/** Where the name leads: the whole law, from one of its articles. */
		titleHref?: string | null;
		/** The line under the name: `128 artikelen`, the kind of a stuk. */
		onder?: string | null;
		/** The column itself, for a reader that scrolls it to the bron chosen. */
		el?: HTMLElement | null;
		children: Snippet;
	} = $props();
</script>

<aside class="nav-kolom" aria-label={label} bind:this={el}>
	<header class="kop">
		{#if title}<h3 class="titel">
				{#if titleHref}<a href={titleHref} data-sveltekit-noscroll>{title}</a>{:else}{title}{/if}
			</h3>{/if}
		{#if onder}<div class="onder">{onder}</div>{/if}
	</header>
	{@render children()}
</aside>

<style>
	.nav-kolom {
		height: 100%;
		overflow-y: auto;
		padding-top: var(--s-5);
		background: var(--paper-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
	}
	.kop {
		padding: 0 var(--s-4) var(--s-3);
	}
	.titel {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		line-height: 1.2;
		color: var(--ink);
	}
	.titel a {
		color: inherit;
		text-decoration: none;
	}
	.titel a:hover {
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.onder {
		margin-top: var(--s-1);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	:global(.nav-kolom__note) {
		margin: 0;
		padding: var(--s-4);
		color: var(--ink-3);
	}
	:global(.nav-kolom__lijst) {
		list-style: none;
		margin: 0;
		padding: 0 0 var(--s-5);
	}
	:global(.nav-kolom__rij) {
		display: block;
		width: 100%;
		padding: var(--s-1) var(--s-4);
		border: 0;
		background: none;
		text-align: left;
		color: var(--ink-2);
		line-height: 1.3;
		cursor: pointer;
		text-decoration: none;
	}
	:global(.nav-kolom__rij:hover) {
		background: var(--paper);
		color: var(--ink);
	}
</style>
