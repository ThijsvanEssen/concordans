<script lang="ts">
	// The navigation column beside a reader, one form for the three that stood apart
	// (LezenNav for a law, DocumentToc for a stuk, JudgmentToc for a uitspraak; audit
	// 23-opruimen): a `nav` called Inhoud, with its caption and the rows,
	// notes and lists of what it holds (`nav-kolom__rij`, `__note`, `__lijst`). No counts or
	// meta in it; each adds only the steps of its own hierarchy. Beside the text it is no column
	// of its own but a list that floats on the page (sticky, as the scroller it is), like "op
	// deze pagina": light type, no ground, no rule.
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
		/* The muted ink of the rows: ink-3 towards the paper. */
		--nav-stil: color-mix(in srgb, var(--ink-3) 75%, var(--paper));
		height: 100%;
		overflow-y: auto;
		padding-top: var(--s-5);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
	}
	.kop {
		padding: 0 var(--s-3) var(--s-2);
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
		padding: var(--s-3);
		font-size: inherit;
		color: var(--ink-3);
	}
	:global(.nav-kolom__lijst) {
		list-style: none;
		margin: 0;
		padding: 0 0 var(--s-5);
	}
	/* A row: small, muted, one line, no ground and no rule (A190, variant a, Thijs 23 Oct): the
	   contents stand back from the text; the place the text stands at is in ink, with a thin
	   line in ink at its left. A heading cut off keeps its whole as its title. */
	:global(.nav-kolom__rij) {
		display: block;
		width: 100%;
		padding: var(--s-1) var(--s-3);
		border: 0;
		background: none;
		text-align: left;
		color: var(--nav-stil);
		font-size: var(--t-micro);
		line-height: var(--lh-snug);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
		text-decoration: none;
	}
	:global(.nav-kolom__rij:hover) {
		color: var(--ink);
	}
	/* The place the text stands at, in the lists that follow the scroll (DocumentToc, JudgmentToc). */
	:global(.nav-kolom__rij.is-active) {
		color: var(--ink);
		box-shadow: inset 2px 0 0 var(--ink);
	}
	/* Every level in one size and one weight, muted; the depth is the indent, the first level
	   a step of white before it. The tables of contents give only the level. */
	:global(.nav-kolom__n1),
	:global(.nav-kolom__n2),
	:global(.nav-kolom__n3) {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--nav-stil);
	}
	:global(.nav-kolom__n4) {
		font-size: var(--t-micro);
		font-weight: 400;
		font-style: italic;
		color: var(--nav-stil);
	}
	/* A finger's target in the column and the sheet Inhoud: a row 44 px high. */
	@media (pointer: coarse), (max-width: 768px) {
		:global(.nav-kolom__rij) {
			display: flex;
			align-items: center;
			/* In the sheet Inhoud the whole heading, over its lines: no hover gives its title. */
			white-space: normal;
			min-height: var(--veld-h-raak);
			/* The 44 px is the row: a long heading adds its lines, no padding besides. */
			padding-block: 0;
		}
	}
</style>
