<script lang="ts">
	// The three ways in on the start page, each shown by one example (product decision of
	// 16 Oct): an article with its reading, origin and text; a vote per party; a Bundel.
	// Fixed (start.json), so they stand in the first paint without a request, as the
	// server's HTML of `/` shows them before the app (app.html sets them alike).
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import VoteMark from '$lib/components/parliamentary/Stem.svelte';
	import OutcomeMark from '$lib/components/parliamentary/Uitkomst.svelte';
	import { START } from './start';

	// Art. 6:162 BW and the parts of its page, each row a link to its part (the filter of
	// Verbonden, lib/verbonden/filter.ts); the motion of 16 June 2026 (decision_495fd69d…),
	// its parties as the vote gave them; the bundel of example-bundle.test.ts.
	const { article, vote, bundle } = START;
</script>

<div class="entrances">
	<section class="entrance" aria-labelledby="entrance-article">
		<h2 id="entrance-article">{article.heading}</h2>
		<a class="title" href={article.href}>{article.title}</a>
		<ul class="rows">
			{#each article.parts as part (part.bronnen)}
				<li>
					<KindGlyph collection={part.collection} />
					<a href="{article.href}?bronnen={part.bronnen}">{part.label}</a>
				</li>
			{/each}
		</ul>
	</section>

	<section class="entrance" aria-labelledby="entrance-vote">
		<h2 id="entrance-vote">{vote.heading}</h2>
		<a class="title" href={vote.href}>{vote.title}</a>
		<p class="meta">{vote.date}</p>
		<p class="outcome"><OutcomeMark tone="nee" woord={vote.outcome} /> <span>{vote.tally}</span></p>
		<dl class="sides">
			{#each vote.sides as side (side.choice)}
				<dt><VoteMark keuze={side.choice} /></dt>
				<dd>{side.parties}</dd>
			{/each}
		</dl>
	</section>

	<section class="entrance" aria-labelledby="entrance-bundle">
		<h2 id="entrance-bundle">{bundle.heading}</h2>
		<a class="title" href={bundle.href}>{bundle.title}</a>
		<ul class="rows">
			{#each bundle.lines as line (line.href)}
				<li>
					<KindGlyph collection={line.collection} />
					<a href={line.href}>{line.label}</a>
				</li>
			{/each}
			<li class="note">
				<span class="note-label">{bundle.noteLabel}</span>
				{bundle.note}
			</li>
		</ul>
	</section>
</div>

<style>
	.entrances {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-5);
	}
	@media (max-width: 1024px) {
		.entrances {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-4);
		}
	}
	.entrance {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-4);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
	}
	h2 {
		margin: 0;
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink-3);
	}
	/* Links at least 24 px high, as Alles in Actueel. */
	.title,
	.rows a {
		display: inline-block;
		padding: var(--s-1) 0;
	}
	.title {
		font-size: var(--t-body-2);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
		text-decoration: none;
	}
	.title:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.meta {
		margin: 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.rows li {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.rows a {
		color: var(--ink);
	}
	.note {
		font-style: italic;
	}
	.note-label {
		font-style: normal;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.outcome {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-size: var(--t-meta);
	}
	.sides {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--s-1) var(--s-3);
		margin: 0;
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
	}
	.sides dd {
		margin: 0;
		color: var(--ink-2);
	}
</style>
