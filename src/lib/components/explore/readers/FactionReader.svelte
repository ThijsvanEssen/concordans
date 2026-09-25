<script lang="ts">
	import ReaderFrame from './ReaderFrame.svelte';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel } from '$lib/vocabulary';
	import { str } from '$lib/components/parliamentary/data';

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; faction: Schema<'FactionDetailDTO'> };

	let view = $state<State>({ kind: 'loading' });

	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	$effect(() => {
		void attempt;
		const key = node.key;
		const ac = new AbortController();
		view = { kind: 'loading' };
		unwrap(api.GET('/api/factions/{key}', { params: { path: { key } }, signal: ac.signal }))
			.then((faction) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', faction };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Fractie kon niet geladen worden.' };
			});
		return () => ac.abort();
	});
</script>

<ReaderFrame>
	<div class="r-faction">
		{#if view.kind === 'loading'}
			<p class="loading">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const f = view.faction}
			{@const name = str(f.props?.name)}
			{@const abbreviation = str(f.props?.abbreviation)}
			{@const seats = f.props?.seats}
			<header class="head">
				<span class="kicker"><KindGlyph collection="factions" />{bronLabel('factions')}</span>
				<h2 class="title">{abbreviation ?? name ?? f.key}</h2>
				{#if name && abbreviation && name !== abbreviation}
					<p class="sub">{name}</p>
				{/if}
				{#if typeof seats === 'number'}
					<div class="chips">
						<span class="seats-chip">{seats} zetels</span>
					</div>
				{/if}
			</header>
		{/if}
	</div>
</ReaderFrame>

<style>
	.r-faction {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		color: var(--ink-2);
	}
	.loading,
	.error {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-3);
		margin: 0;
	}

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
	.title {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		color: var(--ink);
		margin: 0;
		line-height: var(--lh-snug);
	}
	.sub {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-3);
		margin: 0;
	}
	.chips {
		display: flex;
		gap: 4px;
	}
	/* The seat count is a word, not a tag. */
	.seats-chip {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-2);
	}
</style>
