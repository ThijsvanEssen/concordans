<script lang="ts">
	import BronLink from '$lib/bron/BronLink.svelte';
	import { openHref } from '$lib/bron/href';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import IndexRow from '../IndexRow.svelte';
	import type { Ministry } from '../government';
	import { isCurrent } from '../lists/ministries';
	import type { ViewProps } from '../lists/list';
	import { ministryName } from '../ministries.svelte';

	let { ctx }: ViewProps<Ministry, object> = $props();
	const rows = $derived(ctx.rows ?? []);
	const since = (m: Ministry) => m.periods.find((s) => s.from_date)?.from_date?.slice(0, 4);
</script>

<ul class="list">
	{#each rows as m, i (m.key)}
		{@const bron = `ministries/${m.key}`}
		{#if !isCurrent(m) && i > 0 && isCurrent(rows[i - 1])}
			<li class="group-divider" aria-hidden="true">
				<span>Opgeheven ministeries</span>
			</li>
		{/if}
		<IndexRow {bron} title={m.name} href={openHref(bron)} acties>
			{#snippet lead()}
				<span class="row-id-main">
					{#if isCurrent(m)}
						{since(m) ? `sinds ${since(m)}` : ''}
					{:else}
						tot {m.until?.slice(0, 4)}
					{/if}
				</span>
			{/snippet}
			{#snippet body()}
				{#if m.successor}
					<span class="row-sub"
						>Opvolger <BronLink ref={`ministries/${m.successor}`}
							>{ministryName(m.successor)}</BronLink
						></span
					>
				{/if}
			{/snippet}
			{#snippet aside()}
				<span class="num-strong"><Waarde value={m.abbreviation} /></span>
			{/snippet}
		</IndexRow>
	{/each}
</ul>

<style>
	/* Where the abolished ministeries begin. */
	.group-divider {
		list-style: none;
		padding: var(--s-4) var(--s-2) var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
		border-bottom: 1px solid var(--rule);
	}
</style>
