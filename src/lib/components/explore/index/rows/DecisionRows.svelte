<script lang="ts">
	import DateTime from '$lib/components/ui/DateTime.svelte';
	import type { Schema } from '$lib/api/types';
	import { openHref } from '$lib/bron/href';
	import { voteCitation } from '$lib/bron/naam';
	import { dossierLabel, officialNumber } from '$lib/bron/dossier-naam';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import { inhoudVan, stemmingInhoud } from '$lib/components/open/rij-inhoud';
	import { stemmingNaam } from '$lib/votes/stemming';
	import Stembalk from '$lib/components/parliamentary/Stembalk.svelte';
	import { voteBarOf } from '$lib/votes/stembalk';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import { weekdag } from '$lib/text/datum';
	import RowDossier from './RowDossier.svelte';
	import IndexRow from '../IndexRow.svelte';
	import { motionKindLabel } from '$lib/text/motion-kind';
	import { NO_DECISION_KIND, decisionMethod, decisionOutcome } from '$lib/votes/decision-kind';
	import type { DecisionsState } from '../lists/decisions';
	import type { ViewProps } from '../lists/list';

	type Row = Schema<'DecisionSummaryDTO'>;
	let { ctx }: ViewProps<Row, DecisionsState> = $props();

	// Sorted by date, the decisions of one sitting day are one group: the Kamer votes in blocks.
	const days = $derived.by(() => {
		const rows = ctx.rows ?? [];
		if (ctx.sort.id !== 'date') return [{ date: null, rows }];
		const days: { date: string | null; rows: Row[] }[] = [];
		for (const s of rows) {
			const last = days.at(-1);
			const day = last && last.date === (s.date ?? null) ? last : null;
			if (day) day.rows.push(s);
			else days.push({ date: s.date ?? null, rows: [s] });
		}
		return days;
	});
</script>

{#each days as day (day.date)}
	{#if day.date}
		<div class="day-head">
			<h3 class="day-title">{weekdag(day.date)}</h3>
		</div>
	{/if}
	<ul class="list">
		{#each day.rows as s (s.id)}
			{@const bron = `decisions/${s.key}`}
			{@const bar = voteBarOf(s)}
			<!-- The Eerste Kamer's decisions carry no kind yet: their dossier leads. -->
			{@const kindLabel =
				motionKindLabel(s.motion_kind) ?? s.kind ?? (s.chamber === 'EK' ? null : NO_DECISION_KIND)}
			{@const content = stemmingInhoud(s.key, s.tally)}
			<IndexRow
				{bron}
				dossier={s.dossiers?.[0]?.number ?? s.dossier_numbers?.[0]}
				title={stemmingNaam(s.subject, s.dossiers?.[0] ?? s.dossier_numbers?.[0])}
				cite={voteCitation(s)}
				href={openHref(bron)}
				open={ctx.p.open === bron}
				onToggle={inhoudVan(content) ? () => ctx.toggleOpen(bron) : undefined}
			>
				{#snippet lead()}
					{#if !day.date || kindLabel}
						<span class="row-id-main"
							>{#if day.date}<Waarde value={kindLabel} />{:else}<DateTime iso={s.date} />{/if}</span
						>
						{#if s.dossiers?.[0] ?? s.dossier_numbers?.[0]}
							{@const d = s.dossiers?.[0] ?? { number: s.dossier_numbers![0] }}
							<span class="row-id-sub">{dossierLabel({ number: d.number })}</span>
						{/if}
					{:else if s.dossiers?.[0] ?? s.dossier_numbers?.[0]}
						{@const d = s.dossiers?.[0] ?? { number: s.dossier_numbers![0] }}
						<span class="row-id-main">{officialNumber(d.number)}</span>
					{/if}
				{/snippet}
				{#snippet body()}
					<!-- Under a subject the dossier is by name here; without one the title says it. -->
					{#if s.subject?.trim()}<RowDossier dossier={s.dossiers?.[0]} />{/if}
					<!-- The opened row draws the bar large; the small one goes while it is open. -->
					{#if bar && ctx.p.open !== bron}
						<span class="stem-mini"
							><Stembalk model={bar} compact members={s.vote_kind === 'member'} /></span
						>
					{:else if !bar && decisionMethod(s)}
						<span class="row-method">{decisionMethod(s)}</span>
					{/if}
				{/snippet}
				{#snippet aside()}
					{#if decisionOutcome(s)}
						<!-- A hamerstuk passes without a vote; a postponed one is no outcome. -->
						<span
							class="tag"
							class:tag--passed={s.passed === true}
							class:tag--rejected={s.passed === false}
						>
							{decisionOutcome(s)}
						</span>
					{/if}
				{/snippet}
				{#snippet detail()}
					<RijInhoud item={content} />
				{/snippet}
			</IndexRow>
		{/each}
	</ul>
{/each}

<style>
	.row-method {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	/* Stemmingen: the sitting day over its votes, said in words. */
	.day-head {
		display: flex;
		align-items: baseline;
		gap: var(--s-3);
		padding: var(--s-4) var(--s-2) var(--s-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	.day-head:first-of-type {
		padding-top: var(--s-1);
	}
	.day-title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 600;
	}
	.day-title::first-letter {
		text-transform: uppercase;
	}
	/* The vote's bar, under the name of the stemming. */
	.stem-mini {
		display: block;
		margin-top: var(--s-2);
	}
</style>
