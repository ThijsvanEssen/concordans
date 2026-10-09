<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	// Gevolgde onderwerpen: per topic what came into Actueel since the visit before. The topics
	// are kept in this browser; an address with `?onderwerp=` shows someone else's without
	// touching the own list, and can be followed in one step.
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api/client';
	import { API_BASE_URL } from '$lib/api/base-url';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import type { TijdGroep } from '$lib/components/tijdlijn/tijdlijn';
	import { bronHref } from '$lib/bron/href';
	import {
		dayLabel,
		dagVoor,
		doorzochtVanaf,
		feedStand,
		normalizeItem,
		shortDate,
		type FeedItem
	} from '$lib/components/actueel/feed';
	import { headlineOf, hrefOf } from '$lib/components/actueel/timeline';
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

	/** `Dinsdag 22 september`: the year only when it is not this one. */
	const dagKop = (date: string) => {
		const label = dayLabel(date, today);
		return date.slice(0, 4) === today.slice(0, 4) ? label.replace(/ \d{4}$/, '') : label;
	};
	const groepenVan = (items: FeedItem[], vorige: string | null): TijdGroep[] =>
		[...Map.groupBy(items, (i) => i.date)].map(([date, is]) => ({
			id: date,
			titel: dagKop(date),
			regels: is.map((i) => {
				const h = headlineOf(i);
				const ref = hrefOf(i);
				return {
					id: i.id,
					datum: null,
					teken: h.failed
						? 'nee'
						: /aangenomen/i.test(h.label)
							? 'ja'
							: h.major
								? 'stuk'
								: 'activiteit',
					label: isNieuw(i.date, vorige) ? `${h.label}, nieuw` : h.label,
					zin: h.title,
					href: bronHref(ref),
					ref,
					groot: h.major
				};
			})
		}));

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
		vanaf(o) === recent ? `de afgelopen ${RECENT_DAGEN} dagen` : `sinds ${shortDate(vanaf(o))}`;
	/** `2 nieuw sinds 8 okt. 2026; 25 de afgelopen 30 dagen` */
	function telRegel(o: Onderwerp, s: Stand | undefined): string {
		const periode = periodeVan(o);
		if (s?.status !== 'klaar') return periode;
		const min = s.meer || s.doorzocht ? 'ten minste ' : '';
		if (!o.vorige) return `${min}${s.items.length} ${periode}`;
		const nieuw = s.items.filter((i) => isNieuw(i.date, o.vorige)).length;
		const sinds = `nieuw sinds ${shortDate(o.vorige)}`;
		// Shown from the visit before: all of it is new.
		if (vanaf(o) === o.vorige) return `${min}${nieuw} ${sinds}`;
		// Searched only from after the visit before: what is new may be more too.
		const minNieuw = s.doorzocht && s.doorzocht > o.vorige ? 'ten minste ' : '';
		return `${minNieuw}${nieuw} ${sinds}; ${min}${s.items.length} ${periode}`;
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
	function voegToe(e: SubmitEvent) {
		e.preventDefault();
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

<div class="onderwerpen">
	<header class="kop">
		<h1 class="titel">Onderwerpen</h1>
		{#if gedeeld.length}
			<p class="uitleg">
				Gedeelde onderwerpen, de afgelopen {RECENT_DAGEN} dagen in Actueel.
			</p>
			<div class="acties">
				{#if alGevolgd}
					<a href="/onderwerpen">Gevolgd. Naar de eigen onderwerpen</a>
				{:else}
					<button type="button" onclick={volgGedeeld}>Volg deze onderwerpen</button>
				{/if}
			</div>
		{:else}
			<p class="uitleg">
				Stukken, stemmingen en toezeggingen in Actueel met deze woorden in de titel, de afgelopen
				{RECENT_DAGEN} dagen. Nieuw is wat dateert van na het vorige bezoek. Synoniemen horen bij één
				onderwerp: AI; kunstmatige intelligentie. Een stuk dat meer woorden raakt, telt één keer. De onderwerpen
				staan alleen in deze browser.
			</p>
			<form class="nieuw" onsubmit={voegToe}>
				<input
					type="text"
					aria-label="Onderwerp volgen"
					bind:value={invoer}
					placeholder="Woorden of synoniemen, gescheiden door ; of ,"
				/>
				<button type="submit" disabled={!normaal(invoer)}>Volg</button>
			</form>
			{#if eigen.length}
				<div class="acties">
					<a href={deelAdres(eigen)}>Adres van deze onderwerpen</a>
					<button type="button" class="stil" onclick={kopieer}
						>{gekopieerd ? 'Gekopieerd' : 'Kopieer'}</button
					>
				</div>
			{/if}
		{/if}
	</header>

	{#if geladen && !lijst.length}
		<p class="status">
			Nog geen onderwerpen. Volg er een hierboven, of met Volg naast het zoekveld in <a
				href="/actueel">Actueel</a
			>.
		</p>
	{/if}

	{#each lijst as o, n (sleutel(o))}
		{@const s = standen[vak(o)]}
		<section class="onderwerp" aria-labelledby="onderwerp-{n}">
			<div class="onderwerp__kop">
				<h2 id="onderwerp-{n}">{o.termen.join('; ')}</h2>
				<p class="sinds">
					{telRegel(o, s)}
				</p>
				{#if !gedeeld.length}
					<button
						type="button"
						class="stil"
						aria-expanded={bewerkt === sleutel(o)}
						onclick={() => (bewerkt = bewerkt === sleutel(o) ? null : sleutel(o))}>Woorden</button
					>
					<button type="button" class="stil" onclick={() => verwijder(o)}>Niet meer volgen</button>
				{/if}
				<a class="naar-overzicht" href={overzichtHref(o)}>Overzicht</a>
			</div>
			{#if bewerkt === sleutel(o) && !gedeeld.length}
				<div class="woorden">
					<ul>
						{#each o.termen as term (term)}
							<li>
								{term}{#if o.termen.length > 1}<button
										type="button"
										class="weg"
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
						<button type="submit" disabled={!normaal(erbij)}>Toevoegen</button>
					</form>
				</div>
			{/if}
			{#if !s || s.status === 'laden'}
				<p class="status">Laden…</p>
			{:else if s.status === 'fout'}
				<p class="status status--fout">Dit onderwerp kon niet worden geladen.</p>
			{:else if !s.items.length}
				<p class="status">Niets {periodeVan(o)}.</p>
			{:else}
				{@const alle = uitgeklapt[vak(o)] || s.items.length <= EERST + 2}
				<Tijdlijn
					groepen={groepenVan(alle ? s.items : s.items.slice(0, EERST), o.vorige)}
					datums={false}
				/>
				{#if !alle}
					<button type="button" class="stil meer" onclick={() => (uitgeklapt[vak(o)] = true)}
						>Alle {s.items.length} tonen</button
					>
				{/if}
			{/if}
			{#if s?.status === 'klaar' && s.doorzocht}
				<p class="status">
					Doorzocht vanaf {shortDate(s.doorzocht)}.
					<button
						type="button"
						class="stil"
						disabled={verderBezig === vak(o)}
						onclick={() => verderTerug(o)}
						>{verderBezig === vak(o) ? 'Laden…' : 'Zoek verder terug'}</button
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
		</section>
	{/each}
</div>

<style>
	.onderwerpen {
		max-width: 760px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-8);
	}
	.titel {
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
	}
	.uitleg {
		margin: 0 0 var(--s-4);
		color: var(--ink-2);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
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
		height: var(--s-7);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.nieuw input::placeholder {
		color: var(--ink-3);
		font-style: italic;
	}
	button {
		height: var(--s-7);
		padding: 0 var(--s-4);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		background: var(--paper);
		color: var(--ink);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		cursor: pointer;
	}
	button:disabled {
		color: var(--ink-3);
		cursor: default;
	}
	button.stil {
		height: auto;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink-3);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	button.meer {
		margin-top: var(--s-2);
	}
	button.stil:hover {
		color: var(--ink);
	}
	.acties {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-4);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.acties a,
	.verder a,
	.status a {
		color: var(--ink-2);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.onderwerp {
		margin-top: var(--s-7);
		padding-top: var(--s-4);
		border-top: 1px solid var(--rule);
	}
	.onderwerp__kop {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2) var(--s-4);
		margin-bottom: var(--s-3);
	}
	.naar-overzicht {
		color: var(--ink-2);
		font-family: var(--font-sans);
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
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	button.weg {
		height: auto;
		padding: 0 0 0 var(--s-1);
		border: 0;
		background: none;
		color: var(--ink-3);
	}
	button.weg:hover {
		color: var(--ink);
	}
	.nieuw--klein {
		max-width: 420px;
	}
	.onderwerp__kop h2 {
		/* The words above, what is new and the actions on a line below. */
		flex-basis: 100%;
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		overflow-wrap: anywhere;
	}
	.sinds {
		flex: 1;
		margin: 0;
		color: var(--ink-3);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.status,
	.verder {
		margin: var(--s-3) 0;
		color: var(--ink-3);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
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
		/* The count on a line of its own, the actions below it. */
		.sinds {
			flex-basis: 100%;
		}
		.onderwerpen {
			padding: var(--s-4) var(--s-4) var(--s-7);
		}
	}
</style>
