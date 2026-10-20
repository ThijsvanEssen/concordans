<script lang="ts">
	// A table in a text, as the source lays it out: its header, its rows, a cell that spans
	// rows or columns. The one place a table of a text is laid out (gelijke pagina's): every
	// reader of a text with tables renders them here and gives the text of a cell (`cell`).
	import type { Snippet } from 'svelte';
	import { rowsOf, type Table, type TableCell } from '$lib/text/tables';

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

<!-- A wide table pans in its own box on a phone, not the page. -->
<div class="text-table" data-zijscroll>
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
		margin: var(--s-2) 0;
	}
	/* The column's width, its cells wrapping; a table that will not fit at a word a column
	   pans. A step smaller than the text, as a table in print. */
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: inherit;
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
	/* In a narrow column (a phone, beside the network) a long word breaks at its syllables
	   rather than the table panning. */
	@container (max-width: 579px) {
		table {
			hyphens: auto;
		}
		th,
		td {
			padding: var(--s-1) var(--s-2);
		}
	}
</style>
