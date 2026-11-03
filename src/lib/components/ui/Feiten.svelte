<script lang="ts">
	// The facts of a bron as a list of label and value: the labels on one edge, the values on
	// another. Each row is a Veld, which drops out when its value is missing.
	import type { Snippet } from 'svelte';

	let {
		small = false,
		strip = false,
		rows = false,
		label,
		children
	}: {
		/** Labels as wide as their text and values in the sans, for a short list. */
		small?: boolean;
		/** The facts under a head (ReaderHead `kenmerken`): each label over its value, the cells
		 * side by side with a hairline between them; on a phone the short list of `small`. */
		strip?: boolean;
		/** A row per fact, the label at the left and the value at the right, on a phone too: a
		 * narrow column (Zijpaneel). */
		rows?: boolean;
		/** What the list is, for a screen reader: `Kenmerken`. */
		label?: string;
		children: Snippet;
	} = $props();
</script>

{#if strip}
	<!-- The strip clips at the column's edge the hairline before the first cell of each line. -->
	<div class="strip-edge">
		<dl class="feiten strip" aria-label={label}>
			{@render children()}
		</dl>
	</div>
{:else}
	<dl class="feiten" class:small class:rows aria-label={label}>
		{@render children()}
	</dl>
{/if}

<style>
	.feiten {
		display: grid;
		grid-template-columns: 10em minmax(0, 1fr);
		gap: var(--s-2) var(--s-4);
		margin: 0;
	}
	.feiten :global(dt) {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.feiten :global(dd) {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.small {
		grid-template-columns: max-content minmax(0, 1fr);
		line-height: var(--lh-snug);
	}
	.small :global(dd) {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		overflow-wrap: anywhere;
	}
	.rows {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: baseline;
		gap: var(--s-1) var(--s-3);
		line-height: var(--lh-snug);
	}
	.rows :global(dd) {
		font-size: var(--t-meta);
		text-align: right;
	}
	/* On a phone a long label (a function) would take the column from its value: label over value. */
	@media (max-width: 640px) {
		.small {
			grid-template-columns: minmax(0, 1fr);
		}
		.small :global(.field + .field dt) {
			margin-top: var(--s-2);
		}
	}
	/* In the list a field is its label and its value, no box of its own. */
	.feiten :global(.field) {
		display: contents;
	}

	/* The strip: a cell a field, its label over its value, a hairline before every cell; the
	   cells wrap on a narrow column, and the frame clips the hairline and the step before the
	   first cell of each line, so every line starts at the column's edge. */
	.strip-edge {
		overflow-x: clip;
	}
	.strip {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3) 0;
		margin-left: calc(-1 * var(--s-4) - 1px);
		line-height: var(--lh-snug);
	}
	.strip :global(.field) {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: var(--s-1);
		padding: 0 var(--s-4);
		border-left: 1px solid var(--rule);
	}
	.strip :global(dt) {
		font-size: var(--t-micro);
	}
	.strip :global(dd) {
		white-space: nowrap;
	}
	/* On a phone the short list: the labels on one edge, the values on another. */
	@media (max-width: 640px) {
		.strip-edge {
			overflow-x: visible;
		}
		.strip {
			display: grid;
			grid-template-columns: max-content minmax(0, 1fr);
			align-items: baseline;
			gap: var(--s-2) var(--s-4);
			margin-left: 0;
		}
		.strip :global(.field) {
			display: contents;
		}
		.strip :global(dd) {
			white-space: normal;
		}
	}
</style>
