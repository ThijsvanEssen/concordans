<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { openHref } from '$lib/bron/href';
	import { voteCitation } from '$lib/bron/naam';
	import { dossierLabel, dossierOwnName, officialNumber } from '$lib/bron/dossier-naam';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import { inhoudVan, stemmingInhoud } from '$lib/components/open/rij-inhoud';
	import { forAgainst, stemmingNaam, votesSentence } from '$lib/components/parliamentary/stemming';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import { korteDatum, weekdag } from '$lib/text/datum';
	import { plural } from '$lib/text/words';
	import IndexRow from '../IndexRow.svelte';
	import { motionKindLabel } from '$lib/components/parliamentary/motion-kind';
	import { NO_DECISION_KIND, decisionMethod, decisionOutcome } from '../decision-kind';
	import type { DecisionsState } from '../lists/decisions';
	import type { ViewProps } from '../lists/list';

	type Row = Schema<'DecisionSummaryDTO'>;
	let { ctx }: ViewProps<Row, DecisionsState> = $props();

	/** Per sitting day, all its decisions under the filters, also those not yet loaded. */
	const dayCounts = $derived(
		new Map((ctx.state.facets?.days ?? []).map((d) => [d.date, d] as const))
	);
	// Sorted by date, the decisions of one sitting day are one group: the Kamer votes in blocks.
	const days = $derived.by(() => {
		const rows = ctx.rows ?? [];
		if (ctx.sort.id !== 'date') return [{ date: null, rows, count: rows.length, passed: 0 }];
		const days: { date: string | null; rows: Row[]; passed: number }[] = [];
		for (const s of rows) {
			const last = days.at(-1);
			const day = last && last.date === (s.date ?? null) ? last : null;
			if (day) day.rows.push(s);
			else days.push({ date: s.date ?? null, rows: [s], passed: 0 });
		}
		// The day's own numbers, from the facet; the rows loaded may be fewer.
		return days.map((d) => {
			const facet = d.date ? dayCounts.get(d.date) : undefined;
			return {
				...d,
				count: facet?.count ?? d.rows.length,
				passed: facet?.passed ?? d.rows.filter((r) => r.passed).length
			};
		});
	});
</script>

{#each days as day (day.date)}
	{#if day.date}
		{@const failed = day.count - day.passed}
		<div class="day-head">
			<h3 class="day-title">{weekdag(day.date)}</h3>
			<span class="day-meta"
				>{day.count}
				{plural(day.count, 'stemming', 'stemmingen')}: {day.passed} aangenomen,
				{failed}
				verworpen</span
			>
			<span class="day-split" aria-hidden="true"
				><span style:width="{(day.passed / day.count) * 100}%"></span></span
			>
		</div>
	{/if}
	<ul class="list">
		{#each day.rows as s (s.id)}
			{@const bron = `decisions/${s.key}`}
			{@const { voor: inFavour, tegen: against } = forAgainst(s.tally)}
			{@const inFavourPct = (inFavour / (inFavour + against)) * 100}
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
							><Waarde value={day.date ? kindLabel : korteDatum(s.date)} /></span
						>
						{#if s.dossiers?.[0] ?? s.dossier_numbers?.[0]}
							{@const d = s.dossiers?.[0] ?? { number: s.dossier_numbers![0] }}
							<span class="row-id-sub row-id-naam" title={d.title ?? undefined}
								>{dossierLabel(d)}</span
							>
						{/if}
					{:else if s.dossiers?.[0] ?? s.dossier_numbers?.[0]}
						{@const d = s.dossiers?.[0] ?? { number: s.dossier_numbers![0] }}
						<span class="row-id-main">{officialNumber(d.number)}</span>
						{#if dossierOwnName(d)}
							<span class="row-id-sub row-id-naam" title={d.title ?? undefined}
								>{dossierOwnName(d)}</span
							>
						{/if}
					{/if}
				{/snippet}
				{#snippet body()}
					{#if inFavour + against > 0}
						<span
							class="stem-mini"
							title="Zetelverdeling: {votesSentence(s.voters) ??
								votesSentence(s.tally)} ({s.vote_kind === 'member' ? 'leden' : 'fracties'})"
						>
							<span class="stem-mini__v">{inFavour}</span>
							<span class="stem-mini__bar">
								<span class="stem-mini__bar-v" style:width="{inFavourPct}%"></span>
								<span class="stem-mini__bar-t" style:width="{100 - inFavourPct}%"></span>
							</span>
							<span class="stem-mini__t">{against}</span>
							<span class="stem-mini__unit">zetels</span>
						</span>
					{:else if decisionMethod(s)}
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

	/* Stemmingen: the sitting day over its votes, with the share that passed. */
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
		font-weight: 800;
	}
	.day-title::first-letter {
		text-transform: uppercase;
	}
	.day-meta {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.day-split {
		margin-left: auto;
		align-self: center;
		display: flex;
		width: 120px;
		height: 6px;
		background: var(--rule);
	}
	.day-split span {
		background: var(--ink);
	}

	/* Seats for and against on a decision row; the numbers say which is which. */
	.stem-mini {
		display: inline-grid;
		grid-template-columns: 32px 140px 32px auto;
		gap: var(--s-2);
		align-items: center;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		margin-top: var(--s-2);
	}
	.stem-mini__v {
		color: var(--ink-2);
		text-align: right;
		font-weight: 600;
	}
	.stem-mini__t {
		color: var(--ink-2);
		text-align: left;
		font-weight: 600;
	}
	.stem-mini__unit {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.stem-mini__bar {
		height: 8px;
		background: var(--paper-2);
		border-radius: var(--r-1);
		overflow: hidden;
		display: flex;
	}
	.stem-mini__bar-v {
		background: var(--ink-2);
	}
	.stem-mini__bar-t {
		background: var(--rule-strong);
	}
</style>
