<script lang="ts">
	// Offices as rows (/ambten and the block Ambten of a ministry, B148): the office to its page,
	// who holds it today, else the years it was held, and how many held it. One row in both
	// places; on a phone the holder goes under the office.
	import type { Schema } from '$lib/api/types';
	import NameLink from '$lib/bron/NameLink.svelte';
	import { periodWords } from '$lib/components/explore/readers/ministry';
	import { capitalize, plural } from '$lib/text/words';
	import { seatHref } from './office';

	let { seats }: { seats: readonly Schema<'SeatSummaryDTO'>[] } = $props();
</script>

<ul class="ambten">
	{#each seats as s (s.seat)}
		<li class="ambt">
			<a class="ambt__naam" href={seatHref(s.seat)}>{capitalize(s.function ?? s.seat)}</a>
			<span class="ambt__wie">
				{#if s.current.length}
					{#each s.current as c, i (c.member.key)}{i ? ', ' : ''}<NameLink
							collection="members"
							name={c.member.name ?? c.member.key}
							key={c.member.key}
							inText
						/>{#if c.acting}, ad interim{/if}{/each}
				{:else}
					<span class="stil">{periodWords([{ from: s.from_date, to: s.to_date }]) ?? ''}</span>
				{/if}
			</span>
			<span class="ambt__aantal"
				>{s.holder_count} {plural(s.holder_count, 'houder', 'houders')}</span
			>
		</li>
	{/each}
</ul>

<style>
	.ambten {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	/* Phone first: the office and its count on one line, the holder under it. */
	.ambt {
		display: grid;
		grid-template-columns: 1fr auto;
		column-gap: var(--s-3);
		row-gap: var(--s-1);
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-serif);
	}
	.ambt__naam {
		font-size: var(--t-body);
		color: var(--ink);
	}
	.ambt__aantal {
		font-family: var(--font-ui);
		font-size: var(--t-micro);
		color: var(--ink-3);
		align-self: baseline;
		text-align: right;
	}
	.ambt__wie {
		grid-column: 1 / -1;
		grid-row: 2;
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	@media (min-width: 768px) {
		.ambt {
			/* A fixed count column: every row its own grid, the columns in line. */
			grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) 10ch;
			align-items: baseline;
		}
		.ambt__wie {
			grid-column: 2;
			grid-row: 1;
			font-size: var(--t-body-2);
		}
	}
</style>
