<script lang="ts">
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Search from '$lib/search/Search.svelte';
	import { api, unwrap } from '$lib/api/client';
	import { API_BASE_URL } from '$lib/api/base-url';
	import { bronHref, indexHref } from '$lib/bron/href';
	import type { Collection } from '$lib/vocabulary';
	import { dayLabel, feedStand, CLOSE_VOTE, shortDate } from '$lib/components/actueel/feed';
	import { FEW_VOTES, timelineOf, type TimelineLine } from '$lib/components/actueel/timeline';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import type { TijdGroep } from '$lib/components/tijdlijn/tijdlijn';

	// Four ways in to search, each with the glyphs of what it holds.
	const SCOPES: {
		id: string;
		label: string;
		kinds: string[];
		tekens: Collection[];
		href: string;
	}[] = [
		{
			id: 'wetten',
			label: 'Wetten',
			kinds: ['instruments', 'articles'],
			tekens: ['instruments', 'articles'],
			href: indexHref('instruments')
		},
		{
			id: 'uitspraken',
			label: 'Uitspraken',
			kinds: ['judgments'],
			tekens: ['judgments'],
			href: indexHref('judgments')
		},
		{
			id: 'parlement',
			label: 'Parlement',
			kinds: ['dossiers', 'documents', 'members', 'factions', 'committees'],
			tekens: ['dossiers', 'documents', 'decisions', 'members'],
			href: indexHref('dossiers', { track: 'Wetgeving' })
		},
		{
			id: 'kabinet',
			label: 'Kabinet',
			kinds: ['cabinets', 'members'],
			tekens: ['cabinets', 'members', 'commitments'],
			href: indexHref('cabinets')
		}
	];
	let scope = $state<string | null>(null);
	const chosen = $derived(SCOPES.find((x) => x.id === scope) ?? null);

	/** The lines of Actueel shown; the rest is in Actueel. */
	const LINES_SHOWN = 10;
	/** The days the summary spans: enough for the lines on a quiet week. */
	const SUMMARY_DAYS = 14;

	const today = new Date().toISOString().slice(0, 10);

	let lines = $state<TimelineLine[]>([]);
	let stand = $state<ReturnType<typeof feedStand>>(null);

	$effect(() => {
		const ac = new AbortController();
		loadLines(ac.signal).catch(() => {});
		return () => ac.abort();
	});

	/** The last days in one answer: their counts, the events that stand alone, how current. */
	async function loadLines(signal: AbortSignal) {
		const summary = await unwrap(
			api.GET('/api/feed/summary', {
				params: { query: { until: today, days: SUMMARY_DAYS, margin: CLOSE_VOTE, few: FEW_VOTES } },
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
	// Actueel in the shared timeline: days, newest first; a decision large with its outcome,
	// a quiet day small.
	const groepen = $derived<TijdGroep[]>(
		[...Map.groupBy(lines, (l) => l.date)].map(([date, ls]) => ({
			id: date,
			titel: dayHeading(date),
			sub: null,
			regels: ls.map((l) => ({
				id: l.id,
				datum: null,
				teken: l.failed
					? 'nee'
					: /aangenomen/i.test(l.label)
						? 'ja'
						: l.major
							? 'stuk'
							: 'activiteit',
				label: l.label,
				zin: l.title,
				meta: l.context,
				href: typeof l.href === 'string' ? l.href : bronHref(l.href),
				ref: typeof l.href === 'string' ? null : l.href,
				groot: l.major
			}))
		}))
	);
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
	<aside class="side">
		<h1>Concordans</h1>
		<p class="what">Wetten, uitspraken en Kamerstukken met hun onderlinge verbindingen.</p>
	</aside>
	<div class="main">
		<div class="search">
			<div class="scopes" role="group" aria-label="Zoek in">
				{#each SCOPES as sc (sc.id)}
					<button
						type="button"
						aria-pressed={scope === sc.id}
						onclick={() => (scope = scope === sc.id ? null : sc.id)}
					>
						<span class="glyphs"
							>{#each sc.tekens as c (c)}<KindGlyph collection={c} size={14} />{/each}</span
						>
						{sc.label}
					</button>
				{/each}
			</div>
			{#key scope}
				<Search
					scope={chosen?.kinds ?? null}
					placeholder={chosen
						? `Zoek in ${chosen.label.toLowerCase()}`
						: 'Zoek een wet, uitspraak, dossier of persoon'}
				/>
			{/key}
			{#if chosen}
				<a class="blader" href={chosen.href}>Of blader door {chosen.label.toLowerCase()} →</a>
			{/if}
		</div>
		<section class="actueel" aria-labelledby="actueel-heading">
			<header>
				<h2 id="actueel-heading"><a href="/actueel">Actueel</a></h2>
				{#if stand}<span class="stand">tot en met {shortDate(stand.newest)}</span>{/if}
			</header>
			<Tijdlijn {groepen} datums={false} />
			<a class="all" href="/actueel">Alles in Actueel →</a>
		</section>
	</div>
</div>

<style>
	/* The same edge and columns as Bladeren (1440, 240 and the rest, gutter 40). */
	.home {
		max-width: 1440px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-8);
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		column-gap: 40px;
		align-items: start;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
	}
	.side h1 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
	}
	.what {
		margin: calc(-1 * var(--s-3)) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.search {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.scopes {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.scopes button {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		padding: var(--s-2) var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	.scopes button[aria-pressed='true'] {
		border-color: var(--ink);
		box-shadow: inset 0 -3px 0 var(--ink);
	}
	.glyphs {
		display: inline-flex;
		gap: 3px;
	}
	.blader {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.main {
		display: flex;
		flex-direction: column;
		gap: var(--s-6);
		min-width: 0;
	}
	.actueel header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: var(--s-3);
	}
	.actueel h2 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 500;
	}
	.actueel h2 a {
		color: var(--ink);
		text-decoration: none;
	}
	@media (max-width: 860px) {
		.home {
			grid-template-columns: 1fr;
			row-gap: var(--s-6);
		}
	}

	.stand {
		font-size: var(--t-micro);
		color: var(--ink-3);
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

	@media (max-width: 640px) {
		.home {
			padding: var(--s-5) var(--s-4) var(--s-8);
		}
		.all {
			padding: var(--s-2) 0;
		}
	}
</style>
