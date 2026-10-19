<script lang="ts">
	// What is new for a row or a group of a bundel, under the mark that says since when: each
	// line its day, what it is and where it goes, as Actueel writes the line (headlineOf); the
	// newest judgment citing an article as it is cited, at its place.
	import NewMark from '$lib/components/ui/NewMark.svelte';
	import { headlineOf } from '$lib/components/actueel/home-stream';
	import { normalizeItem } from '$lib/components/actueel/feed';
	import { buildBronHref } from '$lib/bron/href';
	import { korteDatum } from '$lib/text/datum';
	import type { Citing, FeedLine } from './fresh';

	let {
		since,
		lines,
		citing = null
	}: { since: string; lines: readonly FeedLine[]; citing?: Citing | null } = $props();

	// As Actueel reads a line: its id always there, its readable address remembered.
	const items = $derived(lines.map(normalizeItem));
</script>

<div class="nieuw">
	<p class="kop"><NewMark {since} /></p>
	<ul>
		{#if citing}
			<li>
				<span class="dag">{korteDatum(citing.date)}</span>
				<span class="regel"
					><span class="wat">Aangehaald in</span>
					{#if citing.href}<a href={citing.href}>{citing.cite}</a
						>{:else}{citing.cite}{/if}{#if citing.place}, r.o. {citing.place}{/if}</span
				>
			</li>
		{/if}
		{#each items as l (l.id)}
			{@const h = headlineOf(l)}
			<li>
				<span class="dag">{korteDatum(l.date)}</span>
				<span class="regel"
					><span class="wat">{h.label}</span>
					<a href={l.path ?? buildBronHref(null, `${l.node.collection}/${l.node.key}`)}>{h.title}</a
					></span
				>
			</li>
		{/each}
	</ul>
</div>

<style>
	.nieuw {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		font-size: var(--t-meta);
	}
	.kop {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		gap: var(--s-3);
		padding: var(--s-1) 0;
		border-bottom: 1px solid var(--rule);
	}
	.dag {
		color: var(--ink-3);
		font-size: var(--t-micro);
		white-space: nowrap;
	}
	.regel {
		font-family: var(--font-serif);
	}
	.wat {
		margin-right: var(--s-1);
		color: var(--ink-3);
	}
	a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	a:hover {
		text-decoration-color: currentColor;
	}
	@media (max-width: 640px) {
		li {
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
		}
	}
</style>
