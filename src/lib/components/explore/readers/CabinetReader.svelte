<script lang="ts">
	import { textOf } from '$lib/text/words';
	import { langeDatum } from '$lib/text/datum';
	import { bewaarItem } from '$lib/map/map';
	import ReaderHead from './ReaderHead.svelte';
	import { getCabinet } from '$lib/api/records';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Feiten from '$lib/components/ui/Feiten.svelte';
	import Veld from '$lib/components/ui/Veld.svelte';
	import NameLink from '$lib/bron/NameLink.svelte';
	// Reader for a cabinet: its period, minister-president and coalition, and what it did,
	// linked to the lists in Bladeren that hold its bewindspersonen and toezeggingen.
	import ReaderFrame from './ReaderFrame.svelte';
	import KabinetZetels from './KabinetZetels.svelte';
	import { phaseStarts } from '../index/occupancy';
	import type { GraphNode } from '$lib/graph/types';
	import { indexHref } from '$lib/bron/href';
	import { achtergrondVan } from '../partijkleuren.svelte';
	import { formatCount } from '$lib/text/getal';
	import { load } from '$lib/util/load.svelte';

	let { node }: { node: GraphNode } = $props();

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the record is not asked again for that.
	const cabinet = load(
		() => node.key,
		(key) => getCabinet(key),
		'Kabinet'
	);
	const record = $derived(cabinet.state.status === 'ready' ? cabinet.state.data : null);

	/** A date as precise as the source knows it: a year stays a year. */
	// Since API 0.26 every cabinet is dated to the day.
	const when = (date: string | null | undefined) => (date ? langeDatum(date) : null);

	// The head, the period and the seats from the light node at once; the rest when the
	// cabinet's record comes (/api/cabinets/{key} takes seconds cold: Rutte IV 2 s, live
	// 10 Oct, where the light node takes 0.2 s).
	const p = $derived(node.raw?.props ?? {});
	const naam = $derived(record?.name ?? textOf(p.name) ?? node.label);
	const van = $derived(record ? record.from_date : textOf(p.from_date));
	const tot = $derived(record ? record.to_date : textOf(p.to_date));

	const listHref = (kind: 'ministers' | 'commitments', key: string) =>
		indexHref(kind, { kabinet: key });
</script>

<ReaderFrame state={cabinet.state} what="Kabinet" retry={cabinet.retry}>
	{#snippet head()}
		<ReaderHead
			collection="cabinets"
			title={naam}
			acties={{
				bewaar: bewaarItem(node.id, { kort: naam, voluit: naam })
			}}
		/>
	{/snippet}
	{#snippet loading()}
		<!-- The period from the light node; the other rows wait for the record, each with
			     its label in place so nothing under them moves when they come. -->
		<Feiten>
			<Veld label="Periode" value={when(van)} nodig>
				<span class="nums"
					>{#if tot}{when(van)} tot {when(tot)}{:else}sinds {when(van)}{/if}</span
				>
			</Veld>
			{#each ['Minister-president', 'Coalitie', 'Bewindspersonen', 'Wetsvoorstellen', 'Toezeggingen'] as label (label)}
				<Veld {label} value="…"><span class="stil">…</span></Veld>
			{/each}
		</Feiten>
	{/snippet}
	{#snippet children(c)}
		{@const from = when(c.from_date)}
		{@const to = when(c.to_date)}
		<Feiten>
			<Veld label="Periode" value={from} nodig>
				<span class="nums"
					>{#if to}{from} tot {to}{:else}sinds {from}{/if}</span
				>
			</Veld>
			<!-- The link takes the person's address from the answer (onthoudPaden):
				     `prime_minister.path`. -->
			<Veld label="Minister-president" value={c.prime_minister}>
				<BronLink ref={`members/${c.prime_minister?.key}`}>{c.prime_minister?.name}</BronLink>
			</Veld>
			<Veld label="Coalitie" value={c.parties}>
				<span class="parties">
					{#each c.parties ?? [] as p, i (i)}
						<span class="party"
							><span class="party-dot" style:background={achtergrondVan(p.short ?? p.faction ?? '')}
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
				<a class="nums" href={listHref('ministers', c.key)} data-sveltekit-noscroll
					>{formatCount(c.members)}</a
				>
			</Veld>
			<Veld label="Wetsvoorstellen" value={c.bills}>
				<span class="nums">{formatCount(c.bills)}</span>
			</Veld>
			<Veld label="Toezeggingen" value={c.commitments}>
				<a class="nums" href={listHref('commitments', c.key)} data-sveltekit-noscroll
					>{formatCount(c.commitments)}</a
				>
			</Veld>
		</Feiten>
	{/snippet}
	{#snippet foot()}
		<div class="seats">
			<KabinetZetels kabinet={node.key} fasen={phaseStarts(record?.phases ?? [])} />
		</div>
	{/snippet}
</ReaderFrame>

<style>
	/* The seats a step under the facts, as the head stands a step above them. */
	.seats {
		margin-top: var(--s-5);
		color: var(--ink-2);
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
