<script lang="ts">
	// A table in a text, as the source lays it out: its header, its rows, a cell that spans
	// rows or columns. The one place a table of a text is laid out (gelijke pagina's): every
	// reader of a text with tables renders them here and gives the text of a cell (`cell`).
	import type { Snippet } from 'svelte';
	import { rowsOf, type Table, type TableCell } from '$lib/text/tables';
	import { sideScroll } from '$lib/actions/side-scroll';

	let {
		text,
		table,
		cell
	}: {
		/** The whole text the table's offsets are in. */
		text: string;
		table: Table;
		/** The text of a cell, `text[start, end)`, with what the reader marks in it. */
		cell: Snippet<[number, number]>;
	} = $props();

	const rows = $derived(rowsOf(text, table));
	const head = $derived(rows.filter((r) => r.head));
	const body = $derived(rows.filter((r) => !r.head));
</script>

{#snippet row(cells: TableCell[], th: boolean)}
	<tr>
		{#each cells as c (c.start)}
			{#if th}
				<th scope="col" colspan={c.colspan > 1 ? c.colspan : undefined}
					>{@render cell(c.start, c.end)}</th
				>
			{:else}
				<td
					colspan={c.colspan > 1 ? c.colspan : undefined}
					rowspan={c.rowspan > 1 ? c.rowspan : undefined}>{@render cell(c.start, c.end)}</td
				>
			{/if}
		{/each}
	</tr>
{/snippet}

<!-- A table its column cannot hold pans in its own box, not the page; the edge that hides
     more fades (use:sideScroll), and the box takes the keyboard. -->
<div class="text-table" data-zijscroll use:sideScroll={{ focus: true }}>
	<table>
		{#if head.length}
			<thead>
				{#each head as r (r.cells[0]?.start)}
					{@render row(r.cells, true)}
				{/each}
			</thead>
		{/if}
		<tbody>
			{#each body as r (r.cells[0]?.start)}
				{@render row(r.cells, false)}
			{/each}
		</tbody>
	</table>
</div>

<style>
	.text-table {
		max-width: 100%;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		margin: var(--s-2) 0;
	}
	/* The column's width, its cells wrapping: a long word (the name of a substance in a list
	   of the Opiumwet) breaks at its syllables before the table pans. A step smaller than the
	   text, as a table in print. */
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: inherit;
		hyphens: auto;
	}
	th,
	td {
		padding: var(--s-1) var(--s-3);
		border-bottom: 1px solid var(--rule);
		text-align: left;
		vertical-align: top;
	}
	th {
		font-weight: 600;
		border-bottom-color: var(--rule-strong);
	}
	/* In a narrow column (a phone, beside the network) the cells sit closer. */
	@container (max-width: 579px) {
		th,
		td {
			padding: var(--s-1) var(--s-2);
		}
	}
</style>
