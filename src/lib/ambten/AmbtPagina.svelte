<script lang="ts">
	// An office on a page of its own (/ambten/<seat>, B110): its holders over the names of its
	// ministry, the stretches without one, and what the API attributes to it: the toezeggingen
	// and dossiers of the holder of the day. What it cannot attribute, and the stukken it has
	// no way to find per office, stand as one quiet line each; nothing is filled in.
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { getSeat, getSeatCommitments, getSeatDossiers } from '$lib/api/seats';
	import type { Schema } from '$lib/api/types';
	import { openHref } from '$lib/bron/href';
	import NameLink from '$lib/bron/NameLink.svelte';
	import { officialNumber } from '$lib/bron/dossier-naam';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import DateTime from '$lib/components/ui/DateTime.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import IndexRow from '$lib/components/explore/index/IndexRow.svelte';
	import { commitmentStatusLabel } from '$lib/components/explore/index/government';
	import { periodWords } from '$lib/components/explore/readers/ministry';
	import { formatCount } from '$lib/text/getal';
	import { lacks } from '$lib/text/coverage';
	import { capitalize, plural } from '$lib/text/words';
	import { load } from '$lib/util/load.svelte';
	import { ministryName } from '$lib/components/explore/index/ministries.svelte';
	import { AMBTEN_PATH, formerTitles, seatHref, seatName, seatTitle, timeline } from './ambt';
	import { Paged } from './paged.svelte';

	let { seat, title = $bindable() }: { seat: string; title?: string } = $props();

	/** Rows a list shows at first and adds with Volgende. */
	const STAP = 10;
	/** Holders shown before Alle. */
	const HOUDERS = 10;
	let alleHouders = $state(false);
	type AnyList = Paged<unknown>;

	const office = load(
		() => seat,
		(s) => getSeat(s),
		'Ambt'
	);
	const record = $derived(office.state.status === 'ready' ? office.state.data : null);

	const line = $derived(record ? timeline(record.holders, record.gaps) : []);
	const persons = $derived(line.filter((e) => e.kind === 'holder').length);

	$effect(() => {
		title = record ? seatTitle(record) : undefined;
	});

	// Under another of its names the office has the address of its latest.
	$effect(() => {
		if (record && record.seat !== seat) goto(seatHref(record.seat), { replaceState: true });
	});

	const commitments = $derived(
		new Paged<Schema<'CommitmentDTO'>>(
			(offset) => getSeatCommitments(seat, STAP, offset),
			'Toezeggingen van het ambt'
		)
	);
	const dossiers = $derived(
		new Paged<Schema<'DossierSummaryDTO'>>(
			(offset) => getSeatDossiers(seat, STAP, offset),
			'Dossiers van het ambt'
		)
	);
	$effect(() => {
		const lists = [commitments, dossiers];
		untrack(() => lists.forEach((l) => l.start()));
	});

	const formerSeatName = (key: string) => seatName(key, ministryName);
</script>

