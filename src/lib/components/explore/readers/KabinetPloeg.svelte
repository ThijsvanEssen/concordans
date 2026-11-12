<script lang="ts">
	// The ploeg of a cabinet (B148): per ministry its offices, each to its page, and who held it in
	// the cabinet. Large to small, as Regering: ministry, office, person; grouped as Bewindspersonen.
	import type { Schema } from '$lib/api/types';
	import BronLink from '$lib/bron/BronLink.svelte';
	import NameLink from '$lib/bron/NameLink.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { ministryGroups } from '../index/occupancy';
	import { capitalize } from '$lib/text/words';
	import { seatHref } from '$lib/offices/office';
	import { uniqueBy } from '$lib/util/unique';

	let { cabinet }: { cabinet: Pick<Schema<'CabinetDetailDTO'>, 'ministries'> } = $props();

	const groups = $derived(ministryGroups(cabinet));
	/** A seat in lanes (`#2`) is one office: its holders together, once each. */
	const offices = (seats: Schema<'CabinetSeatDTO'>[]) =>
		[...Map.groupBy(seats, (s) => s.seat.split('#')[0])].map(([seat, lanes]) => ({
			seat,
			title: capitalize(lanes[0].function ?? seat),
			members: uniqueBy(
				lanes.flatMap((l) => l.posts),
				(p) => p.member.key
			)
		}));
</script>

{#if groups.length}
	<Sectie title="Ploeg" inklapbaar={false}>
		{#each groups as g (g.name)}
			<h4 class="ministerie">
				{#if g.ministry}<BronLink ref={`ministries/${g.ministry}`}>{g.name}</BronLink
					>{:else}{g.name}{/if}
			</h4>
			<ul class="ambten">
				{#each offices(g.seats) as o (o.seat)}
					<li>
						<a class="ambt" href={seatHref(o.seat)}>{o.title}</a>
						<span class="wie"
							>{#each o.members as p, i (p.member.key)}{i ? ', ' : ''}<NameLink
									collection="members"
									name={p.member.name ?? p.member.key}
									key={p.member.key}
									inText
								/>{/each}</span
						>
					</li>
				{/each}
			</ul>
		{/each}
	</Sectie>
{/if}

<style>
	.ministerie {
		margin: var(--s-4) 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	.ministerie:first-of-type {
		margin-top: 0;
	}
	.ministerie :global(a) {
		color: inherit;
	}
	.ambten {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.ambten li {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-serif);
	}
	.ambt {
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.wie {
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
</style>
