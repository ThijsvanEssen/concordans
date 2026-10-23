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

	/** A cell of at most this many characters is a label (a sector, a rate): it keeps its
	 *  words whole, so its column is as wide as its longest word; unless a word is longer
	 *  than WORD (the name of a substance), which breaks at its syllables before the table pans. */
	const SHORT = 32;
	const WORD = 16;
	/** A cell is a list when it starts with a dash; the API keeps the paragraphs of a cell in
	 *  one line, a line separator (U+2028) between them, or, as long as it does not, only a
	 *  space before the dash of the next item. */
	const ITEM = /\u2028|(?<=[^\s–]) (?=– \p{Lu})/gu;

	/** `text[start, end)` of a cell as its paragraphs, offsets into `text`. */
	function paragraphs(start: number, end: number): [number, number][] {
		const own = text.slice(start, end);
		const list = own.startsWith('– ') || own.includes('\u2028');
		if (!list) return [[start, end]];
		const parts: [number, number][] = [];
		let from = 0;
		for (const m of own.matchAll(ITEM)) {
			parts.push([start + from, start + m.index]);
			from = m.index + m[0].length;
		}
		parts.push([start + from, end]);
		return parts;
	}
	const short = (start: number, end: number) =>
		end - start <= SHORT &&
		text
			.slice(start, end)
			.split(/\s+/)
			.every((w) => w.length <= WORD);
	const head = $derived(rows.filter((r) => r.head));
	const body = $derived(rows.filter((r) => !r.head));
</script>

{#snippet body_cell(start: number, end: number)}
	{@const parts = paragraphs(start, end)}
	{#if parts.length === 1}{@render cell(start, end)}{:else}{#each parts as [a, b] (a)}{#if b > a}<p>
					{@render cell(a, b)}
				</p>{/if}{/each}{/if}
{/snippet}

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
					rowspan={c.rowspan > 1 ? c.rowspan : undefined}
					class:kort={short(c.start, c.end)}>{@render body_cell(c.start, c.end)}</td
				>
			{/if}
		{/each}
	</tr>
{/snippet}

<!-- A table its column cannot hold pans in its own box, not the page; the edge that hides
     more fades (use:sideScroll), and the box takes the keyboard. -->
<div class="text-table" data-zijscroll use:sideScroll={{ focus: true }}>
	<table style:--kolommen={table.columns}>
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
	/* A heading and a label do not break at a syllable. */
	th,
	td.kort {
		hyphens: none;
	}
	td p {
		margin: 0;
	}
	td p + p {
		margin-top: var(--s-2);
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
		/* Three columns or more do not squeeze into a phone: the table keeps a width per
		   column and pans in its own box. */
		table {
			min-width: calc(var(--kolommen, 1) * var(--s-8) * 2);
		}
	}
</style>