<div class="blad blad--tekst">
	<nav class="stub-eyebrow" aria-label="Hoort bij"><a href={AMBTEN_PATH}>Ambten</a></nav>
	<header class="blad__kop">
		<h1 class="blad__titel">{record ? seatTitle(record) : 'Ambt'}</h1>
	</header>

	{#if office.state.status !== 'ready'}
		<LoadState state={office.state} what="Het ambt" retry={office.retry} />
	{:else if record}
		{@const eerder = formerTitles(record)}
		{#if eerder.length || record.merged_from.length || record.merged_into.length}
			<dl class="feiten">
				{#if eerder.length}
					<dt>Eerder</dt>
					<dd>{eerder.join(', ')}</dd>
				{/if}
				{#if record.merged_from.length}
					<dt>Opgegaan in dit ambt</dt>
					<dd>
						{#each record.merged_from as s, i (s)}{i ? ', ' : ''}<a href={seatHref(s)}
								>{formerSeatName(s)}</a
							>{/each}
					</dd>
				{/if}
				{#if record.merged_into.length}
					<dt>Opgegaan in</dt>
					<dd>
						{#each record.merged_into as s, i (s)}{i ? ', ' : ''}<a href={seatHref(s)}
								>{formerSeatName(s)}</a
							>{/each}
					</dd>
				{/if}
			</dl>
		{/if}

		<div class="results">
			<Sectie title="Houders" aantal={persons} inklapbaar={false}>
				<ol class="houders">
					{#each alleHouders ? line : line.slice(0, HOUDERS) as entry, i (i)}
						{#if entry.kind === 'gap'}
							<li class="houder">
								<span class="dekking"
									>Geen houder bekend, {periodWords([
										{ from: entry.gap.from_date, to: entry.gap.to_date }
									])}</span
								>
							</li>
						{:else}
							{@const h = entry.stint}
							{@const other = h.functions.filter((f) => f !== seatTitle(record))}
							<li class="houder">
								<span class="houder__naam"
									><NameLink
										collection="members"
										name={h.member.name ?? ''}
										key={h.member.key}
									/>{#if h.acting}, ad interim{/if}</span
								>
								<span class="row-sub"
									>{periodWords([{ from: h.from_date, to: h.to_date }]) ??
										''}{#each h.cabinets as c (c.key)}, <NameLink
											collection="cabinets"
											name={c.name}
											key={c.key}
											inText
										/>{/each}{#if other.length}, {other.join(', ')}{/if}</span
								>
								{#if h.overlaps_with.length}
									<span class="dekking"
										>Volgens de bron tegelijk met {h.overlaps_with.join(', ')}</span
									>
								{/if}
							</li>
						{/if}
					{/each}
				</ol>
				{#if line.length > HOUDERS}
					<AlleN
						aantal={persons}
						noun="houders"
						open={alleHouders}
						onclick={() => (alleHouders = !alleHouders)}
					/>
				{/if}
			</Sectie>

			<Sectie title="Toezeggingen" aantal={record.commitments.attributed} inklapbaar={false}>
				<ul class="list">
					{#each commitments.rows as t (t.key)}
						{@const bron = `commitments/${t.key}`}
						<IndexRow {bron} title={t.text ?? 'Toezegging zonder tekst'} href={openHref(bron)}>
							{#snippet lead()}
								<span class="row-id-main"><DateTime iso={t.date} /></span>
								{#if t.status}<span class="row-id-sub">{commitmentStatusLabel(t.status)}</span>{/if}
							{/snippet}
							{#snippet body()}
								{#if t.member?.name}<span class="row-sub">{t.member.name}</span>{/if}
							{/snippet}
						</IndexRow>
					{/each}
				</ul>
				{@render meer(commitments, 'toezeggingen')}
				{@render rest(record.commitments.unattributed, 'toezegging', 'toezeggingen')}
			</Sectie>

			<Sectie title="Dossiers" aantal={record.dossiers.attributed} inklapbaar={false}>
				<ul class="list">
					{#each dossiers.rows as d (d.id)}
						{@const bron = `dossiers/${d.number}`}
						<IndexRow {bron} title={d.title ?? officialNumber(d.number)} href={openHref(bron)}>
							{#snippet lead()}
								<span class="row-id-main">{officialNumber(d.number)}</span>
								{#if d.kind}<span class="row-id-sub">{d.kind}</span>{/if}
							{/snippet}
							{#snippet body()}
								{#if d.opened_on}<span class="row-sub">Geopend <DateTime iso={d.opened_on} /></span
									>{/if}
							{/snippet}
						</IndexRow>
					{/each}
				</ul>
				{@render meer(dossiers, 'dossiers')}
				{@render rest(record.dossiers.unattributed, 'dossier', 'dossiers')}
			</Sectie>

			<Sectie title="Stukken" inklapbaar={false}>
				<span class="dekking">{lacks('stukken per ambt')}</span>
			</Sectie>
		</div>
	{/if}
</div>

{#snippet meer(list: AnyList, noun: string)}
	{#if list.fout && !list.rows.length}
		<LoadState
			state={{ status: 'error', error: list.fout }}
			what={capitalize(noun)}
			plural
			retry={() => list.start()}
		/>
	{:else if list.rest > 0 || list.fout}
		<AlleN
			volgende
			{noun}
			stap={STAP}
			rest={list.rest}
			laden={list.laden}
			opnieuw={!!list.fout}
			loaded={list.rows.length}
			onclick={() => list.next()}
		/>
	{:else if list.total === 0}
		<p class="stil">Geen {noun}</p>
	{/if}
{/snippet}

{#snippet rest(n: number, one: string, many: string)}
	{#if n > 0}
		<p class="dekking">
			{formatCount(n)}
			{plural(n, one, many)} van dit ministerie niet aan één ambt toe te rekenen
		</p>
	{/if}
{/snippet}

<style>
	.feiten {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--s-1) var(--s-4);
		margin: 0 0 var(--s-6);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.feiten dt {
		color: var(--ink-3);
	}
	.feiten dd {
		margin: 0;
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: var(--s-6);
	}
	.houders,
	.results :global(.list) {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.houder {
		display: flex;
		flex-direction: column;
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
	}
	.houder:first-child {
		padding-top: 0;
	}
	.houder__naam {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink);
	}
	.results :global(.row-id-main) {
		display: block;
	}
	.results :global(.row-id-sub) {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		margin-top: 2px;
	}
	.results :global(.row-sub) {
		display: block;
		margin-top: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* What the dataset cannot give here: one quiet line, as Coverage draws it. */
	.dekking {
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-style: italic;
		color: var(--ink-3);
	}
</style>
