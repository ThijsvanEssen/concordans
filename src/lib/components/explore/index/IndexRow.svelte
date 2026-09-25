<script lang="ts">
	// One row of the index. The title is a link to the bron, so it opens in a new tab,
	// can be copied and is read as a link; the rest of the row opens its detail beneath
	// it. The toggle is a button under the row's content, the size of the row: a click
	// anywhere but the link reaches it, and it is what the keyboard stops on.
	import type { Snippet } from 'svelte';

	let {
		title,
		href,
		open,
		onToggle,
		bron,
		member = false,
		lead,
		body,
		aside,
		detail
	}: {
		title: string;
		/** Without a link the title is text, and the whole row is the toggle. */
		href?: string;
		open: boolean;
		onToggle: () => void;
		/** What the row stands for (`judgments/<key>`), to find it again in the list. */
		bron?: string;
		/** A dossier under its number, indented beneath it. */
		member?: boolean;
		lead?: Snippet;
		/** Under the title. */
		body?: Snippet;
		aside?: Snippet;
		detail?: Snippet;
	} = $props();

	const uid = $props.id();

	// A click on the link is the link's; a click after selecting text selects.
	function onRowClick(e: MouseEvent) {
		if ((e.target as Element).closest('a, button')) return;
		if (window.getSelection()?.toString()) return;
		onToggle();
	}
</script>

<li class="row-wrap" class:row-wrap--member={member} data-bron={bron}>
	<!-- The button below is the keyboard's way in; this only widens its target. -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="row" class:row--on={open} onclick={onRowClick}>
		<button
			type="button"
			class="row-toggle"
			aria-expanded={open}
			aria-controls={open && detail ? `${uid}-detail` : undefined}
			aria-label="Details van {title}"
			onclick={onToggle}
		></button>
		<div class="row-id">{@render lead?.()}</div>
		<div class="row-body">
			{#if href}
				<a class="row-title" {href}>{title}</a>
			{:else}
				<span class="row-title">{title}</span>
			{/if}
			{@render body?.()}
		</div>
		<div class="row-aside">{@render aside?.()}</div>
	</div>
	{#if open && detail}
		<div class="detail" id="{uid}-detail">{@render detail()}</div>
	{/if}
</li>

<style>
	.row-wrap {
		display: flex;
		flex-direction: column;
	}
	/* A row of a table: a hairline under each, the columns as the list sets them
	   (--row-lead, --row-aside), so the heads above the list stand over them. */
	.row {
		position: relative;
		display: grid;
		grid-template-columns: var(--row-lead, 120px) minmax(0, 1fr) var(--row-aside, 190px);
		gap: 20px;
		padding: 10px 8px;
		border-bottom: 1px solid var(--rule);
		cursor: pointer;
		align-items: baseline;
		transition: background var(--dur-1) var(--ease);
	}
	.row:hover,
	.row--on {
		background: var(--paper-2);
	}
	.row-toggle {
		position: absolute;
		inset: 0;
		padding: 0;
		border: 0;
		border-radius: inherit;
		background: transparent;
		cursor: pointer;
	}
	.row-toggle:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}
	/* The content lies over the toggle; a click on it is passed on by the row. */
	.row-id,
	.row-body,
	.row-aside {
		position: relative;
	}

	.row-id {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
		line-height: 1.4;
		padding-top: 3px;
	}
	.row-body {
		min-width: 0;
	}
	.row-title {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		line-height: var(--lh-snug);
		text-decoration: none;
		text-wrap: pretty;
		transition: color var(--dur-1) var(--ease);
		/* Two lines at most; the full title is in the inline detail. */
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	a.row-title:hover {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.row--on .row-title {
		color: var(--accent);
	}
	.row-aside {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		text-align: right;
		flex-wrap: wrap;
		padding-top: 2px;
	}

	/* Inline detail */
	.detail {
		background: var(--paper-2);
		border-bottom: 1px solid var(--rule);
		padding: 0 8px 0 calc(var(--row-lead, 120px) + 28px);
	}

	/* Dossiers under one number: the rows of the opened number stand indented beneath it. */
	.row-wrap--member .row {
		padding-left: 20px;
	}
	.row-wrap--member .row-id :global(.row-id-main)::before {
		content: '↳ ';
		color: var(--rule-strong);
	}

	/* Narrow viewports: the columns stack. */
	@media (max-width: 768px) {
		.row {
			grid-template-columns: 1fr;
			gap: 4px;
			padding: 14px 8px;
		}
		.row-aside {
			justify-content: flex-start;
			padding-top: 6px;
		}
		.detail {
			padding-left: 0;
		}
	}
</style>
