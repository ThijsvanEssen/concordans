<script lang="ts">
	// Gevolgde onderwerpen: per topic what came into Actueel since the visit before. The topics
	// are kept in this browser; an address with `?onderwerp=` shows someone else's without
	// touching the own list, and can be followed in one step.
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api/client';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import type { TijdGroep } from '$lib/components/tijdlijn/tijdlijn';
	import { bronHref } from '$lib/bron/href';
	import {
		dayLabel,
		feedStand,
		normalizeItem,
		shortDate,
		type FeedItem
	} from '$lib/components/actueel/feed';
	import { headlineOf, hrefOf } from '$lib/components/actueel/timeline';
	import {
		deelAdres,
		lees,
		nieuwBezoek,
		normaal,
		ontvolg,
		uitParams,
		volg,
		woordIn,
		zetGezien,
		type Onderwerp
	} from '$lib/onderwerpen/onderwerpen';
	import { vandaag } from '$lib/text/datum';

	/** Without a visit before: this many days back. */
	const DAGEN_ZONDER_BEZOEK = 30;
	/** Per word, as the feed gives at most in one page. */
	const PER_TERM = 100;
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

	type Stand = { status: 'laden' | 'klaar' | 'fout'; items: FeedItem[]; meer: boolean };
	let standen = $state<Record<string, Stand>>({});
	let uitgeklapt = $state<Record<string, boolean>>({});
	const sleutel = (o: Pick<Onderwerp, 'termen'>) => o.termen.join('|').toLowerCase();
	// A shared topic asks another window than an own one with the same words.
	const vak = (o: Pick<Onderwerp, 'termen'>) => (gedeeld.length ? 'gedeeld:' : '') + sleutel(o);
	const vanaf = (o: Onderwerp) => o.vorige ?? dagenTerug(DAGEN_ZONDER_BEZOEK);

	/** One request per word, at most two at a time (the API's limit per address). */
	async function laadAlles(onderwerpen: Onderwerp[], signal: AbortSignal) {
		const taken = onderwerpen.flatMap((o) => o.termen.map((term) => ({ o, term })));
		const per = new Map<string, Map<string, FeedItem>>();
		const open = new Map(onderwerpen.map((o) => [vak(o), o.termen.length]));
		const fout = new Set<string>();
		const meer = new Set<string>();
		const werk = async () => {
			for (let t = taken.shift(); t && !signal.aborted; t = taken.shift()) {
				const k = vak(t.o);
				try {
					const r = await unwrap(
						api.GET('/api/feed', {
							params: {
								query: { q: t.term, since: vanaf(t.o), limit: PER_TERM, facets: false }
							},
							signal: AbortSignal.any([signal, AbortSignal.timeout(WACHT)])
						})
					);
					const items = per.get(k) ?? new Map<string, FeedItem>();
					for (const raw of r.items) {
						const i = normalizeItem(raw);
						if ([i.title, i.dossier?.title, i.summary].some((x) => woordIn(t.term, x)))
							items.set(i.id, i);
					}
					per.set(k, items);
					if (r.next_cursor) meer.add(k);
					const stand = feedStand(r.data_as_of);
					if (stand && !gedeeld.length) zetGezien(t.term, stand.newest);
				} catch {
					if (signal.aborted) return;
					fout.add(k);
				}
				const rest = (open.get(k) ?? 1) - 1;
				open.set(k, rest);
				if (rest === 0)
					standen[k] = {
						status: fout.has(k) && !per.get(k)?.size ? 'fout' : 'klaar',
						items: [...(per.get(k)?.values() ?? [])].sort(
							(a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
						),
						meer: meer.has(k)
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
		for (const o of nieuw) standen[vak(o)] = { status: 'laden', items: [], meer: false };
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
	const groepenVan = (items: FeedItem[]): TijdGroep[] =>
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
					label: h.label,
					zin: h.title,
					href: bronHref(ref),
					ref,
					groot: h.major
				};
			})
		}));

	// A word without a period took the API over 30 s (9 Oct): Actueel opens on a year.
	const actueelHref = (term: string) =>
		`/actueel?${new URLSearchParams({ q: term, van: dagenTerug(365) })}`;

	// ── Following ───────────────────────────────────────────────────────────
	let invoer = $state('');
	function voegToe(e: SubmitEvent) {
		e.preventDefault();
		const termen = invoer.split(',').map(normaal).filter(Boolean);
		if (!termen.length) return;
		volg(termen);
		eigen = lees();
		invoer = '';
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

<svelte:head><title>Onderwerpen, Concordans</title></svelte:head>

<div class="onderwerpen">
	<header class="kop">
		<h1 class="titel">Onderwerpen</h1>
		{#if gedeeld.length}
			<p class="uitleg">
				Gedeelde onderwerpen, de afgelopen {DAGEN_ZONDER_BEZOEK} dagen in Actueel.
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
				Nieuwe stukken, stemmingen en toezeggingen in Actueel met deze woorden in de titel, sinds
				het vorige bezoek. Meer woorden voor één onderwerp staan met een komma ertussen. De
				onderwerpen staan alleen in deze browser.
			</p>
			<form class="nieuw" onsubmit={voegToe}>
				<input
					type="text"
					aria-label="Onderwerp volgen"
					bind:value={invoer}
					placeholder="kunstmatige intelligentie, AI"
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
				<h2 id="onderwerp-{n}">{o.termen.join(', ')}</h2>
				<p class="sinds">
					{#if s?.status === 'klaar'}
						{s.meer ? 'ten minste ' : ''}{s.items.length} nieuw,
					{/if}
					{o.vorige ? `sinds ${shortDate(o.vorige)}` : `de afgelopen ${DAGEN_ZONDER_BEZOEK} dagen`}
				</p>
				{#if !gedeeld.length}
					<button type="button" class="stil" onclick={() => verwijder(o)}>Niet meer volgen</button>
				{/if}
			</div>
			{#if !s || s.status === 'laden'}
				<p class="status">Laden…</p>
			{:else if s.status === 'fout'}
				<p class="status status--fout">Dit onderwerp kon niet worden geladen.</p>
			{:else if !s.items.length}
				<p class="status">Niets nieuws.</p>
			{:else}
				{@const alle = uitgeklapt[vak(o)] || s.items.length <= EERST + 2}
				<Tijdlijn groepen={groepenVan(alle ? s.items : s.items.slice(0, EERST))} datums={false} />
				{#if !alle}
					<button type="button" class="stil meer" onclick={() => (uitgeklapt[vak(o)] = true)}
						>Alle {s.items.length} tonen</button
					>
				{/if}
			{/if}
			<p class="verder">
				{#each o.termen as term (term)}
					<a href={actueelHref(term)}>‘{term}’ in Actueel, het afgelopen jaar</a>
				{/each}
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
	.onderwerp__kop h2 {
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
		.onderwerpen {
			padding: var(--s-4) var(--s-4) var(--s-7);
		}
	}
</style>
