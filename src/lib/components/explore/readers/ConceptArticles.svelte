<script lang="ts">
	// The articles of a concept, in the order of the list, each with the start of its text and
	// how many judgments cite it. In the block under an article, that article says "dit artikel".
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';
	import type { Schema } from '$lib/api/types';
	import { conceptArticleName } from './concept-rows';

	let {
		concept: c,
		currentId = null
	}: { concept: Schema<'ConceptResponse'>; currentId?: string | null } = $props();

	const same = (id: string) => currentId != null && id.toLowerCase() === currentId.toLowerCase();
</script>

<ul class="articles">
	{#each c.articles as a (a.id)}
		{@const current = same(a.id)}
		<li class="article" aria-current={current ? 'true' : undefined}>
			<span class="name">
				{#if current}<b>{conceptArticleName(c, a.display_name)}</b><small>dit artikel</small
					>{:else if a.path}<a href={a.path} data-sveltekit-noscroll
						>{conceptArticleName(c, a.display_name)}</a
					>{:else}{conceptArticleName(c, a.display_name)}{/if}
			</span>
			<span class="opening">{a.heading ?? a.opening}</span>
			<span class="count"
				>{formatCount(a.judgment_total)}
				{plural(a.judgment_total, 'uitspraak', 'uitspraken')}</span
			>
		</li>
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.article {
		display: grid;
		grid-template-columns: 7rem 1fr auto;
		gap: var(--s-1) var(--s-4);
		padding: var(--s-3) var(--s-2);
		border-top: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
	}
	.article[aria-current='true'] {
		background: var(--paper-2);
	}
	.name {
		display: flex;
		flex-direction: column;
		font-weight: 600;
	}
	.name a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
		align-self: flex-start;
	}
	.name small {
		font-weight: 400;
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	/* The start of the text, not the whole of it. */
	.opening {
		min-width: 0;
		color: var(--ink);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.count {
		font-size: var(--t-meta);
		color: var(--ink-3);
		white-space: nowrap;
	}
	@media (max-width: 768px) {
		.article {
			grid-template-columns: 1fr auto;
		}
		.opening {
			grid-column: 1 / -1;
			grid-row: 2;
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}
	}
</style>
