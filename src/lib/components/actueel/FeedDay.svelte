<script lang="ts">
	// One day of Actueel: its date, its kinds counted, and its lines. The counts are the
	// whole day's from the summary when it has come; until then, those of the lines loaded.
	import FeedEntry from './FeedEntry.svelte';
	import { countLine, dayLabel, summaryCounts, type Day, type DaySummary } from './feed';

	let {
		day,
		today,
		openId,
		onToggle,
		colorOf,
		ministryName,
		filterHref,
		summary,
		nieuwSinds = null
	}: {
		day: Day;
		today: string;
		openId: string | null;
		onToggle: (id: string) => void;
		colorOf: (short: string | null | undefined) => string;
		ministryName: (key: string | null | undefined) => string;
		filterHref: (patch: Record<string, string>) => string;
		/** The day as `/api/feed/summary` counts it, under the same filters. */
		summary?: DaySummary;
		/** A followed topic's visit before this one (Onderwerpen). */
		nieuwSinds?: string | null;
	} = $props();

	const counts = $derived(summary ? summaryCounts(summary) : day.counts);
</script>

<section class="day" aria-labelledby="day-{day.date}">
	<header class="day-head">
		<h2 class="day-title" id="day-{day.date}">{dayLabel(day.date, today)}</h2>
		<span class="day-meta">{countLine(counts)}</span>
	</header>
	<ul class="list">
		{#each day.entries as entry ('fold' in entry ? entry.fold.id : entry.item.id)}
			<FeedEntry
				{entry}
				{openId}
				{onToggle}
				{colorOf}
				{ministryName}
				{filterHref}
				votes={summary?.votes}
				{nieuwSinds}
			/>
		{/each}
	</ul>
</section>

<style>
	.day-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-3);
		padding: var(--s-5) 0 var(--s-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	.day-title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 800;
	}
	.day-meta {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
</style>
