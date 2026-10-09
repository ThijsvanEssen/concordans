<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Search from '$lib/search/Search.svelte';
	import { api, unwrap } from '$lib/api/client';
	import { API_BASE_URL } from '$lib/api/base-url';
	import { bronHref, indexHref } from '$lib/bron/href';
	import type { Collection } from '$lib/vocabulary';
	import { dayLabel, feedStand, CLOSE_VOTE, shortDate } from '$lib/components/actueel/feed';
	import { FEW_VOTES, timelineOf, type TimelineLine } from '$lib/components/actueel/timeline';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import Wetsnetwerk from '$lib/components/actueel/Wetsnetwerk.svelte';
	import { laadWetsnetwerk, type Schets } from '$lib/components/actueel/wetsnetwerk';
	import { tick } from 'svelte';
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
			kinds: ['dossiers', 'documents', 'decisions', 'members', 'factions', 'committees'],
			tekens: ['dossiers', 'documents', 'decisions', 'members'],
			href: indexHref('dossiers', { track: 'Wetgeving' })
		},
		{
			id: 'kabinet',
			label: 'Kabinet',
			kinds: ['cabinets', 'members', 'commitments'],
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
	/** Actueel's first answer: under way, in, or failed. A phone waits seconds for it. */
	let actueelStaat = $state<'laden' | 'klaar' | 'fout'>('laden');
	/** The network of the last passed bill: after Actueel is on screen; none on an error. */
	let wetsnetwerk = $state<Schets | null>(null);

	$effect(() => {
		const ac = new AbortController();
		loadLines(ac.signal).catch(() => {
			if (!ac.signal.aborted) actueelStaat = 'fout';
		});
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
		actueelStaat = 'klaar';
		// The network waits until Actueel is drawn and the browser is idle.
		await tick();
		await idle();
		if (signal.aborted) return;
		wetsnetwerk = await laadWetsnetwerk(summary.items ?? [], today, signal).catch(() => null);
	}

	const idle = () =>
		new Promise<void>((done) =>
			'requestIdleCallback' in window
				? requestIdleCallback(() => done(), { timeout: 2000 })
				: setTimeout(done, 200)
		);

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
				vorm: l.vorm,
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

<RouteKop pad="/" />

<svelte:head>
	<link
		rel="alternate"
		type="application/atom+xml"
		title="Actueel"
		href="{API_BASE_URL}/api/feed.atom"
	/>
</svelte:head>

<div class="home blad blad__indeling">
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
						: 'Zoek een wet, uitspraak of dossier'}
				/>
			{/key}
			{#if chosen}
				<a class="blader" href={chosen.href}>Of blader door {chosen.label.toLowerCase()} →</a>
			{/if}
		</div>
		{#if wetsnetwerk}<Wetsnetwerk schets={wetsnetwerk} />{/if}
		<section class="actueel" aria-labelledby="actueel-heading">
			<header>
				<h2 id="actueel-heading"><a href="/actueel">Actueel</a></h2>
				<!-- How far the Kamers' data goes, and when it was fetched: a date days back is then
				     the source's, not a page left standing. -->
				{#if stand}<span class="stand"
						>tot en met {shortDate(stand.newest)}{stand.retrievedAt
							? `, opgehaald ${shortDate(stand.retrievedAt.slice(0, 10))}`
							: ''}</span
					>{/if}
			</header>
			{#if actueelStaat === 'laden'}
				<div class="laden" aria-hidden="true">
					{#each [0, 1, 2] as i (i)}
						<div class="laden__regel">
							<span class="balk balk--kort"></span>
							<span class="balk"></span>
						</div>
					{/each}
				</div>
				<p class="sr-only" role="status">Actueel laden</p>
			{:else if actueelStaat === 'fout'}
				<p class="fout">Actueel kon niet worden geladen.</p>
			{/if}
			<Tijdlijn {groepen} datums={false} />
			<a class="all" href="/actueel">Alles in Actueel →</a>
		</section>
	</div>
</div>

<style>
	/* The frame and grid of Bladeren (AppShell). */
	.side {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
	}
	.side h1 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 600;
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
		font-family: var(--font-ui);
		font-size: var(--t-ui);
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
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.main {
		display: flex;
		flex-direction: column;
		gap: var(--s-6);
		min-width: 0;
	}
	/* The heading and how far the data goes; on a narrow screen the line under the heading. */
	.actueel header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-1) var(--s-3);
		margin-bottom: var(--s-3);
	}
	.actueel h2 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 800;
	}
	.actueel h2 a {
		color: var(--ink);
		text-decoration: none;
	}
	@media (max-width: 768px) {
		.home {
			row-gap: var(--s-6);
		}
	}

	.stand {
		/* Whole, or on its own line: never squeezed beside the heading. */
		flex: 0 1 auto;
		min-width: 16rem;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.all {
		align-self: flex-start;
		margin-top: var(--s-5);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid var(--ink);
	}
	.all:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	@media (max-width: 640px) {
		.all {
			padding: var(--s-2) 0;
		}
	}

	/* While Actueel loads: a few quiet lines where the timeline will stand. */
	.laden {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
		padding: var(--s-3) 0;
	}
	.laden__regel {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.balk {
		display: block;
		height: var(--s-3);
		width: 80%;
		border-radius: var(--r-1);
		background: var(--paper-2);
	}
	.balk--kort {
		width: 30%;
	}
	.fout {
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
</style>
