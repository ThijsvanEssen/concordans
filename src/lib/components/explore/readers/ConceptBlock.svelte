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
	import Section from '$lib/components/ui/Sectie.svelte';
	import FoldButton from '$lib/components/ui/FoldButton.svelte';
	import { isOpen } from '$lib/components/ui/dicht.svelte';
	import ConnectedRow from '$lib/verbonden/VerbondenRow.svelte';
	import { rowKey } from '$lib/verbonden/rows';
	import { formatCount } from '$lib/text/getal';
	import { BEGRIP_KOP, BEGRIP_METHODE } from '$lib/vocabulary';
	import { plural } from '$lib/text/words';
	import type { GraphNode } from '$lib/graph/types';
	import { conceptArticleName, documentRows, judgmentRows } from './concept-rows';

	let { conceptKey, node }: { conceptKey: string; node: GraphNode } = $props();

	const concept = load(() => conceptKey, getConcept, 'Concept');
	let opened = $state<string | null>(null);
	const listsOpen = $derived(isOpen('concept-lists', false));
	const uid = $props.id();

	const same = (id: string) => id.toLowerCase() === node.id.toLowerCase();
</script>

<!-- Its place is kept while it loads: the Vorig and Volgend under it do not jump. -->
{#if concept.state.status === 'loading'}
	<div class="concept-wait" aria-hidden="true"></div>
{:else}
	<LoadState state={concept.state} what="Het concept" form="block" retry={concept.retry}>
		{#snippet children(c)}
			{@const judgments = judgmentRows(c)}
			{@const documents = documentRows(c)}
			<div class="kader">
				<p class="kop"><a href={BEGRIP_METHODE}>{BEGRIP_KOP}</a></p>
				<Section title={c.name} inklapbaar={false}>
					<p class="explanation">
						{#if c.explanation}<a
								class="raak-rij"
								href={c.explanation.url}
								target="_blank"
								rel="noopener noreferrer external">Uitleg: {c.explanation.label}</a
							>{/if}
					</p>
					<ul class="articles">
						{#each c.articles as a (a.id)}
							{@const current = same(a.id)}
							<li class="article" aria-current={current ? 'true' : undefined}>
								<span class="name">
									{#if current}<b>{conceptArticleName(c, a.display_name)}</b><small
											>dit artikel</small
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

					<div class="fold-toggle">
						<FoldButton sleutel="concept-lists" open={listsOpen} controls="{uid}-lists"
							>Uitspraken en stukken bij deze artikelen</FoldButton
						>
					</div>
					<div class="lists" class:is-dicht={!listsOpen} id="{uid}-lists">
						{#if judgments.length}
							<Section
								title="Uitspraken bij deze artikelen"
								niveau={3}
								inklapbaar={false}
								aantal="{judgments.length} van {formatCount(c.judgment_total)}"
							>
								<ul class="list">
									{#each judgments as row (rowKey(row))}
										<ConnectedRow
											{row}
											selection={node}
											open={opened === rowKey(row)}
											onToggle={() => (opened = opened === rowKey(row) ? null : rowKey(row))}
										/>
									{/each}
								</ul>
							</Section>
						{/if}
						{#if documents.length}
							<Section
								title="Stukken bij deze artikelen"
								niveau={3}
								inklapbaar={false}
								aantal="{documents.length} van {formatCount(c.document_total)}"
							>
								<ul class="list">
									{#each documents as row (rowKey(row))}
										<ConnectedRow
											{row}
											selection={node}
											open={opened === rowKey(row)}
											onToggle={() => (opened = opened === rowKey(row) ? null : rowKey(row))}
										/>
									{/each}
								</ul>
							</Section>
						{/if}
					</div>
				</Section>
			</div>
		{/snippet}
	</LoadState>
{/if}

<style>
	/* Concordans' own, not the law's: a frame and a label say so. */
	.kader {
		margin-block: var(--s-6);
		padding: var(--s-3) var(--s-4) var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		background: var(--paper);
	}
	.kop {
		margin: 0;
		font-size: var(--t-micro);
	}
	.kop a {
		color: var(--ink-3);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.concept-wait {
		min-height: 24rem;
	}
	.explanation {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0 var(--s-4);
		text-align: right;
		font-size: var(--t-meta);
	}
	/* One line, the arrow after the words (basis.css), a finger's 44 px high on a touch screen. */
	.explanation a {
		white-space: nowrap;
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.explanation a:hover,
	.explanation a:focus-visible {
		text-decoration-color: currentColor;
	}
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
	.fold-toggle {
		display: none;
	}
	.lists {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--s-5);
		--lezer-stap: var(--s-5);
		align-items: start;
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
		.fold-toggle {
			display: block;
		}
		/* The heading is the button: a finger's 44 px high, as the row of the design. */
		.fold-toggle :global(.fold-knop) {
			align-items: center;
			min-height: var(--veld-h-raak);
		}
		.lists {
			grid-template-columns: minmax(0, 1fr);
		}
		.lists.is-dicht {
			display: none;
		}
	}
</style>
