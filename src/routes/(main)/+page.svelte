<script lang="ts">
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Search from '$lib/search/Search.svelte';
	import Hemicycle from '$lib/components/explore/Hemicycle.svelte';
	import FeedDay from '$lib/components/actueel/FeedDay.svelte';
	import { api, unwrap } from '$lib/api/client';
	import { API_BASE_URL } from '$lib/api/base-url';
	import type { Schema } from '$lib/api/types';
	import { bronHref, indexHref } from '$lib/bron/href';
	import { bronPlural, type Collection } from '$lib/vocabulary';
	import { partyColor } from '$lib/utils/party-color.svelte';
	import {
		getMinistries,
		getPartyColors,
		type Ministry
	} from '$lib/components/explore/index/government';
	import {
		daysOf,
		normalizeItem,
		shortDate,
		type Day,
		type FeedKind
	} from '$lib/components/actueel/feed';

	/** The ways into the material by kind; each opens Bladeren on that kind. */
	const KINDS: Collection[] = ['instruments', 'dossiers', 'judgments', 'committees'];

	/** Actueel by kind: each opens Actueel with that kind chosen. */
	const FEED_CHOICES: { label: string; kind?: FeedKind }[] = [
		{ label: 'Alles' },
		{ label: 'Stemmingen', kind: 'stemming' },
		{ label: 'Moties', kind: 'motie' },
		{ label: 'Wetsvoorstellen', kind: 'wetsvoorstel' },
		{ label: 'Toezeggingen', kind: 'toezegging' },
		{ label: 'Brieven', kind: 'brief_regering' },
		{ label: 'Publicaties', kind: 'publicatie' }
	];

	/** The days of Actueel shown, and the lines of each; the rest is one link away. */
	const DAYS_SHOWN = 2;
	const LINES_SHOWN = 5;
	const FEED_PAGE = 100;
	const VOTES_SHOWN = 3;

	const today = new Date().toISOString().slice(0, 10);

	type Seats = Schema<'ParliamentSeatsResponse'>;
	type Decision = Schema<'DecisionSummaryDTO'>;

	let seats = $state<Seats | null>(null);
	let decisions = $state<Decision[]>([]);
	let decisionVotes = $state<Record<string, Schema<'DecisionDTO'>>>({});
	let hoveredDecision = $state<string | null>(null);
	let days = $state<Day[]>([]);

	// The Kamer and its latest stemmingen beside Actueel; each loads on its own, and a part
	// with nothing to show stays out.
	$effect(() => {
		const ac = new AbortController();
		const signal = ac.signal;
		unwrap(api.GET('/api/parliament/seats', { signal }))
			.then((r) => (seats = r))
			.catch(() => {});
		unwrap(api.GET('/api/decisions', { params: { query: { limit: VOTES_SHOWN } }, signal }))
			.then((r) => (decisions = r.items))
			.catch(() => {});
		loadDays(signal).catch(() => {});
		return () => ac.abort();
	});

	/**
	 * The last days with events, up to today. A day cut off by the page is asked for on its
	 * own, so its counts and folds are those of the whole day.
	 */
	async function loadDays(signal: AbortSignal) {
		const page = await unwrap(
			api.GET('/api/feed', {
				params: { query: { until: today, limit: FEED_PAGE, facets: false } },
				signal
			})
		);
		const all = daysOf(page.items.map(normalizeItem));
		const found = all.slice(0, DAYS_SHOWN);
		const last = found.at(-1);
		// The last day of the page may go on past it.
		if (last && page.next_cursor && last === all.at(-1)) {
			const whole = await unwrap(
				api.GET('/api/feed', {
					params: {
						query: { since: last.date, until: last.date, limit: FEED_PAGE, facets: false }
					},
					signal
				})
			);
			found[found.length - 1] = daysOf(whole.items.map(normalizeItem))[0] ?? last;
		}
		days = found;
	}

	let ministries = $state<Ministry[]>([]);
	let colors = $state<Record<string, string>>({});
	$effect(() => {
		getMinistries()
			.then((m) => (ministries = m))
			.catch(() => {});
		getPartyColors()
			.then((c) => (colors = c))
			.catch(() => {});
	});
	const colorOf = (short: string | null | undefined) =>
		short ? (colors[short] ?? partyColor(short)) : 'var(--rule-strong)';
	const ministryName = (key: string | null | undefined) =>
		(key && ministries.find((m) => m.key === key)?.name) || key || '';

	// A line opens here without a trace in the URL; a filter goes to Actueel.
	let openId = $state<string | null>(null);
	const toggleOpen = (id: string) => (openId = openId === id ? null : id);
	const actueelHref = (params: Record<string, string> = {}) => {
		const query = new URLSearchParams(params).toString();
		return `/actueel${query ? `?${query}` : ''}`;
	};
	const dayHref = (date: string) => actueelHref({ van: date, tot: date });

	// The full vote per faction, so hovering a stemming can light up the hemicycle.
	// Fetched once the stemmingen are in, one call per row shown.
	$effect(() => {
		if (decisions.length === 0) return;
		const ac = new AbortController();
		for (const d of decisions) {
			unwrap(
				api.GET('/api/decisions/{key}', { params: { path: { key: d.key } }, signal: ac.signal })
			)
				.then((full) => (decisionVotes = { ...decisionVotes, [d.key]: full }))
				.catch(() => {});
		}
		return () => ac.abort();
	});

	const voteHighlight = $derived.by(() => {
		if (!hoveredDecision) return null;
		const full = decisionVotes[hoveredDecision];
		if (!full || full.vote_kind !== 'faction' || !full.votes) return null;
		const map: Record<string, 'voor' | 'tegen' | 'other'> = {};
		for (const v of full.votes) {
			if (!v.voter_id.startsWith('factions/')) continue;
			const key = v.voter_id.slice('factions/'.length);
			map[key] = v.choice === 'Voor' ? 'voor' : v.choice === 'Tegen' ? 'tegen' : 'other';
		}
		return map;
	});

	const fmtDateShort = (iso: string | null | undefined) =>
		iso
			? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(iso))
			: '';

	function voteSplit(d: Decision) {
		const voor = d.tally?.['Voor'] ?? 0;
		const tegen = d.tally?.['Tegen'] ?? 0;
		return { voor, tegen, pct: voor + tegen > 0 ? (voor / (voor + tegen)) * 100 : 50 };
	}
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
				<h2 id="actueel-heading" class="actueel-title"><a href={actueelHref()}>Actueel</a></h2>
				{#if days[0]}
					<!-- TODO(backend): data_as_of; until then the newest event in the data. -->
					<span class="stand">Nieuwste gebeurtenis in de gegevens: {shortDate(days[0].date)}</span>
				{/if}
				<a
					class="atom"
					href="{API_BASE_URL}/api/feed.atom"
					rel="alternate"
					type="application/atom+xml">Atom-feed</a
				>
			</header>
			<nav class="choices" aria-label="Actueel per soort">
				{#each FEED_CHOICES as c (c.label)}
					<a
						class="choice"
						class:choice--all={!c.kind}
						href={actueelHref(c.kind ? { soort: c.kind } : {})}>{c.label}</a
					>
				{/each}
			</nav>
			{#each days as day (day.date)}
				<FeedDay
					{day}
					{today}
					{openId}
					onToggle={toggleOpen}
					{colorOf}
					{ministryName}
					filterHref={actueelHref}
					limit={LINES_SHOWN}
					moreHref={dayHref(day.date)}
				/>
			{/each}
			<a class="all" href={actueelHref()}>Meer in Actueel →</a>
		</section>

		{#if seats || decisions.length}
			<aside class="kamer" aria-labelledby="kamer-heading">
				<h2 id="kamer-heading" class="kamer-title">Tweede Kamer</h2>
				{#if seats}
					<div class="hemi-wrap">
						<Hemicycle data={seats} {voteHighlight} />
					</div>
				{/if}
				{#if decisions.length}
					<h3 class="votes-heading">Laatste stemmingen</h3>
					<ul class="feed-list">
						{#each decisions as d (d.id)}
							{@const split = voteSplit(d)}
							<li class="feed-row">
								<a
									class="feed-row-link"
									href={bronHref({ collection: 'decisions', key: d.key })}
									onmouseenter={() => (hoveredDecision = d.key)}
									onmouseleave={() => (hoveredDecision = null)}
									onfocus={() => (hoveredDecision = d.key)}
									onblur={() => (hoveredDecision = null)}
								>
									<div class="feed-row-meta">
										<KindGlyph collection="decisions" />
										{#if d.date}<span>{fmtDateShort(d.date)}</span>{/if}
										{#if d.dossier_numbers?.[0]}<span>{d.dossier_numbers[0]}</span>{/if}
									</div>
									<p class="feed-row-title">{d.subject ?? 'Onderwerp niet beschikbaar'}</p>
									{#if split.voor + split.tegen > 0}
										<div class="vote-mini" class:vote-mini--passed={d.passed}>
											<span class="vote-mini-bar"
												><span class="vote-mini-fill" style:width="{split.pct}%"></span></span
											>
											<span class="vote-mini-label">{d.passed ? 'Aangenomen' : 'Verworpen'}</span>
										</div>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				{/if}
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
		grid-template-columns: minmax(0, 1fr) 300px;
		align-items: start;
		gap: var(--s-8);
		margin-top: var(--s-7);
	}

	/* A column under one rule, not a box: the rule is the edge the rows stack on. */
	.actueel,
	.kamer {
		display: flex;
		flex-direction: column;
		padding-top: var(--s-3);
		border-top: 1px solid var(--ink);
		font-family: var(--font-sans);
	}
	/* The lines of Actueel, narrower than on its own page. */
	.actueel {
		--row-lead: 112px;
		--row-aside: 96px;
	}
	.kamer {
		gap: var(--s-3);
	}

	.actueel-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
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
	.atom {
		margin-left: auto;
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-decoration: none;
	}
	.atom:hover {
		color: var(--accent);
	}

	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin-top: var(--s-3);
	}
	.choice {
		padding: var(--s-1) var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-size: var(--t-meta);
		color: var(--ink);
		text-decoration: none;
	}
	.choice:hover {
		border-color: var(--ink);
	}
	/* Everything is what the page shows: that choice in ink. */
	.choice--all {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--paper);
	}
	.choice--all:hover {
		color: var(--paper);
	}

	.all {
		align-self: flex-start;
		margin-top: var(--s-4);
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
	.votes-heading {
		margin: var(--s-2) 0 0;
		font-size: var(--t-label);
		font-weight: 500;
		font-variant: all-small-caps;
		letter-spacing: 0.04em;
		color: var(--ink-3);
	}

	.feed-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.feed-row {
		border-top: 1px solid var(--rule);
	}
	.feed-row-link {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding: var(--s-3) 0;
		color: inherit;
		text-decoration: none;
	}

	.feed-row-meta {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.feed-row-title {
		display: -webkit-box;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 500;
		color: var(--ink);
		line-height: var(--lh-snug);
		margin: 0;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.feed-row-link:hover .feed-row-title {
		color: var(--accent);
	}

	.vote-mini {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.vote-mini-bar {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: var(--rule);
		overflow: hidden;
	}
	.vote-mini-fill {
		display: block;
		height: 100%;
		background: var(--ink-3);
	}
	.vote-mini-label {
		font-size: var(--t-micro);
		color: var(--ink-3);
		white-space: nowrap;
	}
	/* Adopted in ink, rejected in grey: the result is seen before it is read. */
	.vote-mini--passed .vote-mini-fill {
		background: var(--ink);
	}
	.vote-mini--passed .vote-mini-label {
		color: var(--ink);
		font-weight: 500;
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
		.choice {
			padding: var(--s-2) var(--s-3);
		}
		.atom {
			margin-left: 0;
		}
	}
</style>
