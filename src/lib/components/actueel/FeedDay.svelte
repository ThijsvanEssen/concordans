<script lang="ts">
	// One day of Actueel: its date, its kinds counted, and its lines. The homepage shows the
	// first few lines of a day and links to the rest; Actueel shows them all.
	import FeedEntry from './FeedEntry.svelte';
	import { countLine, dayLabel, type Day } from './feed';

	let {
		day,
		today,
		openId,
		onToggle,
		colorOf,
		ministryName,
		filterHref,
		limit,
		moreHref
	}: {
		day: Day;
		today: string;
		openId: string | null;
		onToggle: (id: string) => void;
		colorOf: (short: string | null | undefined) => string;
		ministryName: (key: string | null | undefined) => string;
		filterHref: (patch: Record<string, string>) => string;
		/** The number of lines shown; the rest behind `moreHref`. */
		limit?: number;
		moreHref?: string;
	} = $props();

	const shown = $derived(limit ? day.entries.slice(0, limit) : day.entries);
	const rest = $derived(day.entries.length - shown.length);
	const dateOnly = $derived(dayLabel(day.date, today).toLowerCase());
</script>

<section class="day" aria-labelledby="day-{day.date}">
	<header class="day-head">
		<h2 class="day-title" id="day-{day.date}">{dayLabel(day.date, today)}</h2>
		<span class="day-meta">{countLine(day.counts)}</span>
	</header>
	<ul class="list">
		{#each shown as entry ('fold' in entry ? entry.fold.id : entry.item.id)}
			<FeedEntry {entry} {openId} {onToggle} {colorOf} {ministryName} {filterHref} />
		{/each}
	</ul>
	{#if rest > 0 && moreHref}
		<a class="rest" href={moreHref}>{rest} meer van {dateOnly} in Actueel</a>
	{/if}
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
		font-weight: 500;
	}
	.day-meta {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rest {
		display: inline-block;
		padding: var(--s-2) 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
		text-decoration: none;
	}
	.rest:hover {
		color: var(--accent);
	}
</style>
