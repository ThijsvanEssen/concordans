<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { openHref } from '$lib/bron/href';
	import { officialNumber } from '$lib/bron/dossier-naam';
	import { korteDatum } from '$lib/text/datum';
	import {
		chapterTitle,
		groupByNumber,
		groupRuns
	} from '$lib/components/parliamentary/dossier-number';
	import { stand } from '$lib/components/parliamentary/stand';
	import IndexRow from '../IndexRow.svelte';
	import { ministryName } from '../ministries.svelte';
	import type { ViewProps } from '../lists/list';

	type Row = Schema<'DossierSummaryDTO'>;
	let { ctx }: ViewProps<Row, object> = $props();

	// The dossiers that share a number form one row that opens to them: all of them when
	// sorted by number, neighbouring ones under another sort (a budget's chapters).
	const entries = $derived(
		ctx.sort.id === 'number' ? groupByNumber(ctx.rows ?? []) : groupRuns(ctx.rows ?? [])
	);
</script>

<ul class="list">
	{#each entries as entry (entry.number + entry.rows[0].id)}
		{#if entry.rows.length === 1}
			{@render dossierRow(entry.rows[0], false)}
		{:else}
			{@const isOpen = ctx.openGroups.has(entry.number)}
			{@const own = entry.rows.find((d) => d.number === entry.number)}
			{@const kinds = new Set(entry.rows.map((d) => d.kind))}
			{@const [kind] = kinds}
			<!-- A filter or an unloaded page can leave out dossiers of the number. -->
			{@const all = (entry.rows[0].same_number_count ?? 0) + 1}
			<IndexRow
				title={own?.title ?? `Dossiers onder nummer ${officialNumber(entry.number)}`}
				href={own ? openHref(`dossiers/${own.number}`) : undefined}
				open={isOpen}
				onToggle={() => ctx.toggleGroup(entry.number)}
			>
				{#snippet lead()}
					<span class="row-id-main">{officialNumber(entry.number)}</span>
					{#if kinds.size === 1 && kind}
						<span class="row-id-sub">{kind}</span>
					{/if}
				{/snippet}
				{#snippet body()}
					<span class="row-sub">
						Toevoegingen {entry.rows.flatMap((d) => d.suffix ?? []).join(', ')}
					</span>
				{/snippet}
				{#snippet aside()}
					<span class="num-strong"
						>{entry.rows.length}<span class="num-lbl"
							>{entry.rows.length < all ? `van ${all} dossiers` : 'dossiers'}</span
						></span
					>
					<span class="chevron" class:chevron--open={isOpen} aria-hidden="true">›</span>
				{/snippet}
			</IndexRow>
			{#if isOpen}
				{#each entry.rows as d (d.id)}
					{@render dossierRow(d, true)}
				{/each}
			{/if}
		{/if}
	{/each}
</ul>

{#snippet dossierRow(d: Row, member: boolean)}
	{@const bron = `dossiers/${d.number}`}
	{@const st = stand(d)}
	{@const who = d.initiative
		? 'Initiatief van Kamerleden'
		: d.ministry
			? ministryName(d.ministry)
			: ''}
	<IndexRow
		{bron}
		{member}
		title={member && d.title
			? chapterTitle(d.title)
			: (d.short_title ?? d.title ?? officialNumber(d.number))}
		href={openHref(bron)}
		acties
	>
		{#snippet lead()}
			<span class="row-id-main">{officialNumber(d.number)}</span>
			{#if d.kind && !member}
				<span class="row-id-sub">{d.kind}</span>
			{/if}
		{/snippet}
		{#snippet body()}
			{#if st?.zin}
				<span class="row-zin">{st.zin}</span>
			{/if}
			<!-- Sorted by its last activity, that day; else the day it was opened. -->
			{@const laatst = ctx.sort.id === 'last_activity' ? d.last_activity : null}
			{@const dag = laatst ?? d.opened_on}
			<span class="row-sub"
				>{who}{who && dag ? ', ' : ''}{#if dag}{laatst ? 'laatste activiteit' : 'geopend'}
					{korteDatum(dag)}{/if}</span
			>
		{/snippet}
		{#snippet aside()}
			{#if st}
				<span
					class="stand"
					aria-label="Stand: {st.bodies
						.map(
							(b) =>
								`${b.name} ${b.state === 'done' ? 'klaar' : b.state === 'now' ? 'nu' : b.state === 'none' ? 'niet' : b.state === 'unknown' ? 'niet in de gegevens' : 'nog niet'}`
						)
						.join(', ')}"
				>
					{#each st.bodies as b (b.short)}
						<span class="stand-body stand-body--{b.state}"
							><abbr title={b.name}>{b.short}</abbr></span
						>
					{/each}
				</span>
			{/if}
		{/snippet}
	</IndexRow>
{/snippet}

<style>
	.row-zin {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
		line-height: var(--lh-snug);
		margin-top: var(--s-1);
	}
	.stand {
		display: inline-grid;
		grid-template-columns: repeat(3, var(--s-7));
		gap: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
	}
	.stand-body {
		padding-top: var(--s-1);
		border-top: 4px solid var(--rule);
		color: var(--ink-3);
		text-align: left;
	}
	.stand-body abbr {
		text-decoration: none;
	}
	.stand-body--done {
		border-top-color: var(--ink-2);
		color: var(--ink-2);
	}
	.stand-body--now {
		border-top-color: var(--ink);
		color: var(--ink);
		font-weight: 600;
	}
	.stand-body--none {
		border-top-style: dotted;
	}

	.chevron {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1;
		color: var(--ink-3);
		transition: transform var(--dur-1) var(--ease);
	}
	.chevron--open {
		transform: rotate(90deg);
	}
</style>
