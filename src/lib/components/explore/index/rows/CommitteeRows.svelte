<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { naamVan } from '$lib/bron/menselijk';
	import { openHref } from '$lib/bron/href';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import { plural } from '$lib/text/words';
	import IndexRow from '../IndexRow.svelte';
	import type { ViewProps } from '../lists/list';

	let { ctx }: ViewProps<Schema<'CommitteeDTO'>, object> = $props();
	const rows = $derived(ctx.rows ?? []);
	/** Under the default sort, a divider where the committees without dossiers begin. */
	const divided = $derived(!ctx.p.onlyActive && ctx.sort.id === 'dossiers' && ctx.dir === 'desc');
</script>

<ul class="list">
	{#each rows as c, i (c.id)}
		{@const bron = `committees/${c.key}`}
		{@const count = c.active_dossier_count ?? 0}
		{#if divided && count === 0 && i > 0 && (rows[i - 1].active_dossier_count ?? 0) > 0}
			<li class="group-divider" aria-hidden="true">
				<span>Zonder lopende dossiers</span>
			</li>
		{/if}
		<IndexRow {bron} title={c.name ?? naamVan('committees', c)} href={openHref(bron)} acties>
			{#snippet lead()}
				<span class="row-id-main"><Waarde value={c.abbreviation} /></span>
			{/snippet}
			{#snippet body()}
				{#if c.chamber !== 'EK'}
					<span class="row-sub">
						{count > 0
							? plural(count, 'lopend dossier', 'lopende dossiers')
							: 'Geen lopende dossiers'}
					</span>
				{/if}
			{/snippet}
			{#snippet aside()}
				{#if c.chamber === 'EK'}
					<!-- Not yet linked to dossiers: no count to give. -->
				{:else if count > 0}
					<span class="num-strong">{count}</span>
				{/if}
			{/snippet}
		</IndexRow>
	{/each}
</ul>

<style>
	/* Where the committees without dossiers begin. */
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
