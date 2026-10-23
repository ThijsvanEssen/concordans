<script lang="ts">
	import { vandaag } from '$lib/text/datum';
	import { report } from '$lib/api/errors';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import Search from '$lib/search/Search.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
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
	import { afterNavigate } from '$app/navigation';
	import Entrances from '$lib/components/home/Entrances.svelte';
	import NetworkEntry from '$lib/components/home/NetworkEntry.svelte';
	import { START } from '$lib/components/home/start';
	import { takeServerField } from '$lib/seo/server-text';
	import { SEARCH_FRAGMENT } from '$lib/seo/moved';

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
			label: 'Regering',
			kinds: ['cabinets', 'members', 'commitments'],
			marks: ['cabinets', 'members', 'commitments']
		}
	];
	/** Alle bronnen: the first mark of each way in, in the same order. */
	const ALL_MARKS: Collection[] = SCOPES.map((sc) => sc.marks[0]);
	let scope = $state<string | null>(null);
	const chosen = $derived(SCOPES.find((x) => x.id === scope) ?? null);

	/** The lines of Actueel shown; the rest is in Actueel. */
	const LINES_SHOWN = 6;

	/** The query in the field from ?q=: a shared search, the SearchAction of the server's page;
	 *  or what was typed in the server's field before the app came, with its focus. */
	const typed = takeServerField();
	const query = page.url.searchParams.get('q') || typed.query;
	// After the first navigation, which sets the focus on the page itself: on the field, or
	// on the link the reader had reached in the server's page; on the field too for `/#zoeken`
	// (where /zoeken goes, $lib/seo/moved.ts).
	afterNavigate(() => {
		const { link } = typed;
		const focused = typed.focused || page.url.hash === `#${SEARCH_FRAGMENT}`;
		typed.focused = false;
		typed.link = null;
		if (link) {
			const to = [...document.querySelectorAll<HTMLAnchorElement>('main a[href]')];
			to.find((a) => a.getAttribute('href') === link)?.focus();
		} else if (focused) {
			const field = document.querySelector<HTMLInputElement>('main [data-search-field]');
			field?.focus();
			field?.setSelectionRange(field.value.length, field.value.length);
		}
	});
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
	/** Why Actueel failed: slow or broken, for LoadState. */
	let feedError = $state.raw<unknown>(null);
	/** Opnieuw after a failure: Actueel asked again. */
	let retries = $state(0);
	/** The network of the last passed bill: after Actueel is on screen; none on an error. */
	let lawNetwork = $state<Schets | null>(null);
	/** Its place stands while it is asked, so Actueel under it does not drop (0.16 of layout
	 *  shift live, 10 Oct); it closes only where there is no bill to show. */
	let networkLoading = $state(true);

	$effect(() => {
		void retries;
		const ac = new AbortController();
		loadLines(ac.signal).catch((e) => {
			if (!ac.signal.aborted) {
				report('Actueel', e);
				feedError = e;
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
		<h1 class="blad__titel">{START.heading}</h1>
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
						// Its words in `voor`: Alles below a phone of 360 (CSS, from the first paint).
						{ waarde: 'alles', label: '' },
						...SCOPES.map((sc) => ({ waarde: sc.id, label: sc.label }))
					]}
					waarde={scope ?? 'alles'}
					onSelect={(w) => (scope = w === 'alles' ? null : w)}
				>
					{#snippet voor(w)}
						{@const marks = w === 'alles' ? ALL_MARKS : SCOPES.find((x) => x.id === w)?.marks}
						{#if marks}<span class="glyphs"
								>{#each marks as c (c)}<KindGlyph collection={c} size={12} />{/each}</span
							>{/if}{#if w === 'alles'}<span class="lang">Alle bronnen</span><span class="kort"
								>Alles</span
							>{/if}
					{/snippet}
				</Keuze>
			</div>
			<!-- One field for every scope: a scope chosen asks the typed query again. -->
			<Search
				scope={chosen?.kinds ?? null}
				onWiden={() => (scope = null)}
				initial={query}
				placeholder={chosen ? `Zoek in ${chosen.label.toLowerCase()}` : START.placeholder}
			/>
		</div>
		{#if lawNetwork}<Wetsnetwerk schets={lawNetwork} />{:else if networkLoading}<div
				class="wetsnetwerk-plek"
				aria-hidden="true"
			></div>{/if}
		<Entrances />
		<NetworkEntry />
		<section class="actueel" aria-labelledby="actueel-heading">
			<header>
				<h2 id="actueel-heading"><a class="raakvlak" href="/actueel">Actueel</a></h2>
				<p class="volger">Wat de Kamer en de rechter met de wet doen</p>
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
				<LoadState
					state={{ status: 'error', error: feedError }}
					what="Actueel"
					retry={() => {
						feedState = 'laden';
						retries++;
					}}
				/>
			{/if}
			<Tijdlijn groepen={groups} datums={false} />
			<p class="all"><a class="raakvlak" href="/actueel">Alles in Actueel →</a></p>
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
	.search {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.scopes {
		max-width: 100%;
	}
	/* The field is the first aim of the page, so it is the heaviest frame on it: 2 px of ink
	   (a border and an inset line, so the height stays as the server's page has it). */
	.search :global(.field) {
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
	}
	.search :global(.field:focus-within) {
		border-color: var(--ink);
	}
	.glyphs {
		display: inline-flex;
		gap: 3px;
	}
	.kort {
		display: none;
	}
	/* On a phone the scopes without their marks: five words fit, as wide as the field under
	   them. In CSS, so the first paint has it (UX-toets). */
	@media (width <= 600px) {
		.glyphs {
			display: none;
		}
	}
	/* Below a phone of 360: Alles for Alle bronnen, so Regering keeps its place in the row. */
	@media (width < 360px) {
		.lang {
			display: none;
		}
		.kort {
			display: inline;
		}
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
		font-weight: 600;
	}
	.volger {
		margin: 0;
		font-size: var(--t-meta);
		color: var(--ink-3);
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
</style>
