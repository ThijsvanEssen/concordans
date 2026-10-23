<script lang="ts">
	// The words of an alinea of a Kamerstuk, as its reader and a bundel set them: one component
	// so that a question and its answer look alike wherever they are read. A question (numbered,
	// its number in the margin) stands in italics, its answer under it with the label the source
	// gives it (`Antwoord`) run in at its head.
	import type { Snippet } from 'svelte';

	let {
		answerLabel = null,
		question = false,
		children
	}: {
		/** The label of an answer the source prints on a line before it. */
		answerLabel?: string | null;
		/** Whether the alinea is a question. */
		question?: boolean;
		children: Snippet;
	} = $props();
</script>

<p class:question>
	{#if answerLabel}<span class="answer-label">{answerLabel}</span>{/if}{@render children()}
</p>

<style>
	p {
		margin: 0;
	}
	.question {
		font-style: italic;
	}
	.answer-label {
		margin-right: var(--s-2);
		color: var(--ink-3);
		font-style: normal;
	}
</style>
