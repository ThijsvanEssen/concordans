<script lang="ts">
	import type { GraphNode } from '$lib/graph/types';
	import type { Schema } from '$lib/api/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel } from '$lib/vocabulary';
	import { committeeSlug, getCommittee, str } from '$lib/components/parliamentary/data';

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

		<ul class="stats">
			<li>
				<span class="stat-num">{(c.members ?? []).length}</span><span class="stat-label">Leden</span
				>
			</li>
			<li>
				<span class="stat-num">{openDossiers.length}</span><span class="stat-label"
					>Open dossiers</span
				>
			</li>
			<li>
				<span class="stat-num">{dossiers.length - openDossiers.length}</span><span
					class="stat-label">Afgedaan</span
				>
			</li>
		</ul>
	{/if}
</div>

<style>
	.r-committee {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-5) var(--s-5) var(--s-6);
		color: var(--ink-2);
		height: 100%;
		overflow-y: auto;
	}
	.loading,
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.dot {
		opacity: 0.6;
	}
	.title {
		font-family: var(--font-serif);
		font-size: 19px;
		font-weight: 400;
		color: var(--ink);
		margin: 0;
		line-height: 1.25;
	}
	.chips {
		display: flex;
		gap: 4px;
	}
	.afk-chip {
		display: inline-flex;
		align-items: center;
		height: 18px;
		padding: 0 7px;
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border: 1px solid var(--rule);
		background: var(--paper-2);
		color: var(--ink-2);
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
		font-family: var(--font-mono);
		font-size: 17px;
		font-weight: 600;
		color: var(--ink);
	}
	.stat-label {
		font-family: var(--font-sans);
		font-size: 9px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-4);
	}
</style>
