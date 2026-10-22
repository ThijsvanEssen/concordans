<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { naamVan } from '$lib/bron/menselijk';
	import { openHref } from '$lib/bron/href';
	import { dossierOwnName } from '$lib/bron/dossier-naam';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import { kamerstukLabel } from '$lib/components/parliamentary/kamerstuk';
	import StukUitslag from '$lib/components/parliamentary/StukUitslag.svelte';
	import { stukUitslag } from '$lib/components/parliamentary/stuk-uitslag';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import { korteDatum } from '$lib/text/datum';
	import IndexRow from '../IndexRow.svelte';
	import type { ViewProps } from '../lists/list';

	let { ctx }: ViewProps<Schema<'DocumentListItemDTO'>, object> = $props();
</script>

<ul class="list">
	{#each ctx.rows ?? [] as doc (doc.key)}
		{@const bron = `documents/${doc.key}`}
		{@const label = kamerstukLabel(doc)}
		<!-- A Kamerstuk opens in place on its core text (RijInhoud), as in
		     Actueel, Verbonden and Bundels; the stuk one step further. -->
		<IndexRow
			{bron}
			dossier={doc.dossier_numbers?.[0]}
			title={doc.title ?? doc.kind ?? naamVan('documents', doc)}
			href={openHref(bron)}
			open={ctx.p.open === bron}
			onToggle={() => ctx.toggleOpen(bron)}
		>
			{#snippet lead()}
				<!-- A paper that is no Kamerstuk has its own number (2026D41234). -->
				<span class="row-id-main"><Waarde value={label ?? doc.document_number} /></span>
				<!-- The dossier by name under its number (API 0.79.30). -->
				{#if doc.dossiers?.[0] && dossierOwnName(doc.dossiers[0])}
					<span class="row-id-sub row-id-naam" title={doc.dossiers[0].title ?? undefined}
						>{dossierOwnName(doc.dossiers[0])}</span
					>
				{/if}
			{/snippet}
			{#snippet body()}
				{@const uitslag = stukUitslag(doc)}
				{#if doc.kind || uitslag}<span class="row-sub"
						>{doc.kind ?? ''}{#if uitslag}{doc.kind ? ', ' : ''}<StukUitslag {uitslag} />{/if}</span
					>{/if}
			{/snippet}
			{#snippet aside()}
				{#if doc.date}<span class="row-sub">{korteDatum(doc.date)}</span>{/if}
			{/snippet}
			{#snippet detail()}
				<RijInhoud
					item={{
						node: { collection: 'documents', key: doc.key },
						dictum: doc.dictum,
						explanation: doc.explanation
					}}
					als="kern"
				/>
			{/snippet}
		</IndexRow>
	{/each}
</ul>
