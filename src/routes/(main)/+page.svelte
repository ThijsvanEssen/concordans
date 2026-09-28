<script lang="ts">
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Search from '$lib/search/Search.svelte';
	import Hemicycle from '$lib/components/explore/Hemicycle.svelte';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import { bronPlural, type Collection } from '$lib/vocabulary';
	import { dossierStatus } from '$lib/components/parliamentary/stages';
	import { shortDossierTitle } from '$lib/graph/types';

	/** The ways into the material by kind; each opens Bladeren on that kind. */
	const KINDS: Collection[] = ['instruments', 'dossiers', 'judgments', 'committees'];

	const FEED_LIMIT = 4;

	type Seats = Schema<'ParliamentSeatsResponse'>;
	type Decision = Schema<'DecisionSummaryDTO'>;
	type Dossier = Schema<'DossierSummaryDTO'>;
	type Instrument = Schema<'InstrumentListItemDTO'>;

	let seats = $state<Seats | null>(null);
	let decisions = $state<Decision[]>([]);
	let dossiers = $state<Dossier[]>([]);
	let instruments = $state<Instrument[]>([]);
	let decisionVotes = $state<Record<string, Schema<'DecisionDTO'>>>({});
	let hoveredDecision = $state<string | null>(null);

	// Three feeds of what the network holds: the most recent stemmingen, dossiers
	// with recent activity, and the wetten with the most articles indexed. Each
	// loads on its own; a feed with nothing to show stays out.
	$effect(() => {
		const ac = new AbortController();
		const signal = ac.signal;
		unwrap(api.GET('/api/parliament/seats', { signal }))
			.then((r) => (seats = r))
			.catch(() => {});
		unwrap(api.GET('/api/decisions', { params: { query: { limit: FEED_LIMIT } }, signal }))
			.then((r) => (decisions = r.items))
			.catch(() => {});
		unwrap(api.GET('/api/dossiers/recent', { params: { query: { days: 90, limit: 20 } }, signal }))
			.then(
				(r) =>
					(dossiers = r
						.filter((d) => d.title)
						.sort((a, b) => (b.opened_on ?? '').localeCompare(a.opened_on ?? ''))
						.slice(0, FEED_LIMIT))
			)
			.catch(() => {});
		unwrap(
			api.GET('/api/instruments', {
				params: { query: { sort: 'article_count', limit: FEED_LIMIT } },
				signal
			})
		)
			.then((r) => (instruments = r.items))
			.catch(() => {});
		return () => ac.abort();
	});

	// The full vote per faction, so hovering a stemming can light up the hemicycle.
	// Fetched once the feed is in, one call per row shown — cheap at FEED_LIMIT.
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

	const instrumentTitle = (i: Instrument) => i.citation_title ?? i.short_title ?? i.title ?? i.key;
</script>

<svelte:head>
	<title>Concordans</title>
	<meta
		name="description"
		content="Nederlandse wetten, uitspraken en parlementaire stukken met hun onderlinge verbindingen."
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
				<a class="kind no-underline" href="/explore?mode=index&kind={kind}">
					<KindGlyph collection={kind} />
					{bronPlural(kind)}
				</a>
			{/each}
		</nav>
	</div>

	{#if seats || decisions.length || dossiers.length || instruments.length}
		<div class="feeds">
			<section class="feed feed--stemmingen" aria-label="Stemmingen">
				<h2 class="feed-heading">Stemmingen</h2>
				{#if seats}
					<div class="hemi-wrap">
						<Hemicycle data={seats} {voteHighlight} />
					</div>
				{/if}
				{#if decisions.length}
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
										{#if d.dossier_numbers?.[0]}
											<span class="dot">·</span><span>{d.dossier_numbers[0]}</span>
										{/if}
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
			</section>

			<div class="feeds-side">
				{#if dossiers.length}
					<section class="feed" aria-label="Dossiers">
						<h2 class="feed-heading">Dossiers</h2>
						<ul class="feed-list">
							{#each dossiers as d (d.id)}
								<li class="feed-row">
									<a
										class="feed-row-link"
										href={bronHref({ collection: 'dossiers', key: d.key, number: d.number })}
									>
										<div class="feed-row-meta">
											<KindGlyph collection="dossiers" />
											<span>{d.number}</span>
											{#if dossierStatus(d)}
												<span class="dot">·</span><span>{dossierStatus(d)}</span>
											{/if}
										</div>
										<p class="feed-row-title" title={d.title ?? undefined}>
											{shortDossierTitle(d.title ?? null) ?? d.number}
										</p>
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				{#if instruments.length}
					<section class="feed" aria-label="Wetten">
						<h2 class="feed-heading">Wetten</h2>
						<ul class="feed-list">
							{#each instruments as i (i.id)}
								<li class="feed-row">
									<a
										class="feed-row-link"
										href={bronHref({ collection: 'instruments', key: i.key })}
									>
										<!-- The name left, its number of articles right, as on a receipt. -->
										<span class="feed-row-line">
											<span class="feed-row-title">{instrumentTitle(i)}</span>
											<span class="feed-row-count">{i.article_count} artikelen</span>
										</span>
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.home {
		width: 100%;
		max-width: 1040px;
		min-height: calc(100vh - 60px - 320px);
		margin: 0 auto;
		padding: 14vh var(--s-6) 88px;
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
		margin: var(--s-7) auto 0;
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
		gap: var(--s-2) 28px;
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

	.feeds {
		display: grid;
		grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
		align-items: start;
		gap: var(--s-5);
		margin-top: var(--s-8);
	}

	.feeds-side {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
	}

	/* A column under one rule, not a box: the rule is the edge the rows stack on. */
	.feed {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding-top: var(--s-3);
		border-top: 1px solid var(--ink);
	}
	.feed-heading {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		margin: 0;
	}

	.hemi-wrap :global(.hemicycle) {
		padding: 0;
		border: none;
		background: transparent;
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
	.feed-row:first-child {
		border-top: none;
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
		gap: 6px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.dot {
		opacity: 0.6;
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
	.feed-row-line {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-3);
	}
	.feed-row-count {
		flex: none;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
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
		font-family: var(--font-sans);
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

	@media (max-width: 780px) {
		.feeds {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.home {
			padding: var(--s-7) var(--s-4) var(--s-8);
		}
		.browse,
		.intro {
			padding-left: 0;
			padding-right: 0;
		}
	}
</style>
