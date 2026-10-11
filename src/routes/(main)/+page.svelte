<script lang="ts">
	import { vandaag } from '$lib/text/datum';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import Search from '$lib/search/Search.svelte';
	import { api, unwrap } from '$lib/api/client';
	import { API_BASE_URL } from '$lib/api/base-url';
	import { bronHref } from '$lib/bron/href';
	import type { Collection } from '$lib/vocabulary';
	import { dayLabel, CLOSE_VOTE } from '$lib/components/actueel/feed';
	import {
		FEW_VOTES,
		tekenVan,
		timelineOf,
		type TimelineLine
	} from '$lib/components/actueel/timeline';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import { inhoudVan } from '$lib/components/open/rij-inhoud';
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
	}[] = [
		{
			id: 'wetten',
			label: 'Wetten',
			kinds: ['instruments', 'articles'],
			tekens: ['instruments', 'articles']
		},
		{
			id: 'uitspraken',
			label: 'Uitspraken',
			kinds: ['judgments'],
			tekens: ['judgments']
		},
		{
			id: 'parlement',
			label: 'Parlement',
			kinds: ['dossiers', 'documents', 'decisions', 'members', 'factions', 'committees'],
			tekens: ['dossiers', 'documents', 'decisions', 'members']
		},
		{
			id: 'kabinet',
			label: 'Kabinet',
			kinds: ['cabinets', 'members', 'commitments'],
			tekens: ['cabinets', 'members', 'commitments']
		}
	];
	let scope = $state<string | null>(null);
	const chosen = $derived(SCOPES.find((x) => x.id === scope) ?? null);
	/** On a phone the scopes a step smaller and without their marks: five words fit. */
	const smal = new MediaQuery('width <= 600px');

	/** The lines of Actueel shown; the rest is in Actueel. */
	const LINES_SHOWN = 10;
	/** The days the summary spans: enough for the lines on a quiet week. */
	const SUMMARY_DAYS = 14;
	/**
	 * Events the summary gives one by one: three for each line shown, room for a busy day
	 * whose lines fold several. Its counts per day come whatever this is; the band of the
	 * law network asks older votes itself where these hold no passed bill (laadWetsnetwerk).
	 */
	const SUMMARY_ITEMS = 3 * LINES_SHOWN;

	const today = vandaag();

	let lines = $state<TimelineLine[]>([]);
	/** Actueel's first answer: under way, in, or failed. A phone waits seconds for it. */
	let actueelStaat = $state<'laden' | 'klaar' | 'fout'>('laden');
	/** The network of the last passed bill: after Actueel is on screen; none on an error. */
	let wetsnetwerk = $state<Schets | null>(null);
	/** Its place stands while it is asked, so Actueel under it does not drop (0.16 of layout
	 *  shift live, 10 Oct); it closes only where there is no bill to show. */
	let wetsnetwerkLaden = $state(true);

	$effect(() => {
		const ac = new AbortController();
		loadLines(ac.signal).catch(() => {
			if (!ac.signal.aborted) {
				actueelStaat = 'fout';
				wetsnetwerkLaden = false;
			}
		});
		return () => ac.abort();
	});

	/** The last days in one answer: their counts and the events that stand alone. */
	async function loadLines(signal: AbortSignal) {
		const summary = await unwrap(
			api.GET('/api/feed/summary', {
				params: {
					query: {
						until: today,
						days: SUMMARY_DAYS,
						margin: CLOSE_VOTE,
						few: FEW_VOTES,
						limit: SUMMARY_ITEMS
					}
				},
				signal
			})
		);
		lines = timelineOf(summary, LINES_SHOWN);
		actueelStaat = 'klaar';
		// The network waits until Actueel is drawn and the browser is idle.
		await tick();
		await idle();
		if (signal.aborted) return;
		wetsnetwerk = await laadWetsnetwerk(summary.items ?? [], today, signal).catch(() => null);
		if (!signal.aborted) wetsnetwerkLaden = false;
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
				teken: tekenVan(l),
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

<RouteKop pad="/" />

{#snippet inhoud(id: string)}
	{@const item = lines.find((l) => l.id === id)?.item}
	{#if item}<RijInhoud {item} />{/if}
{/snippet}

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
			<!-- Where to search: one choice of five, a Keuze as everywhere (Thijs, 10 Oct); Alles
			     searches all of it. -->
			<div class="scopes">
				<Keuze
					label="Zoek in"
					opties={[
						{ waarde: 'alles', label: 'Alles' },
						...SCOPES.map((sc) => ({ waarde: sc.id, label: sc.label }))
					]}
					waarde={scope ?? 'alles'}
					onKies={(w) => (scope = w === 'alles' ? null : w)}
					klein={smal.current}
				>
					{#snippet voor(w)}
						{@const sc = SCOPES.find((x) => x.id === w)}
						{#if sc && !smal.current}<span class="glyphs"
								>{#each sc.tekens as c (c)}<KindGlyph collection={c} size={12} />{/each}</span
							>{/if}
					{/snippet}
				</Keuze>
			</div>
			{#key scope}
				<Search
					scope={chosen?.kinds ?? null}
					placeholder={chosen
						? `Zoek in ${chosen.label.toLowerCase()}`
						: 'Zoek een wet, uitspraak of dossier'}
				/>
			{/key}
		</div>
		{#if wetsnetwerk}<Wetsnetwerk schets={wetsnetwerk} />{:else if wetsnetwerkLaden}<div
				class="wetsnetwerk-plek"
				aria-hidden="true"
			></div>{/if}
		<section class="actueel" aria-labelledby="actueel-heading">
			<header>
				<h2 id="actueel-heading"><a href="/actueel">Actueel</a></h2>
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
	/* The band's height while it is asked (1440: 366 px; a phone: 274 px), its frame quiet. */
	.wetsnetwerk-plek {
		min-height: 366px;
		border-radius: var(--r-1);
		background: var(--paper-2);
	}
	@media (max-width: 640px) {
		.wetsnetwerk-plek {
			min-height: 274px;
		}
	}
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
		color: var(--ink);
		border-color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
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
