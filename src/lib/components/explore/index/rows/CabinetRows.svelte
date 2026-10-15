<script lang="ts">
	import { openHref } from '$lib/bron/href';
	import NameLink from '$lib/bron/NameLink.svelte';
	import { partyColor } from '$lib/utils/party-color.svelte';
	import IndexRow from '../IndexRow.svelte';
	import { inOffice, period, type Cabinet } from '../government';
	import type { ViewProps } from '../lists/list';

	let { ctx }: ViewProps<Cabinet, object> = $props();
	/** The cabinet in office; an older one without an end has an end no source gives. */
	const isOpen = (c: Cabinet) => inOffice(c, ctx.shared.cabinets);
</script>

<ul class="list">
	{#each ctx.rows ?? [] as c (c.key)}
		{@const bron = `cabinets/${c.key}`}
		{@const parties = c.parties ?? []}
		<IndexRow {bron} title={c.name} href={openHref(bron)} acties>
			{#snippet lead()}
				<span class="row-id-main">{period(c.from_date, c.to_date, isOpen(c))}</span>
				{#if isOpen(c)}
					<span class="row-id-sub">In functie</span>
				{/if}
			{/snippet}
			{#snippet body()}
				{#if c.prime_minister?.name}
					<span class="row-sub"
						>Minister-president <NameLink
							collection="members"
							name={c.prime_minister.name}
							key={c.prime_minister.key}
						/></span
					>
				{/if}
				{#if parties.length}
					<span class="party-list">
						{#each parties as x, i (i)}
							<span class="party-item"
								><span class="party-dot" style:background={partyColor(x.short ?? '')}
								></span><NameLink
									collection="factions"
									name={x.short ?? x.faction ?? ''}
									key={x.faction}
								/></span
							>
						{/each}
					</span>
				{/if}
			{/snippet}
			{#snippet aside()}
				<span class="num-strong">{c.members}<span class="num-lbl">bewindspersonen</span></span>
			{/snippet}
		</IndexRow>
	{/each}
</ul>

<style>
	.party-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		margin-top: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.party-item {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
	}
</style>
