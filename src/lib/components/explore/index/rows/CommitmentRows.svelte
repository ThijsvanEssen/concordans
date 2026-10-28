<script lang="ts">
	import DateTime from '$lib/components/ui/DateTime.svelte';
	import type { Schema } from '$lib/api/types';
	import { openHref } from '$lib/bron/href';
	import DossierNaam from '$lib/bron/DossierNaam.svelte';
	import NameLink from '$lib/bron/NameLink.svelte';
	import ToezeggingInhoud from '$lib/components/open/ToezeggingInhoud.svelte';
	import { korteDatum, vandaag } from '$lib/text/datum';
	import IndexRow from '../IndexRow.svelte';
	import { OPEN_STATUS, commitmentStatusLabel } from '../government';
	import { discussedPhrase, dossiersByBasis } from '$lib/text/toezegging';
	import type { ViewProps } from '../lists/list';

	let { ctx }: ViewProps<Schema<'CommitmentDTO'>, object> = $props();
</script>

<ul class="list">
	{#each ctx.rows ?? [] as t (t.key)}
		{@const bron = `commitments/${t.key}`}
		{@const ds = dossiersByBasis(t.dossiers)}
		{@const late =
			t.status === OPEN_STATUS && !!t.expected_resolution && t.expected_resolution < vandaag()}
		<IndexRow
			{bron}
			title={t.text ?? 'Toezegging zonder tekst'}
			href={openHref(bron)}
			open={ctx.p.open === bron}
			onToggle={() => ctx.toggleOpen(bron)}
		>
			{#snippet lead()}
				<span class="row-id-main"><DateTime iso={t.date} /></span>
				{#if t.status}
					<span class="row-id-sub">{commitmentStatusLabel(t.status)}</span>
				{/if}
			{/snippet}
			{#snippet body()}
				<span class="row-sub">
					{#if t.member}
						<NameLink collection="members" name={t.member.name ?? ''} key={t.member.key} />{t.member
							.function
							? `, ${t.member.function}`
							: ''}
					{:else if t.minister_name}
						{t.minister_name}
					{/if}<!-- A dossier by number and name, the name asked once in view; no space before the comma. A
					     dossier only on its debate's agenda is not its dossier: the debate instead. -->{#each ds.own as d (d.key)}{#if d.number},
							<DossierNaam
								dossier={{ ...d, number: d.number }}
							/>{/if}{/each}{#if ds.agenda.length},
						{discussedPhrase(t.activity, korteDatum)}{/if}
				</span>
			{/snippet}
			{#snippet aside()}
				{#if t.expected_resolution}
					<span class="row-sub" class:row-sub--late={late}
						>{late ? 'Verlopen sinds' : 'Verwacht'}
						{korteDatum(t.expected_resolution)}</span
					>
				{/if}
			{/snippet}
			{#snippet detail()}
				<ToezeggingInhoud toezegging={t} />
			{/snippet}
		</IndexRow>
	{/each}
</ul>

<style>
	.row-sub--late {
		color: var(--ink);
		/* In ink, as everything at rest but "nee" (Thijs, 10 Oct); the weight keeps it seen. */
		font-weight: 600;
	}
</style>
