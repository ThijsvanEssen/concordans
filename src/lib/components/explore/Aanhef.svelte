<script lang="ts">
	// The aanhef of a regulation, folded in its head (aanhef.ts): the text of the regulation,
	// in the reader's type, its Gelet op links as in an article.
	import CitedText from '$lib/components/articles/CitedText.svelte';
	import FullTitle from '$lib/components/ui/FullTitle.svelte';
	import { aanhefAlineas, aanhefLabel, type Preamble } from '$lib/text/aanhef';

	let {
		preamble,
		kind,
		open = $bindable(false)
	}: { preamble: Preamble; kind: string | null | undefined; open?: boolean } = $props();

	const alineas = $derived(aanhefAlineas(preamble));
</script>

<FullTitle label={aanhefLabel(kind)} bind:open>
	<div class="aanhef" id="kop-aanhef">
		{#each alineas as a, i (i)}
			<p class:besluit={a.besluit}><CitedText text={a.text} citations={a.citations} /></p>
		{/each}
	</div>
</FullTitle>

<style>
	.aanhef {
		margin: var(--s-2) 0 0;
		padding-left: var(--s-4);
		border-left: 2px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.aanhef p {
		margin: 0 0 var(--s-2);
		text-wrap: pretty;
	}
	.aanhef p:last-child {
		margin-bottom: 0;
	}
	.besluit {
		font-style: italic;
		font-weight: 600;
	}
</style>
