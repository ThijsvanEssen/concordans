<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { naamVan } from '$lib/bron/menselijk';
	import { openHref } from '$lib/bron/href';
	import NameLink from '$lib/bron/NameLink.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { partyColor } from '$lib/utils/party-color.svelte';
	import IndexRow from '../IndexRow.svelte';
	import type { ViewProps } from '../lists/list';

	let { ctx }: ViewProps<Schema<'MemberDTO'>, object> = $props();
</script>

<ul class="list">
	{#each ctx.rows ?? [] as m (m.id)}
		{@const bron = `members/${m.key}`}
		<IndexRow {bron} title={m.name ?? naamVan('members', m)} href={openHref(bron)} acties>
			{#snippet lead()}
				<!-- An Eerste Kamer member's fractie is the one it sits in there. -->
				{@const ek = ctx.p.kamer === 'EK' ? m.ek : null}
				{@const abbreviation = ek ? ek.abbreviation : m.party}
				<span class="row-id-main row-id-main--inline">
					<span class="party-dot" style:background={partyColor(abbreviation ?? '')}></span>
					{#if ek?.faction && ek.abbreviation}<BronLink
							ref={{ collection: 'factions', key: ek.faction }}>{ek.abbreviation}</BronLink
						>{:else if m.party}<NameLink collection="factions" name={m.party} />{/if}
				</span>
			{/snippet}
		</IndexRow>
	{/each}
</ul>
