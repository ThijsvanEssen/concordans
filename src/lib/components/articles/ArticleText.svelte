<script lang="ts">
	// The text of an article as its aanhef, leden and onderdelen. Every part has an
	// anchor, so a reference can point at it and the address can be shared.
	import { page } from '$app/state';
	import type { Schema } from '$lib/api/types';
	import { permalink } from '$lib/bron/anchor';
	import { parseArticleParts, partsFromApi, type ArticlePart } from '$lib/text/article-parts';
	import CitedText from './CitedText.svelte';
	import { citationsWithin } from './citations';

	let {
		text,
		parts: apiParts = null,
		citations = []
	}: {
		text: string | null | undefined;
		/** The parts the API delivers (0.5); without them they are read from the text. */
		parts?: Schema<'ArticlePartDTO'>[] | null;
		citations?: Schema<'ArticleCitationSpan'>[];
	} = $props();

	const source = $derived(text ?? '');
	const parts = $derived(apiParts?.length ? partsFromApi(apiParts) : parseArticleParts(source));

	const own = (part: ArticlePart) => {
		const raw = source.slice(part.textStart, part.textEnd);
		const lead = raw.length - raw.trimStart().length;
		const body = raw.trim();
		return {
			body,
			citations: citationsWithin(citations, part.textStart + lead, body.length)
		};
	};

	const copy = (id: string) => navigator.clipboard?.writeText(permalink(page.url, id));
</script>

{#snippet render(part: ArticlePart)}
	{@const { body, citations: spans } = own(part)}
	<div class="part part--{part.kind}" id={part.id}>
		{#if part.number && part.id}
			<a
				class="part__number"
				href="#{part.id}"
				aria-label="Kopieer link naar {part.kind} {part.number}"
				onclick={() => copy(part.id!)}>{part.number}{part.kind === 'lid' ? '.' : ''}</a
			>
		{/if}
		<div class="part__body">
			{#if body}<p><CitedText text={body} citations={spans} /></p>{/if}
			{#each part.children as child (child.start)}
				{@render render(child)}
			{/each}
		</div>
	</div>
{/snippet}

{#if parts.length === 0}
	<p class="article-text__empty">Geen tekst beschikbaar.</p>
{:else}
	<div class="article-text">
		{#each parts as part (part.start)}
			{@render render(part)}
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

	.part {
		display: flex;
		gap: 0.6em;
		margin: 0 0 0.9em;
		border-radius: 2px;
		scroll-margin: 20vh;
		transition: background var(--dur-2, 300ms) var(--ease);
	}

	.part--onderdeel,
	.part--tekst {
		margin-bottom: 0.4em;
	}

	.part:last-child {
		margin-bottom: 0;
	}

	.part :global(.part) {
		margin-top: 0.4em;
	}

	.part__number {
		flex: none;
		min-width: 1.6em;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
		text-decoration: none;
	}

	.part__number:hover {
		color: var(--accent);
	}

	.part__body {
		flex: 1;
		min-width: 0;
	}

	.part__body p {
		margin: 0;
	}

	.part:global(.is-landed) {
		background: var(--accent-soft);
		box-shadow:
			-6px 0 0 var(--accent-soft),
			6px 0 0 var(--accent-soft);
	}

	.article-text__empty {
		font-style: italic;
		color: var(--muted);
		font-family: var(--font-serif);
		font-size: var(--text-lg);
	}
</style>
