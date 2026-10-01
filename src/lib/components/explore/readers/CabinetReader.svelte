<script lang="ts">
	import BronLink from '$lib/bron/BronLink.svelte';
	import Feiten from '$lib/components/ui/Feiten.svelte';
	import Veld from '$lib/components/ui/Veld.svelte';
	import NameLink from '$lib/bron/NameLink.svelte';
	// Reader for a cabinet: its period, minister-president and coalition, and what it did,
	// linked to the lists in Bladeren that hold its bewindspersonen and toezeggingen.
	import ReaderFrame from './ReaderFrame.svelte';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { indexHref } from '$lib/bron/href';
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

			<Feiten>
				<Veld label="Periode" value={from} nodig>
					<span class="nums"
						>{#if to}{from} tot {to}{:else}sinds {from}{/if}</span
					>
				</Veld>
				<Veld label="Minister-president" value={c.prime_minister}>
					<BronLink ref={`members/${c.prime_minister?.key}`}>{c.prime_minister?.name}</BronLink>
				</Veld>
				<Veld label="Coalitie" value={c.parties}>
					<span class="parties">
						{#each c.parties ?? [] as p, i (i)}
							<span class="party"
								><span class="party-dot" style:background={partyColor(p.short ?? p.faction ?? '')}
								></span><NameLink
									collection="factions"
									name={p.short ?? p.faction ?? ''}
									key={p.faction}
								/></span
							>
						{/each}
					</span>
				</Veld>
				<Veld label="Bewindspersonen" value={c.members}>
					<a class="nums" href={listHref('ministers', c.key)} data-sveltekit-noscroll>{c.members}</a
					>
				</Veld>
				<Veld label="Wetsvoorstellen" value={c.bills}>
					<span class="nums">{c.bills}</span>
				</Veld>
				<Veld label="Toezeggingen" value={c.commitments}>
					<a class="nums" href={listHref('commitments', c.key)} data-sveltekit-noscroll
						>{c.commitments}</a
					>
				</Veld>
			</Feiten>
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
		gap: var(--s-2);
	}
	.title {
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 500;
		color: var(--ink);
		margin: 0;
		line-height: var(--lh-snug);
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
		gap: var(--s-2);
	}
	.party-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
</style>
