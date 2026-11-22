<script lang="ts">
	// The block of a concept under the text of an article that is one of its articles: the
	// articles that together make one doctrine, and what cites them (Gw 93, 94 and 120, the
	// Politiewet 2012). Verbonden shows the verbindingen of one article; this shows what only
	// the articles together can: the newest judgments and papers over all of them. The rows
	// are those of Verbonden (VerbondenRow). On a phone the judgments and papers stand behind
	// one fold-out. Design: docs/claude/ontwerp-conceptblok.md (lawgraph).
	import { getConcept } from '$lib/api/concepts';
	import { load } from '$lib/util/load.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Caret from '$lib/components/ui/Caret.svelte';
	import VerbondenRow from '$lib/verbonden/VerbondenRow.svelte';
	import { rowKey } from '$lib/verbonden/rows';
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';
	import type { GraphNode } from '$lib/graph/types';
	import { documentRows, judgmentRows } from './concept-rows';

	let { conceptKey, node }: { conceptKey: string; node: GraphNode } = $props();

	const concept = load(() => conceptKey, getConcept, 'Concept');
	let opened = $state<string | null>(null);
	let folded = $state(false);
	const uid = $props.id();

	const same = (id: string) => id.toLowerCase() === node.id.toLowerCase();
</script>

<!-- Its place is kept while it loads: the Vorig and Volgend under it do not jump. -->
{#if concept.state.status === 'loading'}
	<div class="concept-wacht" aria-hidden="true"></div>
{:else}
	<LoadState state={concept.state} what="Het concept" form="block" retry={concept.retry}>
		{#snippet children(c)}
			{@const judgments = judgmentRows(c)}
			{@const documents = documentRows(c)}
			<Sectie title={c.name} inklapbaar={false}>
				{#snippet naast()}
					{#if c.explanation}
						<TekstLink href={c.explanation.url} target="_blank" rel="noopener noreferrer"
							>Uitleg: {c.explanation.label} ↗</TekstLink
						>
					{/if}
				{/snippet}
				<ul class="artikelen">
					{#each c.articles as a (a.id)}
						{@const dit = same(a.id)}
						<li class="artikel" class:is-dit={dit} aria-current={dit ? 'true' : undefined}>
							<span class="naam">
								{#if dit}<b>{a.display_name}</b><small>dit artikel</small>{:else if a.path}<a
										href={a.path}
										data-sveltekit-noscroll>{a.display_name}</a
									>{:else}{a.display_name}{/if}
							</span>
							<span class="tekst">{a.heading ?? a.opening}</span>
							<span class="aantal"
								>{formatCount(a.judgment_total)}
								{plural(a.judgment_total, 'uitspraak', 'uitspraken')}</span
							>
						</li>
					{/each}
				</ul>

				<button
					type="button"
					class="uitklap raakvlak"
					aria-expanded={!folded}
					aria-controls="{uid}-rijen"
					onclick={() => (folded = !folded)}
				>
					Uitspraken en stukken bij deze artikelen<Caret open={!folded} />
				</button>
				<div class="rijen" class:is-dicht={folded} id="{uid}-rijen">
					{#if judgments.length}
						<Sectie
							title="Uitspraken bij deze artikelen"
							niveau={3}
							inklapbaar={false}
							aantal="{judgments.length} van {formatCount(c.judgment_total)}"
						>
							<ul class="lijst">
								{#each judgments as row (rowKey(row))}
									<VerbondenRow
										{row}
										selection={node}
										open={opened === rowKey(row)}
										onToggle={() => (opened = opened === rowKey(row) ? null : rowKey(row))}
									/>
								{/each}
							</ul>
						</Sectie>
					{/if}
					{#if documents.length}
						<Sectie
							title="Stukken bij deze artikelen"
							niveau={3}
							inklapbaar={false}
							aantal="{documents.length} van {formatCount(c.document_total)}"
						>
							<ul class="lijst">
								{#each documents as row (rowKey(row))}
									<VerbondenRow
										{row}
										selection={node}
										open={opened === rowKey(row)}
										onToggle={() => (opened = opened === rowKey(row) ? null : rowKey(row))}
									/>
								{/each}
							</ul>
						</Sectie>
					{/if}
				</div>
			</Sectie>
		{/snippet}
	</LoadState>
{/if}

<style>
	.concept-wacht {
		min-height: 24rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.artikel {
		display: grid;
		grid-template-columns: 7rem 1fr auto;
		gap: var(--s-1) var(--s-4);
		padding: var(--s-3) var(--s-2);
		border-top: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
	}
	.artikel.is-dit {
		background: var(--paper-2);
	}
	.naam {
		display: flex;
		flex-direction: column;
		font-family: var(--font-sans);
		font-weight: 600;
	}
	.naam a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
		align-self: flex-start;
	}
	.naam small {
		font-weight: 400;
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	/* The start of the text, not the whole of it. */
	.tekst {
		min-width: 0;
		color: var(--ink);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.aantal {
		font-size: var(--t-meta);
		color: var(--ink-3);
		white-space: nowrap;
	}
	.uitklap {
		display: none;
	}
	.rijen {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--s-5);
		align-items: start;
	}
	@media (max-width: 768px) {
		.artikel {
			grid-template-columns: 1fr auto;
		}
		.tekst {
			grid-column: 1 / -1;
			grid-row: 2;
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}
		.uitklap {
			display: flex;
			align-items: center;
			justify-content: space-between;
			width: 100%;
			min-height: var(--veld-h-raak);
			padding: 0 var(--s-3);
			border: 1px solid var(--rule-strong);
			background: var(--paper);
			font: inherit;
			font-family: var(--font-sans);
			font-size: var(--t-body-2);
			color: var(--ink);
		}
		.rijen {
			grid-template-columns: minmax(0, 1fr);
		}
		.rijen.is-dicht {
			display: none;
		}
	}
</style>
