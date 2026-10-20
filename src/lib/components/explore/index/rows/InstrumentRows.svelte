<script lang="ts">
	import { NOT_IN_DATA } from '$lib/text/coverage';
	import { formatCount } from '$lib/text/getal';
	import type { Schema } from '$lib/api/types';
	import { naamVan } from '$lib/bron/menselijk';
	import { openHref } from '$lib/bron/href';
	import IndexRow from '../IndexRow.svelte';
	import type { ViewProps } from '../lists/list';

	type Row = Schema<'InstrumentListItemDTO'>;
	let { ctx }: ViewProps<Row, object> = $props();

	// A wet that amends others is known from its Staatsblad number only: its own text
	// was not downloaded, but the articles it changed point to it.
	const isPublication = (w: Row) =>
		!w.bwb_id && !w.celex && !w.jurisdiction && w.key.startsWith('stb_');
	const jurisdictionTag = (w: Row) =>
		w.jurisdiction === 'eu'
			? 'EU'
			: w.jurisdiction === 'int'
				? 'Verdrag'
				: isPublication(w)
					? 'Stb.'
					: 'NL';
</script>

<ul class="list">
	{#each ctx.rows ?? [] as w (w.id)}
		{@const bron = `instruments/${w.key}`}
		<IndexRow
			{bron}
			wet={w.bwb_id ?? w.celex}
			title={w.citation_title ?? w.short_title ?? w.title ?? naamVan('instruments', w)}
			href={openHref(bron)}
			acties
		>
			{#snippet lead()}
				<span class="row-id-main">{(w.bwb_id ?? w.celex ?? '').toUpperCase()}</span>
				{#if w.short_title && w.short_title !== w.title}
					<span class="row-id-sub">{w.short_title}</span>
				{/if}
			{/snippet}
			{#snippet body()}
				<span class="row-sub"
					>{w.article_count > 0
						? `${formatCount(w.article_count)} artikelen`
						: isPublication(w)
							? `Publicatie in het Staatsblad, tekst ${NOT_IN_DATA}`
							: 'geen artikelen in de gegevens'}</span
				>
			{/snippet}
			{#snippet aside()}
				<span class="tag">
					{jurisdictionTag(w)}
				</span>
			{/snippet}
		</IndexRow>
	{/each}
</ul>
