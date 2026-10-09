<script lang="ts">
	// Overzicht of a topic: the decisions of the Kamers on moties, amendementen and bills with
	// its words in the title, by kind, outcome and year, and for one fractie by its vote. Every
	// number is a link to the list it counts, on this page; the list goes out as a CSV.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api, unwrap } from '$lib/api/client';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import Periode from '$lib/components/ui/Periode.svelte';
	import StemTeken from '$lib/components/parliamentary/Stem.svelte';
	import { buildBronHref } from '$lib/bron/href';
	import { korteDatum } from '$lib/text/datum';
	import { download } from '$lib/verbonden/export';
	import { uitParams } from '$lib/onderwerpen/onderwerpen';
	import { dossierName, naamVanNummer } from '$lib/bron/dossier-naam';
	import {
		filter,
		naarCsv,
		opOnderwerp,
		perJaar,
		perSoort,
		soortVan,
		totaal,
		uitFacets,
		lijstQuery,
		uitkomstVan,
		type Besluit,
		type Filter,
		type Getelden,
		type Stem,
		type Telling,
		type Uitkomst
	} from '$lib/onderwerpen/overzicht';

	/** Decisions the API gives in one page. */
	const PAGINA = 200;
	/** Per word at most this many, the newest: five requests. */
	const MAX = 1000;
	/** Rows of the list before `Meer tonen`. */
	const STAP = 50;

	// ── The URL ─────────────────────────────────────────────────────────────
	const params = $derived(page.url.searchParams);
	// As a string: a filter changes the URL, and a new array of the same words would load
	// everything again.
	const termenSleutel = $derived((uitParams(params)[0] ?? []).join('|'));
	const termen = $derived(termenSleutel ? termenSleutel.split('|') : []);
	const kamer = $derived(((v) => (v === 'TK' || v === 'EK' ? v : ''))(params.get('kamer')));
	// The period, as everywhere (Periode.svelte): days in the URL and to the API.
	const dag = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
	const van = $derived(dag(params.get('van')));
	const tot = $derived(dag(params.get('tot')));
	/** The bounds of the period as /api/decisions takes them. */
	const periode = (v: string, t: string) => ({
		...(v ? { from: v } : {}),
		...(t ? { to: t } : {})
	});
	const fractie = $derived(params.get('fractie') ?? '');
	const f = $derived<Filter>({
		soort: params.get('soort') || undefined,
		uitkomst: (['aangenomen', 'verworpen', 'overig'] as const).find(
			(u) => u === params.get('uitkomst')
		),
		jaar: params.get('jaar') || undefined,
		stem: (['voor', 'tegen'] as const).find((s) => s === params.get('stem'))
	});

	const FILTERS = ['soort', 'uitkomst', 'jaar', 'stem'];
	type Patch = Record<string, string | null>;
	/** A number's list: its own filters only, the others off. */
	function hrefMet(patch: Patch, alleen = true) {
		const url = new URL(page.url);
		if (alleen) for (const k of FILTERS) url.searchParams.delete(k);
		for (const [k, v] of Object.entries(patch)) {
			if (v === null || v === '') url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		return url.pathname + url.search;
	}
	const zet = (patch: Patch) =>
		goto(hrefMet(patch, false), { replaceState: true, keepFocus: true, noScroll: true });

	// ── Counted by the API (0.79.30) ────────────────────────────────────────
	// One question with all the words (repeated q) gives the counts per kind and year, and
	// one fractie's voor and tegen (party_votes): every decision, no cap. The list behind a
	// number is a question of its own. Without those facets (an API before 0.79.30) the page
	// counts the decisions itself, as before (`bron = 'zelf'`).
	let bron = $state<'api' | 'zelf' | null>(null);
	let getelden = $state<Getelden | null>(null);
	let apiTotaal = $state<number | null>(null);
	let tellenLaden = $state(false);
	/** The words, the Kamer and the period as /api/decisions takes them. */
	const basisVan = (woorden: string[], k: string, v: string, t: string) => ({
		q: woorden,
		...(k ? { chamber: k } : {}),
		...periode(v, t)
	});
	$effect(() => {
		const woorden = termenSleutel ? termenSleutel.split('|') : [];
		const basis = basisVan(woorden, kamer, van, tot);
		const wie = fractie;
		const ac = new AbortController();
		getelden = null;
		apiTotaal = null;
		if (!woorden.length) return;
		tellenLaden = true;
		stemmenLaden = !!wie;
		let opnieuw: ReturnType<typeof setTimeout> | undefined;
		let poging = 0;
		const vraag = (): Promise<void> =>
			unwrap(
				api.GET('/api/decisions', {
					params: { query: { ...basis, ...(wie ? { party_votes: wie } : {}), limit: 1 } },
					signal: ac.signal
				})
			)
				.then((r) => {
					if (!r.facets?.years) {
						bron = 'zelf';
						tellenLaden = false;
						return;
					}
					bron = 'api';
					getelden = uitFacets(r.facets, wie || null);
					apiTotaal = r.total;
					tellenLaden = false;
					// party_votes counted for longer than 3 s: asked again a few seconds later.
					if (wie && r.partial && !(r.facets.party_votes ?? []).length && poging++ < 3) {
						opnieuw = setTimeout(vraag, 3000);
						return;
					}
					stemmenLaden = false;
				})
				.catch(() => {
					if (ac.signal.aborted) return;
					tellenLaden = false;
					stemmenLaden = false;
					if (bron === null) bron = 'zelf';
				});
		void vraag();
		return () => {
			clearTimeout(opnieuw);
			ac.abort();
		};
	});

	// The list behind a number, STAP at a time.
	let apiLijst = $state<Besluit[]>([]);
	let lijstTotaal = $state<number | null>(null);
	let lijstLaden = $state(false);
	const lijstVraag = $derived(
		lijstQuery(
			basisVan(termenSleutel ? termenSleutel.split('|') : [], kamer, van, tot),
			f,
			fractie || null
		)
	);
	$effect(() => {
		if (bron !== 'api' || !termenSleutel) return;
		const query = lijstVraag;
		const ac = new AbortController();
		apiLijst = [];
		lijstTotaal = null;
		lijstLaden = true;
		unwrap(
			api.GET('/api/decisions', {
				params: { query: { ...query, limit: STAP, offset: 0 } },
				signal: ac.signal
			})
		)
			.then((r) => {
				apiLijst = r.items;
				lijstTotaal = r.total;
			})
			.catch(() => {})
			.finally(() => {
				if (!ac.signal.aborted) lijstLaden = false;
			});
		return () => ac.abort();
	});
	async function meerLaden() {
		if (lijstLaden) return;
		lijstLaden = true;
		try {
			const r = await unwrap(
				api.GET('/api/decisions', {
					params: { query: { ...lijstVraag, limit: STAP, offset: apiLijst.length } }
				})
			);
			apiLijst = [...apiLijst, ...r.items];
		} finally {
			lijstLaden = false;
		}
	}

	// ── The decisions ───────────────────────────────────────────────────────
	type PerTerm = { term: string; api: number | null; nagelopen: number; tot: string | null };
	let besluiten = $state<Besluit[]>([]);
	let perTerm = $state<PerTerm[]>([]);
	let laden = $state(false);
	let fout = $state(false);

	/** All pages of one question, up to MAX, each handed on as it comes. */
	async function pagina(
		query: Record<string, string | number>,
		signal: AbortSignal,
		elk: (items: Besluit[], total: number) => void
	) {
		for (let offset = 0; offset < MAX; offset += PAGINA) {
			const r = await unwrap(
				api.GET('/api/decisions', {
					params: { query: { ...query, limit: PAGINA, offset } },
					signal
				})
			);
			elk(r.items, r.total);
			if (offset + PAGINA >= r.total) break;
		}
	}

	/** One word after another, two at a time (the API's limit per address). */
	async function tweeTegelijk<T>(taken: T[], doe: (t: T) => Promise<void>) {
		const rij = [...taken];
		const werk = async () => {
			for (let t = rij.shift(); t !== undefined; t = rij.shift()) await doe(t);
		};
		await Promise.all([werk(), werk()]);
	}

	$effect(() => {
		// Counted here only where the API does not count (bron 'zelf').
		if (bron !== 'zelf') return;
		const woorden = termenSleutel ? termenSleutel.split('|') : [];
		const k = kamer;
		const p = periode(van, tot);
		const ac = new AbortController();
		besluiten = [];
		perTerm = woorden.map((term) => ({ term, api: null, nagelopen: 0, tot: null }));
		fout = false;
		if (!woorden.length) return;
		laden = true;
		const gezien = new Map<string, Besluit>();
		tweeTegelijk(woorden, (term) =>
			pagina({ q: term, ...(k ? { chamber: k } : {}), ...p }, ac.signal, (items, total) => {
				for (const d of items) if (opOnderwerp(d, woorden)) gezien.set(d.key, d);
				besluiten = [...gezien.values()].sort(
					(a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.key.localeCompare(b.key)
				);
				perTerm = perTerm.map((p) =>
					p.term === term
						? {
								...p,
								api: total,
								nagelopen: p.nagelopen + items.length,
								tot: items.at(-1)?.date ?? p.tot
							}
						: p
				);
			})
		)
			.catch(() => {
				if (!ac.signal.aborted) fout = true;
			})
			.finally(() => {
				if (!ac.signal.aborted) laden = false;
			});
		return () => ac.abort();
	});

	// ── One fractie's vote ──────────────────────────────────────────────────
	let stemmen = $state<Map<string, Stem>>(new Map());
	let stemmenLaden = $state(false);
	$effect(() => {
		if (bron !== 'zelf') return;
		const woorden = termenSleutel ? termenSleutel.split('|') : [];
		const k = kamer;
		const p = periode(van, tot);
		const wie = fractie;
		const ac = new AbortController();
		stemmen = new Map();
		if (!wie || !woorden.length) return;
		stemmenLaden = true;
		const m = new Map<string, Stem>();
		const taken = woorden.flatMap((term) =>
			(['voor', 'tegen'] as const).map((stem) => ({ term, stem }))
		);
		tweeTegelijk(taken, ({ term, stem }) =>
			pagina(
				{ q: term, party: wie, vote: stem, ...(k ? { chamber: k } : {}), ...p },
				ac.signal,
				(items) => {
					for (const d of items) m.set(d.key, stem);
					stemmen = new Map(m);
				}
			)
		)
			.catch(() => {})
			.finally(() => {
				if (!ac.signal.aborted) stemmenLaden = false;
			});
		return () => ac.abort();
	});

	type Fractie = { key: string; naam: string; chamber: string | null; active: boolean };
	let fracties = $state<Fractie[]>([]);
	$effect(() => {
		unwrap(api.GET('/api/factions'))
			.then(
				(fs) =>
					(fracties = fs
						.map((x) => ({
							key: x.key,
							naam: x.abbreviation ?? x.name ?? x.key,
							chamber: x.chamber ?? null,
							active: !!x.active
						}))
						.sort((a, b) => a.naam.localeCompare(b.naam, 'nl')))
			)
			.catch(() => {});
	});
	const fractieKeuze = $derived(
		fracties.filter((x) => !kamer || !x.chamber || x.chamber === kamer)
	);

	// ── Counted ─────────────────────────────────────────────────────────────
	const api_ = $derived(bron === 'api' && getelden !== null);
	const alles = $derived(api_ ? getelden!.alles : totaal(besluiten, stemmen));
	const soorten = $derived(api_ ? getelden!.soorten : perSoort(besluiten, stemmen));
	const jaren = $derived(api_ ? getelden!.jaren : perJaar(besluiten, stemmen));
	const lijst = $derived(bron === 'api' ? apiLijst : filter(besluiten, f, stemmen));
	/** How many the list holds, also where only a page of it is loaded. */
	const lijstAantal = $derived(bron === 'api' ? (lijstTotaal ?? 0) : lijst.length);
	const bezig = $derived(bron === 'zelf' ? laden : bron === null || tellenLaden);
	const leegte = $derived(
		bron === 'zelf' ? !laden && !besluiten.length : bron === 'api' && apiTotaal === 0
	);
	/** A fractie's vote on a row: known per row where the page counted, else from the filter. */
	const stemVan = (d: Besluit): Stem | undefined =>
		!fractie ? undefined : bron === 'api' ? f.stem : stemmen.get(d.key);
	// Another list starts at its first rows again.
	let getoond = $derived.by(() => {
		void lijst;
		return STAP;
	});

	const KOLOMMEN: { uitkomst: Uitkomst; label: string }[] = [
		{ uitkomst: 'aangenomen', label: 'Aangenomen' },
		{ uitkomst: 'verworpen', label: 'Verworpen' }
	];
	const getal = (n: number) => n.toLocaleString('nl-NL');

	const UITKOMST_LABEL: Record<Uitkomst, string> = {
		aangenomen: 'aangenomen',
		verworpen: 'verworpen',
		overig: 'zonder uitkomst'
	};
	const filterLabels = $derived(
		[
			f.soort && { k: 'soort', label: f.soort },
			f.uitkomst && { k: 'uitkomst', label: UITKOMST_LABEL[f.uitkomst] },
			f.jaar && { k: 'jaar', label: f.jaar },
			f.stem && { k: 'stem', label: `${fractie} stemde ${f.stem}` }
		].filter((x): x is { k: string; label: string } => !!x)
	);

	const naam = $derived(termen.join('; '));

	// The dossiers' names for the CSV, asked at export: one request per number not asked
	// before (naamVanNummer), at most CSV_NAMEN of them.
	const CSV_NAMEN = 100;
	let exporteren = $state(false);
	/** The whole list behind the number for the CSV, CSV_MAX at most. */
	const CSV_MAX = 2000;
	async function heleLijst(): Promise<Besluit[]> {
		if (bron !== 'api') return lijst;
		const alle: Besluit[] = [];
		for (let offset = 0; offset < Math.min(lijstAantal, CSV_MAX); offset += PAGINA) {
			const r = await unwrap(
				api.GET('/api/decisions', {
					params: { query: { ...lijstVraag, limit: PAGINA, offset } }
				})
			);
			alle.push(...r.items);
			if (r.items.length < PAGINA) break;
		}
		return alle;
	}
	async function exporteer() {
		exporteren = true;
		const lijst = await heleLijst().catch(() => [] as Besluit[]);
		// The names the decisions carry (API 0.79.30); asked by number only where they do not.
		const namen = new Map<string, string>();
		for (const d of lijst)
			for (const x of d.dossiers ?? []) {
				const n = dossierName(x);
				if (n !== x.number) namen.set(x.number, n);
			}
		const nummers = [...new Set(lijst.flatMap((d) => d.dossier_numbers ?? []))]
			.filter((n) => !namen.has(n))
			.slice(0, CSV_NAMEN);
		await Promise.all(
			nummers.map((n) =>
				naamVanNummer(n).then((naam) => {
					if (naam) namen.set(n, naam);
				})
			)
		);
		exporteren = false;
		const veilig =
			naam
				.replace(/[\\/:*?"<>|]+/g, ' ')
				.slice(0, 80)
				.trim() || 'onderwerp';
		download(
			`Overzicht ${veilig}.csv`,
			naarCsv(
				lijst,
				page.url.origin,
				fractie || null,
				bron === 'api' && f.stem ? new Map(lijst.map((d) => [d.key, f.stem!] as const)) : stemmen,
				namen
			)
		);
	}

	const tally = (d: Besluit) =>
		d.tally?.Voor != null && d.tally?.Tegen != null
			? `${d.tally.Voor} voor, ${d.tally.Tegen} tegen`
			: null;
</script>

<svelte:head><title>{naam ? `${naam}, overzicht` : 'Overzicht'}, Concordans</title></svelte:head>

{#snippet cel(n: number, patch: Patch, bezig = false)}
	{#if n > 0}
		<a href="{hrefMet(patch)}#t-lijst">{getal(n)}</a>
	{:else}
		<span class="nul">{bezig ? '…' : '0'}</span>
	{/if}
{/snippet}

{#snippet tabel(
	titel: string,
	kolom: string,
	rijen: [string, Telling][],
	patchVan: (k: string) => Patch
)}
	<section class="tabel" aria-labelledby="t-{kolom}">
		<h2 id="t-{kolom}">{titel}</h2>
		<table>
			<thead>
				{#if fractie}
					<!-- The fractie's name once above its two columns: short headers fit a phone. -->
					<tr class="boven">
						<td colspan="4"></td>
						<th scope="colgroup" colspan="2" class="getal">{fractie}</th>
					</tr>
				{/if}
				<tr>
					<th scope="col">{kolom}</th>
					<th scope="col" class="getal">Besluiten</th>
					{#each KOLOMMEN as k (k.uitkomst)}<th scope="col" class="getal">{k.label}</th>{/each}
					{#if fractie}
						<th scope="col" class="getal heel">voor</th>
						<th scope="col" class="getal heel">tegen</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each rijen as [k, t] (k)}
					<tr>
						<th scope="row">{k}</th>
						<td class="getal">{@render cel(t.totaal, patchVan(k))}</td>
						{#each KOLOMMEN as c (c.uitkomst)}
							<td class="getal"
								>{@render cel(t[c.uitkomst], { ...patchVan(k), uitkomst: c.uitkomst })}</td
							>
						{/each}
						{#if fractie}
							<td class="getal"
								>{@render cel(t.voor, { ...patchVan(k), stem: 'voor' }, stemmenLaden)}</td
							>
							<td class="getal"
								>{@render cel(t.tegen, { ...patchVan(k), stem: 'tegen' }, stemmenLaden)}</td
							>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/snippet}

<div class="overzicht">
	<p class="terug"><a href="/onderwerpen">Onderwerpen</a></p>
	<h1 class="titel">{naam || 'Overzicht'}</h1>

	{#if !termen.length}
		<p class="status">
			Geen onderwerp gekozen. Een overzicht opent vanuit <a href="/onderwerpen">Onderwerpen</a>.
		</p>
	{:else}
		<p class="uitleg">
			Besluiten van de Kamers over moties, amendementen en wetsvoorstellen met deze woorden in de
			titel. Elk getal opent de lijst die het telt.
		</p>

		<div class="keuzes">
			<Keuze
				label="Kamer"
				klein
				waarde={kamer || 'beide'}
				onKies={(w) => zet({ kamer: w === 'beide' ? null : w })}
				opties={[
					{ waarde: 'beide', label: 'Beide' },
					{ waarde: 'TK', label: 'Tweede Kamer' },
					{ waarde: 'EK', label: 'Eerste Kamer' }
				]}
			/>
			<label class="fractie">
				<span>Fractie</span>
				<select
					value={fractie}
					onchange={(e) => zet({ fractie: e.currentTarget.value || null, stem: null })}
				>
					<option value="">Geen</option>
					{#if fractie && !fractieKeuze.some((x) => x.naam === fractie)}
						<option value={fractie}>{fractie}</option>
					{/if}
					<optgroup label="Huidige fracties">
						{#each fractieKeuze.filter((x) => x.active) as x (x.key)}
							<option value={x.naam}>{x.naam}</option>
						{/each}
					</optgroup>
					<optgroup label="Eerdere fracties">
						{#each fractieKeuze.filter((x) => !x.active) as x (x.key)}
							<option value={x.naam}>{x.naam}</option>
						{/each}
					</optgroup>
				</select>
			</label>
		</div>
		<div class="periode">
			<Periode {van} {tot} onChange={(v, t) => zet({ van: v || null, tot: t || null })} />
		</div>

		<p class="stand">
			{#each bron === 'zelf' ? perTerm : [] as p (p.term)}
				<span>
					‘{p.term}’:
					{#if p.api === null}
						laden…
					{:else if p.api > p.nagelopen}
						de nieuwste {getal(p.nagelopen)} van {getal(p.api)} besluiten nagelopen, terug tot {korteDatum(
							p.tot
						)}{laden ? ', laden…' : ''}
					{:else}
						{getal(p.api)} besluiten nagelopen{laden && p.nagelopen < p.api ? ', laden…' : ''}
					{/if}
				</span>
			{/each}
		</p>

		{#if fout && !besluiten.length && bron === 'zelf'}
			<p class="status status--fout">Het overzicht kon niet worden geladen.</p>
		{:else if leegte}
			<p class="status">Geen besluiten met deze woorden in de titel.</p>
		{:else}
			<p class="totaal">
				{@render cel(alles.totaal, {}, bezig)}
				{alles.totaal === 1 ? 'besluit' : 'besluiten'}{bezig ? ', tellen…' : ''}
			</p>
			<div class="tabellen" class:tabellen--fractie={!!fractie}>
				{@render tabel('Per soort', 'Soort', soorten, (k) => ({ soort: k }))}
				{@render tabel('Per jaar', 'Jaar', jaren, (k) => ({ jaar: k }))}
			</div>

			<section class="lijst" aria-labelledby="t-lijst">
				<div class="lijst__kop">
					<h2 id="t-lijst">
						{getal(lijstAantal)}
						{lijstAantal === 1 ? 'besluit' : 'besluiten'}
					</h2>
					{#each filterLabels as c (c.k)}
						<a class="chip" href={hrefMet({ [c.k]: null }, false)}
							>{c.label}<span class="chip-x" aria-hidden="true">×</span></a
						>
					{/each}
					{#if filterLabels.length}
						<a class="wis" href={hrefMet({})}>Alle besluiten</a>
					{/if}
					<button
						type="button"
						class="csv"
						onclick={exporteer}
						disabled={!lijst.length || exporteren}>{exporteren ? 'Namen ophalen…' : 'CSV'}</button
					>
				</div>
				<ol class="rijen">
					{#each bron === 'api' ? lijst : lijst.slice(0, getoond) as d (d.key)}
						{@const s = stemVan(d)}
						<li class="rij">
							<span class="rij__datum">{korteDatum(d.date)}</span>
							<div class="rij__tekst">
								<span class="rij__soort"
									>{soortVan(d)}, {d.chamber === 'EK' ? 'Eerste Kamer' : 'Tweede Kamer'}</span
								>
								<a
									class="rij__titel"
									href={buildBronHref(null, { collection: 'decisions', key: d.key })}
									>{d.subject?.trim() || soortVan(d)}</a
								>
								<span class="rij__uitkomst"
									>{UITKOMST_LABEL[uitkomstVan(d)]}{tally(d) ? `, ${tally(d)}` : ''}{#if s}<span
											class="rij__stem">{fractie} <StemTeken keuze={s} /></span
										>{/if}</span
								>
							</div>
						</li>
					{/each}
				</ol>
				{#if bron === 'api' && lijst.length < lijstAantal}
					<button type="button" class="meer" onclick={meerLaden} disabled={lijstLaden}
						>{lijstLaden ? 'Laden…' : `Meer tonen (${getal(lijstAantal - lijst.length)})`}</button
					>
				{:else if bron !== 'api' && lijst.length > getoond}
					<button type="button" class="meer" onclick={() => (getoond += STAP)}
						>Meer tonen ({getal(lijst.length - getoond)})</button
					>
				{/if}
			</section>
		{/if}
	{/if}
</div>

<style>
	.overzicht {
		max-width: 960px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-8);
	}
	.terug {
		margin: 0 0 var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.terug a,
	.status a {
		color: var(--ink-2);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.titel {
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
		overflow-wrap: anywhere;
	}
	.uitleg {
		margin: 0 0 var(--s-4);
		color: var(--ink-2);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
	}
	.keuzes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3) var(--s-5);
		margin-bottom: var(--s-3);
	}
	.fractie {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.fractie select {
		height: var(--s-6);
		padding: 0 var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		color: var(--ink);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.periode {
		max-width: 520px;
		margin-bottom: var(--s-4);
	}
	.stand {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin: 0 0 var(--s-5);
		color: var(--ink-3);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.totaal {
		margin: 0 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-h3);
	}
	.tabellen {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
		gap: var(--s-6);
		align-items: start;
	}
	/* With a fractie's two columns a table needs the width of the page. */
	.tabellen--fractie {
		grid-template-columns: minmax(0, 1fr);
	}
	.tabel h2,
	.lijst h2 {
		margin: 0 0 var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	th,
	td {
		padding: var(--s-1) var(--s-2);
		border-bottom: 1px solid var(--rule);
		text-align: left;
		font-weight: 400;
	}
	/* Column heads at rung 6, the fractie over its two columns at rung 3 (docs/typografie.md). */
	thead th {
		font-size: var(--t-micro);
		color: var(--ink-3);
		border-bottom-color: var(--rule-strong);
		hyphens: auto;
		overflow-wrap: break-word;
	}
	thead th.heel {
		hyphens: manual;
	}
	thead .boven th,
	thead .boven td {
		border-bottom: 0;
		padding-bottom: 0;
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	tbody th {
		color: var(--ink);
		overflow-wrap: break-word;
	}
	.getal {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	td a,
	.totaal a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 2px;
	}
	td a:hover,
	.totaal a:hover {
		text-decoration-color: var(--ink);
	}
	.nul {
		color: var(--ink-3);
	}
	.lijst {
		margin-top: var(--s-7);
	}
	.lijst__kop {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2) var(--s-3);
		margin-bottom: var(--s-3);
	}
	.lijst__kop h2 {
		margin: 0;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		padding: var(--s-1) var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		color: var(--ink);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		text-decoration: none;
	}
	.chip-x {
		color: var(--ink-3);
	}
	.wis {
		color: var(--ink-3);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.csv,
	.meer {
		padding: var(--s-1) var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: transparent;
		color: var(--ink);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		cursor: pointer;
	}
	.csv {
		margin-left: auto;
	}
	.csv:disabled {
		color: var(--ink-3);
		cursor: default;
	}
	.meer {
		margin-top: var(--s-3);
	}
	.rijen {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rij {
		display: grid;
		grid-template-columns: 96px minmax(0, 1fr);
		gap: var(--s-3);
		padding: var(--s-3) 0;
		border-bottom: 1px solid var(--rule);
	}
	.rij__datum,
	.rij__soort,
	.rij__stem {
		margin-left: var(--s-3);
	}
	.rij__uitkomst {
		color: var(--ink-3);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.rij__tekst {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		min-width: 0;
	}
	.rij__titel {
		color: var(--ink);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.rij__titel:hover {
		text-decoration: underline;
	}
	.status {
		color: var(--ink-3);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.status--fout {
		color: var(--ink-2);
	}

	@media (max-width: 640px) {
		.overzicht {
			padding: var(--s-4) var(--s-4) var(--s-7);
		}
		.rij {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-1);
		}
		th,
		td {
			padding: var(--s-1);
		}
	}
</style>
