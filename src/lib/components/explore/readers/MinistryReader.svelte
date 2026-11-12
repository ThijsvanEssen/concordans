<script lang="ts">
	// Reader for a ministry under one of its names: when it had the name, the name it followed
	// and the one that followed it, and its offices (B148): held today, then Eerder. Who held an
	// office when is on the office's page; who served in which cabinet in Bewindspersonen.
	// What is its own (laws, open dossiers, open toezeggingen) is in Verbonden, as the
	// verbindingen of any other bron.
	import { textOf } from '$lib/text/words';
	import { bewaarItem } from '$lib/map/map';
	import { getMinistry } from '$lib/api/records';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Feiten from '$lib/components/ui/Feiten.svelte';
	import Veld from '$lib/components/ui/Veld.svelte';
	import Section from '$lib/components/ui/Sectie.svelte';
	import { load } from '$lib/util/load.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import { ministryName } from '../index/ministries.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import { ministryTitle, periodWords } from './ministry';
	import { getSeats } from '$lib/api/seats';
	import { bySeatOrder } from '$lib/offices/office';
	import SeatList from '$lib/offices/SeatList.svelte';

	let { node }: { node: GraphNode } = $props();

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the record is not asked again for that.
	const ministry = load(
		() => node.key,
		(key) => getMinistry(key),
		'Ministerie'
	);
	const record = $derived(ministry.state.status === 'ready' ? ministry.state.data : null);

	// The head from the light node at once, then from the record.
	const p = $derived(node.raw?.props ?? {});
	const name = $derived(record?.name ?? textOf(p.name) ?? node.label);
	const until = $derived(record ? record.until : textOf(p.to_date));
	const abbreviation = $derived(record?.abbreviation ?? textOf(p.abbreviation));
	const title = $derived(ministryTitle(name, until));
	const stretches = $derived(
		record
			? record.periods.map((s) => ({ from: s.from_date, to: s.until }))
			: (Array.isArray(p.periods) ? p.periods : []).map((s: Record<string, unknown>) => ({
					from: textOf(s.from_date),
					to: textOf(s.to_date)
				}))
	);

	// Its offices (B148): held today first, then those nobody holds today, as Eerder.
	const offices = load(
		() => node.key,
		(key) => getSeats({ ministry: key }),
		'Ambten'
	);
	const seats = $derived(
		offices.state.status === 'ready' ? offices.state.data.items.toSorted(bySeatOrder) : []
	);
	// Under a name it no longer has, its offices are one list: today they are its successor's.
	const held = $derived(until ? [] : seats.filter((s) => s.current.length));
	const former = $derived(seats.filter((s) => !s.current.length));
</script>

<ReaderFrame state={ministry.state} what="Ministerie" retry={ministry.retry}>
	{#snippet head()}
		<ReaderHead
			collection="ministries"
			{title}
			acties={{ bewaar: bewaarItem(node.id, { kort: name, voluit: title }) }}
		>
			{#snippet statusLine()}
				{#if periodWords(stretches)}<span>{periodWords(stretches)}</span>{/if}
				{#if abbreviation}<span class="abbr">{abbreviation}</span>{/if}
			{/snippet}
		</ReaderHead>
	{/snippet}
	{#snippet children(m)}
		<div class="r-ministry">
			{#if m.predecessors.length > 0 || m.successor}
				<Feiten>
					<Veld label="Voorganger" value={m.predecessors.length > 0 ? m.predecessors : null}>
						{#each m.predecessors as key, i (key)}{i ? ', ' : ''}<BronLink ref={`ministries/${key}`}
								>{ministryName(key)}</BronLink
							>{/each}
					</Veld>
					<Veld label="Opvolger" value={m.successor}>
						<BronLink ref={`ministries/${m.successor}`}>{ministryName(m.successor)}</BronLink>
					</Veld>
				</Feiten>
			{/if}
			{#if seats.length > 0}
				<Section title="Ambten" aantal={held.length || seats.length} inklapbaar={false}>
					<SeatList seats={held.length ? held : seats} />
					{#if held.length && former.length}
						<h4 class="eerder">Eerder</h4>
						<SeatList seats={former} />
					{/if}
				</Section>
			{/if}
		</div>
	{/snippet}
</ReaderFrame>

<style>
	.r-ministry {
		display: flex;
		flex-direction: column;
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	.eerder {
		margin: var(--s-4) 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	/* The abbreviation: a word, not a tag. */
	.abbr {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>
