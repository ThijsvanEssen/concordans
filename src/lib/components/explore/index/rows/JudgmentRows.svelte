<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { openHref } from '$lib/bron/href';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import { korteDatum } from '$lib/text/datum';
	import { plural } from '$lib/text/words';
	import IndexRow from '../IndexRow.svelte';
	import { judgmentCaseNumber, judgmentCourt, judgmentRowTitle } from '../judgment-row';
	import type { ViewProps } from '../lists/list';

	let { ctx }: ViewProps<Schema<'JudgmentListItemDTO'>, object> = $props();
</script>

<ul class="list">
	{#each ctx.rows ?? [] as j (j.id)}
		{@const bron = `judgments/${j.key}`}
		<IndexRow {bron} title={judgmentRowTitle(j)} href={openHref(bron)} acties>
			{#snippet lead()}
				<span class="row-id-main"><Waarde value={korteDatum(j.date)} /></span>
				<span class="row-id-sub"><Waarde value={judgmentCourt(j.display_name, j.court)} /></span>
			{/snippet}
			{#snippet body()}
				{#if j.summary}
					<p class="row-summary">{j.summary}</p>
				{/if}
				<!-- The case number and the rechtsgebied, as rechtspraak.nl lists them;
				     the ECLI is the title unless the case has a name. -->
				{@const zaak = judgmentCaseNumber(j.display_name)}
				{@const context = [j.names?.length ? j.ecli : null, zaak, j.subjects?.join('; ')].filter(
					Boolean
				)}
				{#if context.length}
					<span class="row-sub">{context.join(', ')}</span>
				{/if}
			{/snippet}
			{#snippet aside()}
				{#if j.inbound_citation_count}
					<span class="num-strong"
						>{j.inbound_citation_count}<span class="num-lbl"
							>{plural(j.inbound_citation_count, 'citatie', 'citaties')}</span
						></span
					>
				{/if}
			{/snippet}
		</IndexRow>
	{/each}
</ul>

<style>
	/* The inhoudsindicatie of a judgment, two lines at most. */
	.row-summary {
		margin: var(--s-1) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: 1.45;
		color: var(--ink-2);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
