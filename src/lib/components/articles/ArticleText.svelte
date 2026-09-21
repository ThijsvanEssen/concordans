<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import CitedText from './CitedText.svelte';
	import { citationsWithin } from './citations';

	let {
		text,
		citations = [],
		onNavigate
	}: {
		text: string | null | undefined;
		citations?: Schema<'ArticleCitationSpan'>[];
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	// The API separates the paragraphs (leden) of an article by a line break and
	// gives citation offsets in the whole text.
	const lines = $derived.by(() => {
		let start = 0;
		return (text ?? '').split('\n').flatMap((line) => {
			const from = start;
			start += line.length + 1;
			if (!line.trim()) return [];
			return [{ text: line, citations: citationsWithin(citations, from, line.length) }];
		});
	});
</script>

{#if lines.length === 0}
	<p class="article-text__empty">Geen tekst beschikbaar voor dit artikel.</p>
{:else}
	<div class="article-text">
		{#each lines as line, i (i)}
			<p><CitedText text={line.text} citations={line.citations} {onNavigate} /></p>
		{/each}
	</div>
{/if}

<style>
	.article-text {
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.62;
		color: var(--ink);
		max-width: 60ch;
	}

	.article-text p {
		margin: 0 0 1.25em;
	}

	.article-text p:last-child {
		margin-bottom: 0;
	}

	.article-text__empty {
		font-style: italic;
		color: var(--muted);
		font-family: var(--font-serif);
		font-size: var(--text-lg);
	}
</style>
