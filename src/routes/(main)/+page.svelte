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
	import { FEW_VOTES, timelineOf, type TimelineLine } from '$lib/components/actueel/timeline';
	import { page } from '$app/state';
	import Tijdlijn from '$lib/components/r4/Tijdlijn.svelte';
	import type { TijdGroep } from '$lib/components/r4/tijdlijn';
	import { bronHref as bronHrefR4 } from '$lib/bron/href';
	import { bronLabel } from '$lib/vocabulary';
	const r4 = $derived(page.url.searchParams.get('ontwerp') === 'r4');
	/** De tekens van de verkenner, met hun naam, zodat ze vóór het netwerk bekend zijn. */
	const TEKENS: Collection[] = ['instruments', 'articles', 'judgments', 'dossiers', 'documents', 'decisions', 'members', 'factions', 'committees', 'cabinets', 'commitments'];

	// Ontwerpstudie ronde 3: ?ontwerp toont een eerste regel over wat Concordans bevat en
	// drie ingangen met aantallen; het halfrond gaat naar Bladeren.
	const ontwerp = $derived(!!page.url.searchParams.get('ontwerp'));
	type Ingang = { label: string; zin: string; href: string };
	let stats = $state<{ wetten: number; uitspraken: number; dossiers: number; wetsvoorstellen: number; open: number } | null>(null);
	$effect(() => {
		if (!ontwerp) return;
		const ac = new AbortController();
		Promise.all([
			unwrap(api.GET('/api/stats', { signal: ac.signal })),
			unwrap(api.GET('/api/dossiers', { params: { query: { status: 'open', kind: 'Wetgeving', limit: 1 } }, signal: ac.signal })),
			unwrap(api.GET('/api/commitments', { params: { query: { status: 'Openstaand', limit: 1 } }, signal: ac.signal }))
		])
			.then(([st, wv, tz]) => {
				const n = st.nodes as Record<string, number>;
				stats = { wetten: n.instruments, uitspraken: n.judgments, dossiers: n.dossiers, wetsvoorstellen: wv.total, open: tz.total };
			})
			.catch(() => {});
		return () => ac.abort();
	});
	const fmt = (n: number) => n.toLocaleString('nl-NL');
	const ingangen = $derived<Ingang[]>(
		stats
			? [
					{ label: 'Wetsvoorstellen', zin: `${fmt(stats.wetsvoorstellen)} in behandeling, met de stand bij Raad van State, Tweede Kamer en Eerste Kamer.`, href: indexHref('dossiers', { track: 'Wetgeving', ontwerp: 'r3' }) },
					{ label: 'Uitspraken', zin: `${fmt(stats.uitspraken)} uitspraken, met de wetsartikelen die ze aanhalen.`, href: indexHref('judgments') },
					{ label: 'Regering', zin: `Kabinet-Jetten: bewindspersonen en ${fmt(stats.open)} openstaande toezeggingen.`, href: indexHref('commitments', { status: 'Openstaand' }) }
				]
			: []
	);

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
	// Actueel als gedeelde tijdlijn: dagen, nieuwste eerst; een besluit groot met zijn vakje,
	// een rustige dag klein.
	const groepen = $derived<TijdGroep[]>(
		[...Map.groupBy(lines, (l) => l.date)].map(([date, ls]) => ({
			id: date,
			titel: dayHeading(date),
			sub: null,
			regels: ls.map((l) => ({
				id: l.id,
				datum: null,
				teken: l.failed ? 'nee' : /aangenomen/i.test(l.label) ? 'ja' : l.major ? 'stuk' : 'activiteit',
				label: l.label,
				zin: l.title,
				meta: l.context,
				href: typeof l.href === 'string' ? l.href : bronHrefR4(l.href),
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

{#if r4}
<div class="r4-home">
	<aside class="r4-links">
		<h1>Concordans</h1>
		<p class="r4-wat">
			Nederlandse wetten, uitspraken en Kamerstukken met hun onderlinge verbindingen{#if stats}:
				{fmt(stats.wetten)} wetten en verdragen, {fmt(stats.uitspraken)} uitspraken, {fmt(stats.dossiers)} Kamerdossiers{/if}.
		</p>
		<nav class="r4-ing" aria-label="Ingangen">
			{#each ingangen as g (g.label)}
				<a href={g.href}><span class="l">{g.label}</span><span class="z">{g.zin}</span></a>
			{/each}
		</nav>
		<section class="r4-tekens" aria-labelledby="tekens-kop">
			<h2 id="tekens-kop">Tekens in de verkenner</h2>
			<ul>
				{#each TEKENS as c (c)}<li><KindGlyph collection={c} />{bronLabel(c)}</li>{/each}
			</ul>
		</section>
	</aside>
	<div class="r4-rechts">
		<Search />
		<section class="r4-actueel" aria-labelledby="r4-actueel-kop">
			<header>
				<h2 id="r4-actueel-kop"><a href="/actueel">Actueel</a></h2>
				{#if stand}<span class="stand">tot en met {shortDate(stand.newest)}</span>{/if}
			</header>
			<Tijdlijn {groepen} datums={false} />
			<a class="all" href="/actueel">Alles in Actueel →</a>
		</section>
	</div>
</div>
{:else}
<div class="home">
	{#if ontwerp}
		<div class="r3-intro">
			<h1>Concordans</h1>
			<p>
				Nederlandse wetten, uitspraken en Kamerstukken met hun onderlinge verbindingen{#if stats}:
					{fmt(stats.wetten)} wetten en verdragen, {fmt(stats.uitspraken)} uitspraken, {fmt(stats.dossiers)} Kamerdossiers{/if}.
			</p>
		</div>
	{:else}
		<h1 class="sr-only">Concordans</h1>
	{/if}

	<div class="intro">
		<Search />
	</div>
	{#if ontwerp && ingangen.length}
		<nav class="r3-ingangen" aria-label="Ingangen">
			{#each ingangen as g (g.label)}
				<a href={g.href}><span class="l">{g.label}</span><span class="z">{g.zin}</span></a>
			{/each}
		</nav>
	{/if}

	<div class="browse" class:r3-hide={ontwerp}>
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

		{#if seats && !ontwerp}
			<aside class="kamer" aria-labelledby="kamer-heading">
				<h2 id="kamer-heading" class="kamer-title">Tweede Kamer</h2>
				<div class="hemi-wrap">
					<Hemicycle data={seats} />
				</div>
			</aside>
		{/if}
	</div>
</div>
{/if}

<style>
	/* Ronde 4: dezelfde rand en kolommen als Bladeren (1440, 240 + rest, goot 40). */
	.r4-home {
		max-width: 1440px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-8);
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		column-gap: 40px;
		align-items: start;
	}
	.r4-links {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
	}
	.r4-links h1 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
	}
	.r4-wat {
		margin: calc(-1 * var(--s-3)) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.r4-ing {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
	}
	.r4-ing a {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding-top: var(--s-2);
		border-top: 2px solid var(--ink);
		color: var(--ink);
		text-decoration: none;
	}
	.r4-ing .l {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
	}
	.r4-ing a:hover .l {
		color: var(--accent);
	}
	.r4-ing .z {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.r4-tekens h2 {
		margin: 0 0 var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
	}
	.r4-tekens ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-1) var(--s-3);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.r4-tekens li {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.r4-rechts {
		display: flex;
		flex-direction: column;
		gap: var(--s-6);
		min-width: 0;
	}
	.r4-actueel header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: var(--s-3);
	}
	.r4-actueel h2 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 500;
	}
	.r4-actueel h2 a {
		color: var(--ink);
		text-decoration: none;
	}
	@media (max-width: 860px) {
		.r4-home {
			grid-template-columns: 1fr;
			row-gap: var(--s-6);
		}
	}

	.r3-intro {
		max-width: 720px;
		margin: 0 auto var(--s-5);
	}
	.r3-intro h1 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
		color: var(--ink);
	}
	.r3-intro p {
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.r3-ingangen {
		max-width: 720px;
		margin: var(--s-5) auto 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-4);
	}
	.r3-ingangen a {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding-top: var(--s-2);
		border-top: 2px solid var(--ink);
		text-decoration: none;
		color: var(--ink);
	}
	.r3-ingangen a:hover .l {
		color: var(--accent);
	}
	.r3-ingangen .l {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
	}
	.r3-ingangen .z {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
		line-height: var(--lh-snug);
	}
	.r3-hide {
		display: none;
	}
	@media (max-width: 640px) {
		.r3-ingangen {
			grid-template-columns: 1fr;
		}
	}

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
