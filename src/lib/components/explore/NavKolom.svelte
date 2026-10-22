<script lang="ts">
	// The navigation column beside a reader, one form for the three that stood apart
	// (LezenNav for a law, DocumentToc for a stuk, JudgmentToc for a uitspraak; audit
	// 23-opruimen): a `nav` called Inhoud, the paper-2 column with its caption and the rows,
	// notes and lists of what it holds (`nav-kolom__rij`, `__note`, `__lijst`). No counts or
	// meta in it; each adds only the steps of its own hierarchy (toc-niveaus.ts).
	import type { Snippet } from 'svelte';

	let {
		title = null,
		titleHref = null,
		el = $bindable(null),
		children
	}: {
		/** The name of the whole, only where it leads somewhere: the law, from one of its articles. */
		title?: string | null;
		titleHref?: string | null;
		/** The column itself, for a reader that scrolls it to the bron chosen. */
		el?: HTMLElement | null;
		children: Snippet;
	} = $props();
</script>

<nav class="nav-kolom" aria-label="Inhoud" bind:this={el}>
	<header class="kop">
		<div class="onder nav-kolom__label" aria-hidden="true">Inhoud</div>
		{#if title && titleHref}<h3 class="titel">
				<a href={titleHref} data-sveltekit-noscroll>{title}</a>
			</h3>{/if}
	</header>
	{@render children()}
</nav>

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
		margin: var(--s-1) 0 0;
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
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* A note where the rows would be, its own or LoadState's (loading, a failure). */
	.nav-kolom > :global(.stil),
	:global(.nav-kolom__note) {
		margin: 0;
		padding: var(--s-4);
		font-size: inherit;
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
	/* The place the text stands at, in the lists that follow the scroll (DocumentToc, JudgmentToc). */
	:global(.nav-kolom__rij.is-active) {
		background: var(--paper);
		color: var(--ink);
		box-shadow: inset 2px 0 0 var(--ink);
	}
	/* A finger's target in the column and the sheet Inhoud: a row at least 32 px high. */
	@media (pointer: coarse), (max-width: 768px) {
		:global(.nav-kolom__rij) {
			display: flex;
			align-items: center;
			min-height: var(--s-6);
		}
	}
</style>
