<script lang="ts">
	import DateTime from '$lib/components/ui/DateTime.svelte';
	import type { Schema } from '$lib/api/types';
	import { naamVan } from '$lib/bron/menselijk';
	import { openHref } from '$lib/bron/href';
	import RowDossier from './RowDossier.svelte';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import { citationRecord } from '$lib/text/citation-record';
	import StukUitslag from '$lib/components/parliamentary/StukUitslag.svelte';
	import { stukUitslag } from '$lib/components/parliamentary/stuk-uitslag';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import IndexRow from '../IndexRow.svelte';
	import type { ViewProps } from '../lists/list';

	let { ctx }: ViewProps<Schema<'DocumentListItemDTO'>, object> = $props();
</script>

<ul class="list">
	{#each ctx.rows ?? [] as doc (doc.key)}
		{@const bron = `documents/${doc.key}`}
		{@const label =
			doc.number == null || doc.number === ''
				? null
				: citationRecord({ ...doc, kind: 'kamerstuk' })?.place}
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
			{/snippet}
			{#snippet body()}
				{@const uitslag = stukUitslag(doc)}
				<!-- The dossier by name under the title (API 0.79.30). -->
				<RowDossier dossier={doc.dossiers?.[0]} />
				{#if doc.kind || uitslag}<span class="row-sub"
						>{doc.kind ?? ''}{#if uitslag}{doc.kind ? ', ' : ''}<StukUitslag {uitslag} />{/if}</span
					>{/if}
			{/snippet}
			{#snippet aside()}
				{#if doc.date}<span class="row-sub"><DateTime iso={doc.date} /></span>{/if}
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
