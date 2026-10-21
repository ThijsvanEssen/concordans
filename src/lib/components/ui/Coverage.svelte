<script lang="ts">
	// The one mark for what the dataset lacks of a bron (besluit 23): one quiet line, grey and
	// italic, never red, with the source that has it one step further. Its words come from
	// coverage.ts; no reader writes its own. Nothing known to lack, no line.
	import {
		anchorLine,
		coverageLine,
		searchedLine,
		type AnchorState,
		type Completeness,
		type Searched
	} from '$lib/text/coverage';

	let {
		coverage = null,
		searched = null,
		of,
		noText = false,
		bron = null,
		anchor = null
	}: {
		/** The API's `completeness` of a record or a source. */
		coverage?: Completeness | null;
		/** What a search of one type reads (`searched.<type>`), in place of `coverage`. */
		searched?: Searched | null;
		/** The source a line about a source is of: `HUDOC`. */
		of?: string;
		/** The reader shows no text here: say why, or that the dataset lacks it. */
		noText?: boolean;
		/** The source that holds what is missing here: wetten.overheid.nl, EUR-Lex. */
		bron?: { label: string; href: string } | null;
		/** An arcering whose words no longer stand where they were kept, in place of the rest. */
		anchor?: AnchorState | null;
	} = $props();

	const line = $derived(
		anchor
			? anchorLine(anchor)
			: searched
				? searchedLine(searched)
				: coverageLine(coverage, { of, noText })
	);
</script>

{#if line}<span class="dekking"
		>{line}{#if bron}, <a href={bron.href} target="_blank" rel="noopener">{bron.label} ↗</a
			>{/if}</span
	>{/if}

<style>
	.dekking {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-style: italic;
		color: var(--ink-3);
	}
	.dekking a {
		font-style: normal;
	}
</style>
