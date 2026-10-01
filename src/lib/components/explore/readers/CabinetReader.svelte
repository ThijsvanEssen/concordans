<script lang="ts">
	import NameLink from '$lib/bron/NameLink.svelte';
	// Reader for a cabinet: its period, minister-president and coalition, and what it did,
	// linked to the lists in Bladeren that hold its bewindspersonen and toezeggingen.
	import ReaderFrame from './ReaderFrame.svelte';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronHref, indexHref } from '$lib/bron/href';
	import { bronLabel } from '$lib/vocabulary';
	import { partyColor } from '$lib/utils/party-color.svelte';
	import { formatLongDate } from './_shared';

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; cabinet: Schema<'CabinetDetailDTO'> };

	let view = $state<State>({ kind: 'loading' });

	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	$effect(() => {
		void attempt;
		const key = node.key;
		const ac = new AbortController();
		view = { kind: 'loading' };
		unwrap(api.GET('/api/cabinets/{key}', { params: { path: { key } }, signal: ac.signal }))
			.then((cabinet) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', cabinet };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Kabinet kon niet geladen worden.' };
			});
		return () => ac.abort();
	});

	/** A date as precise as the source knows it: a year stays a year. */
	// Since API 0.26 every cabinet is dated to the day.
	const when = (date: string | null | undefined) => (date ? formatLongDate(date) : null);

	const listHref = (kind: 'ministers' | 'commitments', key: string) =>
		indexHref(kind, { cabinet: key });
</script>

<ReaderFrame>
	<div class="r-cabinet">
		{#if view.kind === 'loading'}
			<p class="loading">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const c = view.cabinet}
			{@const from = when(c.from_date)}
			{@const to = when(c.to_date)}
			<header class="head">
				<span class="kicker"><KindGlyph collection="cabinets" />{bronLabel('cabinets')}</span>
				<h2 class="title">{c.name}</h2>
			</header>

			<dl class="facts">
				<dt>Periode</dt>
				<dd class="nums">
					{#if from && to}{from} tot {to}{:else if from}sinds {from}{:else}onbekend{/if}
				</dd>
				{#if c.prime_minister}
					<dt>Minister-president</dt>
					<dd>
						<a href={bronHref(`members/${c.prime_minister.key}`)} data-sveltekit-noscroll
							>{c.prime_minister.name}</a
						>
					</dd>
				{/if}
				{#if c.parties?.length}
					<dt>Coalitie</dt>
					<dd class="parties">
						{#each c.parties as p, i (i)}
							<span class="party"
								><span class="party-dot" style:background={partyColor(p.short ?? p.faction ?? '')}
								></span><NameLink
									collection="factions"
									name={p.short ?? p.faction ?? ''}
									key={p.faction}
								/></span
							>
						{/each}
					</dd>
				{/if}
				<dt>Bewindspersonen</dt>
				<dd class="nums">
					<a href={listHref('ministers', c.key)} data-sveltekit-noscroll>{c.members}</a>
				</dd>
				<dt>Wetsvoorstellen</dt>
				<dd class="nums">{c.bills}</dd>
				<dt>Toezeggingen</dt>
				<dd class="nums">
					<a href={listHref('commitments', c.key)} data-sveltekit-noscroll>{c.commitments}</a>
				</dd>
			</dl>
		{/if}
	</div>
</ReaderFrame>

<style>
	.r-cabinet {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
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
		font-size: var(--t-h2);
		font-weight: 500;
		color: var(--ink);
		margin: 0;
		line-height: var(--lh-snug);
	}
	/* Label left, value beside it: one edge for the labels, one for the values. */
	.facts {
		display: grid;
		grid-template-columns: 10em minmax(0, 1fr);
		gap: var(--s-2) var(--s-4);
		margin: 0;
	}
	.facts dt {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.facts dd {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.nums {
		font-variant-numeric: tabular-nums;
	}
	.parties {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
	}
	.party {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.party-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
</style>
