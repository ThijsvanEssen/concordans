<script lang="ts">
	// The aanhef of a regulation, folded in its head (preamble.ts): the text of the regulation,
	// in the reader's type, its Gelet op links as in an article. On a line of its own at every
	// width, under the grondslag (live-toets C4: inline at 1440, its own line narrower).
	import CitedText from '$lib/components/articles/CitedText.svelte';
	import FullTitle from '$lib/components/ui/FullTitle.svelte';
	import { preambleParagraphs, preambleLabel, type Preamble } from '$lib/text/preamble';

	let {
		preamble,
		kind,
		open = $bindable(false)
	}: { preamble: Preamble; kind: string | null | undefined; open?: boolean } = $props();

	const paragraphs = $derived(preambleParagraphs(preamble));
</script>

<div class="fold">
	<FullTitle label={preambleLabel(kind)} bind:open>
		<div class="preamble" id="kop-aanhef">
			{#each paragraphs as a, i (i)}
				<p class:enacting={a.enacting}><CitedText text={a.text} citations={a.citations} /></p>
			{/each}
		</div>
	</FullTitle>
</div>

<style>
	.fold {
		flex-basis: 100%;
		min-width: 0;
	}
	.preamble {
		margin: var(--s-2) 0 0;
		padding-left: var(--s-4);
		border-left: 2px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.preamble p {
		margin: 0 0 var(--s-2);
		text-wrap: pretty;
	}
	.preamble p:last-child {
		margin-bottom: 0;
	}
	.enacting {
		font-style: italic;
		font-weight: 600;
	}
</style>
