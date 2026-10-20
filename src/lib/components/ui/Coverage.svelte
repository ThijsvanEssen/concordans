<script lang="ts">
	// The one mark for what the dataset lacks of a bron (besluit 23): one quiet line, grey and
	// italic, never red, with the source that has it one step further. Its words come from
	// coverage.ts; no reader writes its own.
	import { coverageLine, type CoverageState } from './coverage';

	let {
		coverage,
		bron = null
	}: {
		coverage: CoverageState;
		/** The source that holds what is missing here: wetten.overheid.nl, EUR-Lex. */
		bron?: { label: string; href: string } | null;
	} = $props();
</script>

<span class="dekking"
	>{coverageLine(coverage)}{#if bron}, <a href={bron.href} target="_blank" rel="noopener"
			>{bron.label} ↗</a
		>{/if}</span
>

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
