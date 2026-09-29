<script lang="ts">
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Search from '$lib/search/Search.svelte';
	import Hemicycle from '$lib/components/explore/Hemicycle.svelte';
	import TimelineItem from '$lib/components/actueel/TimelineItem.svelte';
	import { api, unwrap } from '$lib/api/client';
	import { API_BASE_URL } from '$lib/api/base-url';
	import type { Schema } from '$lib/api/types';
	import { indexHref } from '$lib/bron/href';
	import { bronPlural, type Collection } from '$lib/vocabulary';
	import { dayLabel, feedStand, CLOSE_VOTE, shortDate } from '$lib/components/actueel/feed';
	import { timelineOf, type TimelineLine } from '$lib/components/actueel/timeline';

	/** The ways into the material by kind; each opens Bladeren on that kind. */
	const KINDS: Collection[] = ['instruments', 'dossiers', 'judgments', 'committees'];

	/** The lines of Actueel shown; the rest is in Actueel. */
	const LINES_SHOWN = 10;
	/** The days the summary spans: enough for the lines on a quiet week. */
	const SUMMARY_DAYS = 14;

	const today = new Date().toISOString().slice(0, 10);

	let seats = $state<Schema<'ParliamentSeatsResponse'> | null>(null);
	let lines = $state<TimelineLine[]>([]);
	let stand = $state<ReturnType<typeof feedStand>>(null);

	$effect(() => {
		const ac = new AbortController();
		unwrap(api.GET('/api/parliament/seats', { signal: ac.signal }))
			.then((r) => (seats = r))
			.catch(() => {});
		loadLines(ac.signal).catch(() => {});
		return () => ac.abort();
	});

	/** The last days in one answer: their counts, the events that stand alone, how current. */
	async function loadLines(signal: AbortSignal) {
		const summary = await unwrap(
			api.GET('/api/feed/summary', {
				params: { query: { until: today, days: SUMMARY_DAYS, margin: CLOSE_VOTE } },
				signal
			})
		);
		lines = timelineOf(summary, LINES_SHOWN);
		stand = feedStand(summary.data_as_of);
	}

	/** `Dinsdag 22 september`: the year only when it is not this one. */
	const dayHeading = (date: string) => {
		const label = dayLabel(date, today);
		return date.slice(0, 4) === today.slice(0, 4) ? label.replace(/ \d{4}$/, '') : label;
	};
</script>

<svelte:head>
	<title>Concordans</title>
	<meta
		name="description"
		content="Nederlandse wetten, uitspraken en parlementaire stukken met hun onderlinge verbindingen."
	/>
	<link
		rel="alternate"
		type="application/atom+xml"
		title="Actueel"
		href="{API_BASE_URL}/api/feed.atom"
	/>
</svelte:head>

<div class="home">
	<h1 class="sr-only">Concordans</h1>

	<div class="intro">
		<Search />
	</div>

	<div class="browse">
		<h2 id="browse-heading" class="browse-heading">Bladeren</h2>
		<nav class="kinds" aria-labelledby="browse-heading">
			{#each KINDS as kind (kind)}
				<a class="kind no-underline" href={indexHref(kind)}>
					<KindGlyph collection={kind} />
					{bronPlural(kind)}
				</a>
			{/each}
		</nav>
	</div>

	<div class="columns">
		<section class="actueel" aria-labelledby="actueel-heading">
			<header class="actueel-head">
				<h2 id="actueel-heading" class="actueel-title"><a href="/actueel">Actueel</a></h2>
				{#if stand}
					<span
						class="stand"
						title={stand.retrievedAt
							? `Opgehaald op ${shortDate(stand.retrievedAt.slice(0, 10))}`
							: undefined}>tot en met {shortDate(stand.newest)}</span
					>
				{/if}
			</header>
			<ul class="lines" aria-busy={!lines.length}>
				{#each lines as line, i (line.id)}
					{#if line.date !== lines[i - 1]?.date}
						<li class="day">{dayHeading(line.date)}</li>
					{/if}
					<TimelineItem {line} />
				{/each}
			</ul>
			<a class="all" href="/actueel">Alles in Actueel →</a>
		</section>

		{#if seats}
			<aside class="kamer" aria-labelledby="kamer-heading">
				<h2 id="kamer-heading" class="kamer-title">Tweede Kamer</h2>
				<div class="hemi-wrap">
					<Hemicycle data={seats} />
				</div>
			</aside>
		{/if}
	</div>
</div>

<style>
	.home {
		width: 100%;
		max-width: 1120px;
		margin: 0 auto;
		padding: var(--s-8) var(--s-6) var(--s-8);
	}

	.intro {
		max-width: 720px;
		margin: 0 auto;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	/* Its own labelled block, with room above it, so it does not read as
	   part of the search field. */
	.browse {
		max-width: 720px;
		margin: var(--s-5) auto 0;
		padding: var(--s-4) 0 0;
		border-top: 1px solid var(--rule);
	}
	.browse-heading {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		margin: 0 0 var(--s-3);
	}

	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2) var(--s-6);
	}

	.kind {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
		text-decoration: none;
		border-bottom: none;
	}
	.kind:hover {
		color: var(--ink);
	}

	/* Actueel is the page; the Kamer stands beside it. */
	.columns {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 280px;
		align-items: start;
		gap: var(--s-8);
		margin-top: var(--s-7);
	}

	/* A column under one rule, not a box: the rule is the edge the lines stack on. */
	.actueel,
	.kamer {
		display: flex;
		flex-direction: column;
		padding-top: var(--s-3);
		border-top: 1px solid var(--ink);
		font-family: var(--font-sans);
	}
	.kamer {
		gap: var(--s-3);
	}

	.actueel-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-1) var(--s-4);
	}
	.actueel-title,
	.kamer-title {
		margin: 0;
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: var(--t-h2);
		color: var(--ink);
	}
	.kamer-title {
		font-size: var(--t-h3);
	}
	.actueel-title a {
		color: inherit;
		text-decoration: none;
	}
	.actueel-title a:hover {
		color: var(--accent);
	}
	.stand {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
		max-width: 68ch;
	}
	/* A day: a quiet label over its lines, no count. */
	.day {
		padding: var(--s-6) 0 var(--s-1);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink-2);
	}
	.day:first-child {
		padding-top: var(--s-4);
	}

	.all {
		align-self: flex-start;
		margin-top: var(--s-5);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid var(--ink);
	}
	.all:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.hemi-wrap :global(.hemicycle) {
		padding: 0;
		border: none;
		background: transparent;
	}

	@media (max-width: 900px) {
		.columns {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-7);
		}
	}

	@media (max-width: 640px) {
		.home {
			padding: var(--s-5) var(--s-4) var(--s-8);
		}
		.all {
			padding: var(--s-2) 0;
		}
	}
</style>
