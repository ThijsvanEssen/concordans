<script lang="ts">
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import Bepaalregel from '$lib/components/ui/Bepaalregel.svelte';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	// Gevolgde onderwerpen: per topic what came into Actueel since the visit before. The topics
	// are kept in this browser; an address with `?onderwerp=` shows someone else's without
	// touching the own list, and can be followed in one step.
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api/client';
	import { API_BASE_URL } from '$lib/api/base-url';
	import FeedDay from '$lib/components/actueel/FeedDay.svelte';
	import { partyColor } from '$lib/utils/party-color.svelte';
	import {
		daysOf,
		dagVoor,
		doorzochtVanaf,
		feedStand,
		normalizeItem,
		shortDate,
		type FeedItem
	} from '$lib/components/actueel/feed';
	import {
		deelAdres,
		isNieuw,
		lees,
		nieuwBezoek,
		haalTermWeg,
		naarParam,
		normaal,
		ontvolg,
		splitsTermen,
		uitParams,
		RECENT_DAGEN,
		vensterVan,
		voegTermenToe,
		volg,
		zetGezien,
		type Onderwerp
	} from '$lib/onderwerpen/onderwerpen';
	import { vandaag } from '$lib/text/datum';
	import { getMinistries } from '$lib/components/explore/index/government';

	/** Lines per topic, as the feed gives at most in one page. */
	const PER_ONDERWERP = 100;
	/** Lines shown of a topic before `Alle … tonen`. */
	const EERST = 10;
	/** The API's own limit on a slow query. */
	const WACHT = 30_000;

	const today = vandaag();
	const dagenTerug = (n: number) =>
		new Date(Date.parse(today) - n * 86_400_000).toISOString().slice(0, 10);

	const gedeeld = $derived(uitParams(page.url.searchParams));
	let eigen = $state<Onderwerp[]>([]);
	let geladen = $state(false);
	$effect(() => {
		eigen = nieuwBezoek(lees());
		geladen = true;
	});
	const lijst = $derived<Onderwerp[]>(
		gedeeld.length ? gedeeld.map((termen) => ({ termen, vorige: null, gezien: null })) : eigen
	);

	type Stand = {
		status: 'laden' | 'klaar' | 'fout';
		items: FeedItem[];
		meer: boolean;
		/** The first day searched, when the API stopped short (0.79.28). */
		doorzocht: string | null;
	};
	let standen = $state<Record<string, Stand>>({});
	let uitgeklapt = $state<Record<string, boolean>>({});
	const sleutel = (o: Pick<Onderwerp, 'termen'>) => o.termen.join('|').toLowerCase();
	// A shared topic asks another window than an own one with the same words.
	const vak = (o: Pick<Onderwerp, 'termen'>) => (gedeeld.length ? 'gedeeld:' : '') + sleutel(o);
	const recent = dagenTerug(RECENT_DAGEN);
	const vanaf = (o: Onderwerp) => vensterVan(o.vorige, recent);

	/** One request per word, at most two at a time (the API's limit per address). */
	async function laadAlles(
		onderwerpen: Onderwerp[],
		signal: AbortSignal,
		/** Further back: up to this day, on top of the lines already there. */
		verder?: { tot: string; items: FeedItem[] }
	) {
		// One question per topic with all its words (repeated q, API 0.79.30): the API finds
		// a line that holds any of them, once, by the same word rule as woordIn here.
		const taken = [...onderwerpen];
		const werk = async () => {
			for (let o = taken.shift(); o && !signal.aborted; o = taken.shift()) {
				const k = vak(o);
				const items = new Map((verder?.items ?? []).map((i) => [i.id, i]));
				let meer = false;
				let doorzocht: string | null = null;
				let gelukt = true;
				try {
					const r = await unwrap(
						api.GET('/api/feed', {
							params: {
								query: {
									q: o.termen,
									since: vanaf(o),
									...(verder ? { until: verder.tot } : {}),
									limit: PER_ONDERWERP,
									facets: false
								}
							},
							signal: AbortSignal.any([signal, AbortSignal.timeout(WACHT)])
						})
					);
					for (const raw of r.items) {
						const i = normalizeItem(raw);
						items.set(i.id, i);
					}
					if (!verder) {
						const stand = feedStand(r.data_as_of);
						if (stand && !gedeeld.length) zetGezien(o.termen[0], stand.newest);
					}
					// Searched only from a day on: the rest is a question further back.
					doorzocht = doorzochtVanaf(r);
					meer = !doorzocht && !!r.next_cursor;
				} catch {
					if (signal.aborted) return;
					gelukt = false;
				}
				standen[k] = {
					status: !gelukt && !items.size ? 'fout' : 'klaar',
					items: [...items.values()].sort(
						(a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
					),
					meer,
					doorzocht
				};
			}
		};
		await Promise.all([werk(), werk()]);
	}

	// Only a topic not loaded yet: following or dropping one leaves the others standing.
	// Requests end with the page.
	const ac = new AbortController();
	$effect(() => () => ac.abort());
	$effect(() => {
		if (!geladen) return;
		const nieuw = lijst.filter((o) => !untrack(() => standen[vak(o)]));
		if (!nieuw.length) return;
		for (const o of nieuw)
			standen[vak(o)] = { status: 'laden', items: [], meer: false, doorzocht: null };
		void laadAlles(
			nieuw.map((o) => ({ ...o, termen: [...o.termen] })),
			ac.signal
		);
	});

	/** The row opened in place, as on Actueel. */
	let openId = $state<string | null>(null);

	// The ministry of a row by its name, as Actueel shows it (UX-toets 10 Oct: "venw", "fin").
	// One request for both pages (getMinistries is asked once).
	let ministries = $state<{ key: string; name?: string | null }[]>([]);
	$effect(() => {
		getMinistries()
			.then((m) => (ministries = m))
			.catch(() => {});
	});
	const ministryName = (key: string | null | undefined) =>
		(key && ministries.find((m) => m.key === key)?.name) || key || '';

	let verderBezig = $state<string | null>(null);
	async function verderTerug(o: Onderwerp) {
		const s = standen[vak(o)];
		if (!s?.doorzocht || verderBezig) return;
		verderBezig = vak(o);
		try {
			await laadAlles([o], ac.signal, { tot: dagVoor(s.doorzocht), items: s.items });
		} finally {
			verderBezig = null;
		}
	}

	const periodeVan = (o: Onderwerp) =>
		vanaf(o) === recent ? `Afgelopen ${RECENT_DAGEN} dagen` : `Sinds ${shortDate(vanaf(o))}`;
	/** The count beside the topic's heading: `25`, or `25+` where the search stopped short. */
	function telling(s: Stand | undefined): string | null {
		if (s?.status !== 'klaar') return null;
		return `${s.items.length}${s.meer || s.doorzocht ? '+' : ''}`;
	}
	/**
	 * What the count is of, as a label (UX-toets 10 Oct, #17: no sentence):
	 * `Afgelopen 30 dagen; 2 nieuw sinds 8 okt. 2026`.
	 */
	function telRegel(o: Onderwerp, s: Stand | undefined): string {
		if (o.vorige && vanaf(o) === o.vorige) return `Nieuw sinds ${shortDate(o.vorige)}`;
		const periode = periodeVan(o);
		if (s?.status !== 'klaar' || !o.vorige) return periode;
		const nieuw = s.items.filter((i) => isNieuw(i.date, o.vorige)).length;
		// Searched only from after the visit before: what is new may be more too.
		const minNieuw = s.doorzocht && s.doorzocht > o.vorige ? '+' : '';
		return `${periode}; ${nieuw}${minNieuw} nieuw sinds ${shortDate(o.vorige)}`;
	}

	/** The topic as an Atom feed: every word as a q of its own, any of them counts. */
	const atomHref = (termen: string[]) => {
		const p = new URLSearchParams();
		for (const t of termen) p.append('q', t);
		return `${API_BASE_URL}/api/feed.atom?${p}`;
	};

	// The whole of Actueel for a word: the API searches its titles fast since 0.79.30, and says
	// how far back it searched where it stopped short (Doorzocht vanaf).
	const actueelHref = (term: string) => `/actueel?${new URLSearchParams({ q: term })}`;

	const overzichtHref = (o: Pick<Onderwerp, 'termen'>) =>
		`/onderwerpen/overzicht?${new URLSearchParams({ onderwerp: naarParam(o.termen) })}`;

	// ── Following ───────────────────────────────────────────────────────────
	let invoer = $state('');
	function voegToe(e?: SubmitEvent) {
		e?.preventDefault();
		const termen = splitsTermen(invoer);
		if (!termen.length) return;
		volg(termen);
		eigen = lees();
		invoer = '';
	}
	// Words of a topic changed in place: the topic loads again under its new words.
	let bewerkt = $state<string | null>(null);
	let erbij = $state('');
	function voegWoordToe(e: SubmitEvent, o: Onderwerp) {
		e.preventDefault();
		voegTermenToe(o.termen[0], splitsTermen(erbij));
		eigen = lees();
		erbij = '';
		bewerkt = sleutel(eigen.find((x) => x.termen[0] === o.termen[0]) ?? o);
	}
	function haalWeg(o: Onderwerp, term: string) {
		haalTermWeg(term);
		eigen = lees();
		const blijft = o.termen.find((t) => t !== term);
		bewerkt = sleutel(eigen.find((x) => blijft && x.termen.includes(blijft)) ?? o);
	}
	function verwijder(o: Onderwerp) {
		ontvolg(o.termen[0]);
		eigen = lees();
	}
	function volgGedeeld() {
		for (const termen of gedeeld) volg(termen);
		eigen = lees();
	}
	const alGevolgd = $derived(
		gedeeld.length > 0 &&
			gedeeld.every((t) => eigen.some((o) => sleutel(o) === sleutel({ termen: t })))
	);

	let gekopieerd = $state(false);
	async function kopieer() {
		const adres = new URL(deelAdres(eigen), page.url.origin).href;
		try {
			await navigator.clipboard.writeText(adres);
			gekopieerd = true;
			setTimeout(() => (gekopieerd = false), 2000);
		} catch {
			/* geen klembord: het adres staat in de link */
		}
	}
</script>

<RouteKop pad="/onderwerpen" />

<div class="onderwerpen blad blad__indeling">
	<!-- The heading with its actions at the right, as Actueel (docs/bediening.md). -->
	<header class="blad__kop">
		<h1 class="blad__titel">Gevolgde onderwerpen</h1>
		{#if gedeeld.length}
			<div class="acties">
				{#if alGevolgd}
					<a href="/onderwerpen">Gevolgd. Naar de eigen onderwerpen</a>
				{:else}
					<button type="button" class="btn is-groot" onclick={volgGedeeld}
						>Volg deze onderwerpen</button
					>
				{/if}
			</div>
		{:else if eigen.length}
			<div class="acties">
				<a href={deelAdres(eigen)}>Adres van deze onderwerpen</a>
				<TekstLink onclick={kopieer}>{gekopieerd ? 'Gekopieerd' : 'Kopieer'}</TekstLink>
			</div>
		{/if}
	</header>
	{#if !gedeeld.length}
		<!-- The choose-line: the words of a topic to follow (Bepaalregel). -->
		<div class="regel">
			<Bepaalregel
				zoek={{
					label: 'Onderwerp',
					naam: 'Onderwerp volgen',
					placeholder: 'AI; kunstmatige intelligentie',
					waarde: invoer,
					onInput: (v) => (invoer = v),
					knop: { label: 'Volg', disabled: !normaal(invoer), onSubmit: () => voegToe() }
				}}
			/>
		</div>
	{/if}
	<!-- The topics of the page, as a facet column holds its groups: a way to each. -->
	<nav class="opzij" aria-label="Gevolgde onderwerpen op deze pagina">
		{#if lijst.length > 1}
			<h2 class="opzij__kop">Gevolgd</h2>
			<ul>
				{#each lijst as o, n (sleutel(o))}
					<li><a href="#onderwerp-{n}">{o.termen.join('; ')}</a></li>
				{/each}
			</ul>
		{/if}
	</nav>

	<div class="inhoud">
		{#if geladen && !lijst.length}
			<p class="status stil">Nog geen onderwerpen.</p>
		{/if}

		{#each lijst as o, n (sleutel(o))}
			{@const s = standen[vak(o)]}
			<!-- A topic as a group of the page (Sectie): the ink rule, its words as the heading that
			     opens and closes it, remembered per topic in this browser (Thijs, 10 Oct), its
			     actions at the right on the same line, what is new under it. -->
			<Sectie
				titel={o.termen.join('; ')}
				id="onderwerp-{n}"
				niveau={2}
				aantal={telling(s)}
				sleutel="onderwerp:{sleutel(o)}"
				standaardOpen
			>
				{#snippet naast()}
					<span class="acties">
						{#if !gedeeld.length}
							<TekstLink
								aria-expanded={bewerkt === sleutel(o)}
								onclick={() => (bewerkt = bewerkt === sleutel(o) ? null : sleutel(o))}
								>Woorden</TekstLink
							>
							<TekstLink onclick={() => verwijder(o)}>Niet meer volgen</TekstLink>
						{/if}
						<a class="naar-overzicht" href={overzichtHref(o)}>Overzicht</a>
					</span>
				{/snippet}
				<p class="sinds">{telRegel(o, s)}</p>
				{#if bewerkt === sleutel(o) && !gedeeld.length}
					<div class="woorden">
						<ul>
							{#each o.termen as term (term)}
								<li>
									{term}{#if o.termen.length > 1}<button
											type="button"
											class="weg-knop"
											aria-label="‘{term}’ weghalen"
											onclick={() => haalWeg(o, term)}>×</button
										>{/if}
								</li>
							{/each}
						</ul>
						<form class="nieuw nieuw--klein" onsubmit={(e) => voegWoordToe(e, o)}>
							<input
								type="text"
								aria-label="Woord toevoegen aan dit onderwerp"
								bind:value={erbij}
								placeholder="Woord of synoniem"
							/>
							<button type="submit" class="btn is-groot" disabled={!normaal(erbij)}
								>Toevoegen</button
							>
						</form>
					</div>
				{/if}
				{#if !s || s.status === 'laden'}
					<p class="status stil">Laden…</p>
				{:else if s.status === 'fout'}
					<p class="status status--fout stil">Dit onderwerp kon niet worden geladen.</p>
				{:else if !s.items.length}
					<p class="status stil">Niets {periodeVan(o)}.</p>
				{:else}
					{@const alle = uitgeklapt[vak(o)] || s.items.length <= EERST + 2}
					<!-- The rows of Actueel, day by day: both read the same. -->
					<div class="dagen">
						{#each daysOf(alle ? s.items : s.items.slice(0, EERST)) as day (day.date)}
							<FeedDay
								{day}
								{today}
								{openId}
								onToggle={(id) => (openId = openId === id ? null : id)}
								colorOf={(short) => (short ? partyColor(short) : 'var(--rule-strong)')}
								{ministryName}
								filterHref={(patch) => `/actueel?${new URLSearchParams(patch)}`}
								nieuwSinds={o.vorige}
							/>
						{/each}
					</div>
					{#if !alle}
						<p class="alle">
							<TekstLink onclick={() => (uitgeklapt[vak(o)] = true)}
								>Alle {s.items.length} tonen</TekstLink
							>
						</p>
					{/if}
				{/if}
				{#if s?.status === 'klaar' && s.doorzocht}
					<p class="status stil">
						Doorzocht vanaf {shortDate(s.doorzocht)}.
						<TekstLink disabled={verderBezig === vak(o)} onclick={() => verderTerug(o)}
							>{verderBezig === vak(o) ? 'Laden…' : 'Zoek verder terug'}</TekstLink
						>
					</p>
				{/if}
				<p class="verder">
					{#each o.termen as term (term)}
						<a href={actueelHref(term)}>‘{term}’ in Actueel</a>
					{/each}
					<!-- The topic as a feed of its own, all its words in one (API 0.79.30). -->
					<a href={atomHref(o.termen)} rel="alternate" type="application/atom+xml">Atom-feed</a>
				</p>
			</Sectie>
		{/each}
	</div>
</div>

<style>
	/* The column's width, not its content's: without a paragraph under the title the page
	   would shrink to the field and stand off-centre. */
	/* The frame and grid of Bladeren (AppShell): the heading and the choose-line over both
	   columns. */
	.regel {
		grid-column: 1 / -1;
		margin-bottom: var(--s-5);
	}
	/* The column's first heading on the line of the first topic's heading, under its rule
	   (Sectie: 2 px and --s-3), as Bladeren's facets stand beside its list. */
	.opzij {
		padding-top: calc(var(--s-3) + 2px);
	}
	.opzij__kop {
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.opzij ul {
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.opzij li {
		padding: 2px 0;
	}
	.opzij a {
		color: var(--ink-2);
		text-decoration: none;
	}
	.opzij a:hover {
		color: var(--ink);
		text-decoration: underline;
	}
	@media (max-width: 768px) {
		.opzij {
			display: none;
		}
	}
	.inhoud {
		min-width: 0;
	}
	/* Actueel's rows, with Actueel's (and Bladeren's) columns. */
	.dagen {
		--row-lead: 140px;
		--row-aside: 150px;
	}
	.nieuw {
		display: flex;
		gap: var(--s-2);
		margin-bottom: var(--s-3);
	}
	.nieuw input {
		flex: 1;
		min-width: 0;
		box-sizing: border-box;
		height: var(--veld-h);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink);
	}
	.nieuw input::placeholder {
		color: var(--ink-3);
	}
	.alle {
		margin: var(--s-2) 0 0;
		font-size: var(--t-meta);
	}
	.acties {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.acties a,
	.verder a {
		color: var(--ink-2);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	/* The topics as groups of the page; the first on the top line of the facet column. */
	.inhoud > :global(.sectie + .sectie) {
		margin-top: var(--s-7);
	}
	.acties {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		font-size: var(--t-meta);
	}
	.naar-overzicht {
		color: var(--ink-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.woorden {
		margin: 0 0 var(--s-4);
	}
	.woorden ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin: 0 0 var(--s-3);
		padding: 0;
		list-style: none;
	}
	.woorden li {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		padding: var(--s-1) var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.weg-knop {
		padding: 0 0 0 var(--s-1);
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink-3);
		cursor: pointer;
	}
	.weg-knop:hover {
		color: var(--ink);
	}
	.nieuw--klein {
		max-width: 420px;
	}
	.sinds {
		margin: 0;
		color: var(--ink-3);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.status,
	.verder {
		margin: var(--s-3) 0;
	}
	.verder {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
	}
	.status--fout {
		color: var(--ink-2);
	}

	@media (max-width: 640px) {
		.onderwerpen {
			padding: var(--s-4) var(--s-4) var(--s-7);
		}
	}
</style>
