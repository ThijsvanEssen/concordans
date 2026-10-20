<script lang="ts">
	// A text with tables in it, read as blocks: its paragraphs as CitedText, each table as
	// TextTable with CitedText in its cells. One component for every text but an article's
	// (ArticleText): a paragraph of a judgment, an alinea of a Kamerstuk, in their readers and
	// read in place in a bundel. The reader sets the box around it: its margin, its letter.
	import CitedText from './CitedText.svelte';
	import TextTable from './TextTable.svelte';
	import { blocksOf, type Table } from '$lib/text/tables';
	import { spansWithin } from '$lib/text/spans';
	import type { ComponentProps } from 'svelte';

	/** What CitedText marks in a text, offsets relative to it. */
	type Cited = ComponentProps<typeof CitedText>;
	type Marker = NonNullable<Cited['noten']>[number];

	let {
		text,
		tables,
		citations = [],
		notes = [],
		target = null,
		marked = null
	}: {
		text: string;
		/** The tables in `text`, offsets relative to it. */
		tables: readonly Table[];
		/** Offsets relative to `text`, as CitedText takes them. */
		citations?: NonNullable<Cited['citations']>;
		/** The footnote markers (CitedText `noten`). */
		notes?: Marker[];
		/** The bron whose citations are marked (CitedText `doel`). */
		target?: string | null;
		/** Words to mark (CitedText `bereik`). */
		marked?: Cited['bereik'];
	} = $props();

	const blocks = $derived(blocksOf(text, 0, text.length, tables));

	/** Each marker in the block it stands in; one between blocks at the end of the one before. */
	const markersOf = $derived.by(() => {
		const per = new Map<number, Marker[]>();
		for (const m of notes) {
			const at = m.at ?? text.length;
			const b = blocks.findLast((x) => x.start <= at) ?? blocks[0];
			if (!b) continue;
			per.set(b.start, [...(per.get(b.start) ?? []), { ...m, at: Math.min(at, b.end) }]);
		}
		return per;
	});

	/** What `text[start, end)` marks, offsets relative to `start`. */
	const marks = (start: number, end: number, markers: Marker[]) => ({
		citations: spansWithin(citations, start, end - start),
		notes: markers
			.filter((m) => m.at! >= start && m.at! <= end)
			.map((m) => ({ ...m, at: m.at! - start })),
		marked:
			marked && marked.end > start && marked.start < end
				? { start: Math.max(0, marked.start - start), end: Math.min(end, marked.end) - start }
				: null
	});
</script>

{#snippet words(start: number, end: number, markers: Marker[])}
	{@const m = marks(start, end, markers)}
	<CitedText
		text={text.slice(start, end)}
		citations={m.citations}
		noten={m.notes}
		doel={target}
		bereik={m.marked}
	/>
{/snippet}

{#each blocks as b (b.start)}
	{@const markers = markersOf.get(b.start) ?? []}
	{#if b.table}
		{#snippet cellText(start: number, end: number)}{@render words(start, end, markers)}{/snippet}
		<TextTable {text} table={b.table} cell={cellText} />
	{:else}
		<p>{@render words(b.start, b.end, markers)}</p>
	{/if}
{/each}

<style>
	p {
		margin: 0;
	}
</style>
