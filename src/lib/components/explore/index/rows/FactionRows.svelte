<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { naamVan } from '$lib/bron/menselijk';
	import { openHref } from '$lib/bron/href';
	import { formatDecimal } from '$lib/text/getal';
	import { count, plural } from '$lib/text/words';
	import { partyColor } from '$lib/utils/party-color.svelte';
	import IndexRow from '../IndexRow.svelte';
	import type { ViewProps } from '../lists/list';

	let { ctx }: ViewProps<Schema<'FactionDTO'>, object> = $props();
	const totalSeats = $derived((ctx.rows ?? []).reduce((sum, f) => sum + (f.seats ?? 0), 0));
</script>

<ul class="list">
	{#each ctx.rows ?? [] as f (f.id)}
		{@const bron = `factions/${f.key}`}
		<IndexRow {bron} title={f.name ?? naamVan('factions', f)} href={openHref(bron)} acties>
			{#snippet lead()}
				<span class="row-id-main row-id-main--inline">
					<span class="party-dot" style:background={partyColor(f.abbreviation ?? '')}></span>
					{f.abbreviation ?? ''}
				</span>
			{/snippet}
			{#snippet body()}
				{#if (f.seats != null && totalSeats > 0) || f.member_count}
					<span class="row-sub"
						>{[
							f.seats != null && totalSeats > 0
								? `${formatDecimal((f.seats / totalSeats) * 100)}% van de zetels`
								: null,
							f.member_count ? count(f.member_count, 'lid', 'leden') : null
						]
							.filter(Boolean)
							.join(', ')}</span
					>
				{/if}
			{/snippet}
			{#snippet aside()}
				{#if f.seats != null}
					<span class="num-strong"
						>{f.seats}<span class="num-lbl">{plural(f.seats, 'zetel', 'zetels')}</span></span
					>
				{/if}
			{/snippet}
		</IndexRow>
	{/each}
</ul>
