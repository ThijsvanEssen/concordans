<script lang="ts">
	import { vandaag } from '$lib/text/datum';
	import { report } from '$lib/api/errors';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import Search from '$lib/search/Search.svelte';
	import { getFeedSummary } from '$lib/api/feed';
	import { bronHref } from '$lib/bron/href';
	import type { Collection } from '$lib/vocabulary';
	import { atomHref, dayLabel, CLOSE_VOTE } from '$lib/components/actueel/feed';
	import { FEW_VOTES, timelineOf, type TimelineLine } from '$lib/components/actueel/home-stream';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import { inhoudVan } from '$lib/components/open/rij-inhoud';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import Wetsnetwerk from '$lib/components/actueel/Wetsnetwerk.svelte';
	import { laadWetsnetwerk, type Schets } from '$lib/components/actueel/wetsnetwerk';
	import { tick } from 'svelte';
	import { HOME_SUMMARY } from '$lib/api/first-pages';
	import type { TijdGroep } from '$lib/components/tijdlijn/tijdlijn';
	import { page } from '$app/state';
	import Entrances from '$lib/components/home/Entrances.svelte';

	// Four ways in to search, each with the glyphs of what it holds.
	const SCOPES: {
		id: string;
		label: string;
		kinds: string[];
		marks: Collection[];
	}[] = [
		{
			id: 'wetten',
			label: 'Wetten',
			kinds: ['instruments', 'articles'],
			marks: ['instruments', 'articles']
		},
		{
			id: 'uitspraken',
			label: 'Uitspraken',
			kinds: ['judgments'],
			marks: ['judgments']
		},
		{
			id: 'parlement',
			label: 'Parlement',
			kinds: ['dossiers', 'documents', 'decisions', 'members', 'factions', 'committees'],
			marks: ['dossiers', 'documents', 'decisions', 'members']
		},
		{
			id: 'kabinet',
			label: 'Kabinet',
			kinds: ['cabinets', 'members', 'commitments'],
			marks: ['cabinets', 'members', 'commitments']
		}
	];
	/** Alle bronnen: the first mark of each way in, in the same order. */
	const ALL_MARKS: Collection[] = SCOPES.map((sc) => sc.marks[0]);
	let scope = $state<string | null>(null);
	const chosen = $derived(SCOPES.find((x) => x.id === scope) ?? null);
	/** On a phone the scopes a step smaller and without their marks: five words fit, as wide
	 *  as the field under them. */
	const narrow = new MediaQuery('width <= 600px');
	/** Below a phone of 360: Alles for Alle bronnen, so Kabinet keeps its place in the row. */
	const narrowest = new MediaQuery('width < 360px');

	/** The lines of Actueel shown; the rest is in Actueel. */
	const LINES_SHOWN = 6;

	/** The query in the field from ?q=: a shared search, the SearchAction of the server's page. */
	const query = page.url.searchParams.get('q') ?? '';
	/** The days the summary spans: enough for the lines on a quiet week (first-pages.json). */
	const SUMMARY_DAYS = HOME_SUMMARY.days;
	/**
	 * Events the summary gives one by one: three for each line shown, room for a busy day
	 * whose lines fold several. Its counts per day come whatever this is; the band of the
	 * law network asks older votes itself where these hold no passed bill (laadWetsnetwerk).
	 */
	const SUMMARY_ITEMS = HOME_SUMMARY.limit;

	const today = vandaag();

	let lines = $state<TimelineLine[]>([]);
	/** Actueel's first answer: under way, in, or failed. A phone waits seconds for it. */
	let feedState = $state<'laden' | 'klaar' | 'fout'>('laden');
	/** The network of the last passed bill: after Actueel is on screen; none on an error. */
	let lawNetwork = $state<Schets | null>(null);
	/** Its place stands while it is asked, so Actueel under it does not drop (0.16 of layout
	 *  shift live, 10 Oct); it closes only where there is no bill to show. */
	let networkLoading = $state(true);

	$effect(() => {
		const ac = new AbortController();
		loadLines(ac.signal).catch(() => {
			if (!ac.signal.aborted) {
				feedState = 'fout';
				networkLoading = false;
			}
		});
		return () => ac.abort();
	});

	/** The last days in one answer: their counts and the events that stand alone. */
	async function loadLines(signal: AbortSignal) {
		const summary = await getFeedSummary(
			{
				until: today,
				days: SUMMARY_DAYS,
				margin: CLOSE_VOTE,
				few: FEW_VOTES,
				limit: SUMMARY_ITEMS
			},
			signal
		);
		lines = timelineOf(summary, LINES_SHOWN);
		feedState = 'klaar';
		// The network waits until Actueel is drawn and the browser is idle.
		await tick();
		await idle();
		if (signal.aborted) return;
		lawNetwork = await laadWetsnetwerk(summary.items ?? [], today, signal).catch((e) => {
			report('Wetsnetwerk', e);
			return null;
		});
		if (!signal.aborted) networkLoading = false;
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
	const groups = $derived<TijdGroep[]>(
		[...Map.groupBy(lines, (l) => l.date)].map(([date, ls]) => ({
			id: date,
			titel: dayHeading(date),
			sub: null,
			regels: ls.map((l) => ({
				id: l.id,
				datum: null,
				teken: l.teken,
				vorm: l.vorm,
				label: l.label,
				zin: l.title,
				meta: l.context,
				href: typeof l.href === 'string' ? l.href : bronHref(l.href),
				ref: typeof l.href === 'string' ? null : l.href,
				groot: l.major,
				// A line of one event with content of its own opens it in place, as in Actueel.
				inhoud: l.item && inhoudVan(l.item) ? inhoud : null
			}))
		}))
	);
</script>

<RouteKop />

{#snippet inhoud(id: string)}
	{@const item = lines.find((l) => l.id === id)?.item}
	{#if item}<RijInhoud {item} />{/if}
{/snippet}

<svelte:head>
	<link rel="alternate" type="application/atom+xml" title="Actueel" href={atomHref({})} />
</svelte:head>

<div class="home blad">
	<header class="blad__kop intro">
		<h1 class="blad__titel">Wetten, uitspraken en Kamerstukken in samenhang</h1>
		<p class="lead">
			Concordans is een onderzoeksinstrument dat parlementaire informatie verbindt met wetgeving,
			officiële publicaties en rechtspraak, om inzicht te geven in de samenhang rond een onderwerp.
			Het dient als eenvoudige wettenlezer, met de geldende en eerdere versies van elk artikel, en
			als werkplaats voor eigen onderzoek. Wat gevonden is, kan in een bundel worden bewaard en
			geordend.
		</p>
	</header>
	<div class="main">
		<div class="search">
			<!-- Where to search: one choice of five, a Keuze as everywhere (Thijs, 10 Oct); Alle
			     bronnen searches all of it, with a mark of each. As wide as the field under it. -->
			<div class="scopes">
				<Keuze
					label="Zoek in"
					vol
					opties={[
						{ waarde: 'alles', label: narrowest.current ? 'Alles' : 'Alle bronnen' },
						...SCOPES.map((sc) => ({ waarde: sc.id, label: sc.label }))
					]}
					waarde={scope ?? 'alles'}
					onSelect={(w) => (scope = w === 'alles' ? null : w)}
					klein={narrow.current}
				>
					{#snippet voor(w)}
						{@const marks = w === 'alles' ? ALL_MARKS : SCOPES.find((x) => x.id === w)?.marks}
						{#if marks && !narrow.current}<span class="glyphs"
								>{#each marks as c (c)}<KindGlyph collection={c} size={12} />{/each}</span
							>{/if}
					{/snippet}
				</Keuze>
			</div>
			<!-- One field for every scope: a scope chosen asks the typed query again. -->
			<Search
				scope={chosen?.kinds ?? null}
				initial={query}
				placeholder={chosen
					? `Zoek in ${chosen.label.toLowerCase()}`
					: 'Zoek een artikel, uitspraak of motie'}
			/>
		</div>
		{#if lawNetwork}<Wetsnetwerk schets={lawNetwork} />{:else if networkLoading}<div
				class="wetsnetwerk-plek"
				aria-hidden="true"
			></div>{/if}
		<Entrances />
		<section class="actueel" aria-labelledby="actueel-heading">
			<header>
				<h2 id="actueel-heading"><a href="/actueel">Actueel</a></h2>
			</header>
			{#if feedState === 'laden'}
				<div class="laden" aria-hidden="true">
					{#each [0, 1, 2] as i (i)}
						<div class="laden__regel">
							<span class="balk balk--kort"></span>
							<span class="balk"></span>
						</div>
					{/each}
				</div>
				<p class="sr-only" role="status">Actueel laden</p>
			{:else if feedState === 'fout'}
				<p class="fout">Actueel kon niet worden geladen.</p>
			{/if}
			<Tijdlijn groepen={groups} datums={false} />
			<p class="all"><a href="/actueel">Alles in Actueel →</a></p>
		</section>
	</div>
</div>

<style>
	/* The band's height while it is asked (1440: 366 px; a phone: 264 px), its frame quiet. */
	.wetsnetwerk-plek {
		min-height: 366px;
		border-radius: var(--r-1);
		background: var(--paper-2);
	}
	@media (max-width: 640px) {
		.wetsnetwerk-plek {
			min-height: 264px;
		}
	}
	/* The frame of Bladeren (lib/styles/frame.css), one column the full width. */
	/* What Concordans is, in a reading width under the heading. */
	.lead {
		flex-basis: 100%;
		max-width: var(--blad-tekst);
		margin: calc(-1 * var(--s-2)) 0 0;
		font-size: var(--t-body-2);
		line-height: var(--lh-body);
		color: var(--ink-2);
	}
	.search {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.scopes {
		max-width: 100%;
	}
	.glyphs {
		display: inline-flex;
		gap: 3px;
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
		font-size: var(--t-h2);
		font-weight: 800;
	}
	.actueel h2 a {
		color: var(--ink);
		text-decoration: none;
	}
	/* On a line of its own under the timeline, at the right, as Open in Samenhang. */
	.all {
		display: flex;
		justify-content: flex-end;
		margin: var(--s-5) 0 0;
		font-size: var(--t-meta);
	}
	.all a {
		font-weight: 600;
		color: var(--ink);
	}
	@media (max-width: 640px) {
		.all a {
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
