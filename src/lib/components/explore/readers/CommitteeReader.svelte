<script lang="ts">
	import ReaderFrame from './ReaderFrame.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import type { Schema } from '$lib/api/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel } from '$lib/vocabulary';
	import { committeeSlug, getCommittee, str } from '$lib/components/parliamentary/data';
	import { OUTCOME_LABEL, type Outcome } from '$lib/components/parliamentary/stages';

	let { node }: { node: GraphNode } = $props();

	const p = $derived(node.raw?.props ?? {});
	const name = $derived(str(p.name) ?? node.raw?.display_name ?? node.label);
	const abbreviation = $derived(str(p.abbreviation));
	const kind = $derived(str(p.kind));

	type State =
		| { kind: 'loading' }
		| { kind: 'error' }
		| { kind: 'loaded'; committee: Schema<'CommitteeDetailDTO'> };

	let view = $state<State>({ kind: 'loading' });

	$effect(() => {
		const slug = committeeSlug(node);
		let stale = false;
		view = { kind: 'loading' };
		if (!slug) {
			view = { kind: 'error' };
			return;
		}
		getCommittee(slug)
			.then((committee) => {
				if (!stale) view = { kind: 'loaded', committee };
			})
			.catch(() => {
				if (!stale) view = { kind: 'error' };
			});
		return () => (stale = true);
	});
</script>

<ReaderFrame>
	<div class="r-committee">
		<!-- The header comes from the node, so a failed detail request costs the counts only. -->
		<header class="head">
			<span class="kicker">
				<KindGlyph collection="committees" />
				{bronLabel('committees')}
				{#if kind}<span class="dot">·</span>{kind}{/if}
			</span>
			<h2 class="title">{name}</h2>
			{#if abbreviation && abbreviation !== name}
				<div class="chips"><span class="afk-chip">{abbreviation}</span></div>
			{/if}
		</header>

		{#if view.kind === 'loading'}
			<p class="loading">Laden…</p>
		{:else if view.kind === 'loaded'}
			{@const c = view.committee}
			{@const dossiers = c.dossiers ?? []}
			{@const openDossiers = dossiers.filter((d) => !d.closed)}
			{@const outcomes = Object.keys(OUTCOME_LABEL) as Outcome[]}

			<ul class="stats">
				<li>
					<span class="stat-num">{(c.members ?? []).length}</span><span class="stat-label"
						>Leden</span
					>
				</li>
				<li>
					<span class="stat-num">{openDossiers.length}</span><span class="stat-label"
						>Open dossiers</span
					>
				</li>
				{#each outcomes as outcome (outcome)}
					{@const count = dossiers.filter((d) => d.outcome === outcome).length}
					{#if count > 0}
						<li>
							<span class="stat-num">{count}</span><span class="stat-label"
								>{OUTCOME_LABEL[outcome]}</span
							>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}
	</div>
</ReaderFrame>

<style>
	.r-committee {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		color: var(--ink-2);
	}
	.loading,
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.dot {
		opacity: 0.6;
	}
	.title {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		color: var(--ink);
		margin: 0;
		line-height: var(--lh-snug);
	}
	.chips {
		display: flex;
		gap: var(--s-1);
	}
	/* The abbreviation: a word, not a tag. */
	.afk-chip {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.stats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
		gap: var(--s-2);
	}
	.stats li {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: var(--s-2);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
	}
	.stat-num {
		font-family: var(--font-sans);
		font-size: var(--t-body);
		font-weight: 500;
		color: var(--ink);
	}
	.stat-label {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>
