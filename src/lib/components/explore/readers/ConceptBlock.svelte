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
	import AllN from '$lib/components/ui/AlleN.svelte';
	import FoldButton from '$lib/components/ui/FoldButton.svelte';
	import { isOpen } from '$lib/components/ui/dicht.svelte';
	import ConnectedRow from '$lib/verbonden/VerbondenRow.svelte';
	import { rowKey } from '$lib/verbonden/rows';
	import ConceptArticles from './ConceptArticles.svelte';
	import { BEGRIP_KOP, BEGRIP_METHODE, begripPath } from '$lib/vocabulary';
	import type { GraphNode } from '$lib/graph/types';
	import { documentRows, judgmentRows } from './concept-rows';

	let { conceptKey, node }: { conceptKey: string; node: GraphNode } = $props();

	const concept = load(() => conceptKey, getConcept, 'Concept');
	let opened = $state<string | null>(null);
	const listsOpen = $derived(isOpen('concept-lists', false));
	const uid = $props.id();
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
					<ConceptArticles concept={c} currentId={node.id} />

					<div class="fold-toggle">
						<FoldButton sleutel="concept-lists" open={listsOpen} controls="{uid}-lists"
							>Uitspraken en stukken bij deze artikelen</FoldButton
						>
					</div>
					<div class="lists" class:is-dicht={!listsOpen} id="{uid}-lists">
						{#if judgments.length}
							<Section title="Uitspraken bij deze artikelen" niveau={3} inklapbaar={false}>
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
								<p class="alle">
									<AllN
										aantal={c.judgment_total}
										noun="uitspraken"
										href={begripPath(c.key, 'uitspraken')}
									/>
								</p>
							</Section>
						{/if}
						{#if documents.length}
							<Section title="Stukken bij deze artikelen" niveau={3} inklapbaar={false}>
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
								<p class="alle">
									<AllN
										aantal={c.document_total}
										noun="stukken"
										href={begripPath(c.key, 'stukken')}
									/>
								</p>
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
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.alle {
		margin: var(--s-2) 0 0;
		font-size: var(--t-meta);
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
