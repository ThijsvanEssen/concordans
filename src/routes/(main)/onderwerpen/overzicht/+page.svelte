<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	// Overzicht of a topic: the decisions of the Kamers on moties, amendementen and bills with
	// its words in the title, by kind, outcome and year, and for one fractie by its vote. Every
	// number is a link to the list it counts, on this page; the list goes out as a CSV.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api, unwrap } from '$lib/api/client';
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Periode from '$lib/components/ui/Periode.svelte';
	import StemTeken from '$lib/components/parliamentary/Stem.svelte';
	import UitkomstTeken from '$lib/components/parliamentary/Uitkomst.svelte';
	import { buildBronHref } from '$lib/bron/href';
	import { korteDatum } from '$lib/text/datum';
	import { download } from '$lib/verbonden/export';
	import { uitParams } from '$lib/onderwerpen/onderwerpen';
	import { dossierName, naamVanNummer } from '$lib/bron/dossier-naam';
	import { getDecisionDocument } from '$lib/api/records';
	import {
		RICHTINGEN,
		RICHTING_LABEL,
		coderingNaarCsv,
		coderingUitCsv,
		dictumUit,
		leesCodering,
		metRichting,
		onderwerpSleutel,
		samen,
		schrijfCodering,
		type Codering,
		type Richting
	} from '$lib/onderwerpen/richting';
	import {
		RICHTING_RIJEN,
		csvTabel,
		csvTekst,
		filter,
		richtingTabel,
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
		type RichtingRij,
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
	/** On a phone the facets behind Verfijnen (N), opened in place. */
	let verfijnenOpen = $state(false);
	const f = $derived<Filter>({
		soort: params.get('soort') || undefined,
		uitkomst: (['aangenomen', 'verworpen', 'overig'] as const).find(
			(u) => u === params.get('uitkomst')
		),
		jaar: params.get('jaar') || undefined,
		stem: (['voor', 'tegen'] as const).find((s) => s === params.get('stem'))
	});
	/** A direction as filter: the list is then the moties of the table Richting. */
	const richtingF = $derived(RICHTING_RIJEN.find((r) => r === params.get('richting')));

	const RIJ_LABEL: Record<RichtingRij, string> = { ...RICHTING_LABEL, geen: 'Niet gecodeerd' };
	const FILTERS = ['soort', 'uitkomst', 'jaar', 'stem', 'richting'];
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
		if (bron !== 'api' || !termenSleutel || richtingF) return;
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

	/** Every decision of one question, page after page, CSV_MAX at most. */
	async function alle(query: Record<string, unknown>, signal?: AbortSignal) {
		const uit: Besluit[] = [];
		for (let offset = 0; offset < CSV_MAX; offset += PAGINA) {
			const r = await unwrap(
				api.GET('/api/decisions', {
					params: { query: { ...query, limit: PAGINA, offset } },
					signal
				})
			);
			uit.push(...r.items);
			if (r.items.length < PAGINA || offset + PAGINA >= r.total) break;
		}
		return uit;
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
	const bezig = $derived(bron === 'zelf' ? laden : bron === null || tellenLaden);
	const leegte = $derived(
		bron === 'zelf' ? !laden && !besluiten.length : bron === 'api' && apiTotaal === 0
	);
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
			f.stem && { k: 'stem', label: `${fractie} stemde ${f.stem}` },
			richtingF && { k: 'richting', label: RIJ_LABEL[richtingF] }
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
		return hier ? lijst : alle(lijstVraag);
	}
	/** The fractie's vote per decision of the list: where the API counted, asked as two lists. */
	async function stemmenVan(rijen: Besluit[]): Promise<ReadonlyMap<string, Stem>> {
		if (!fractie) return new Map();
		if (richtingF) return motieStemmenAlle;
		if (bron !== 'api') return stemmen;
		if (f.stem) return new Map(rijen.map((d) => [d.key, f.stem!] as const));
		const m = new Map<string, Stem>();
		await Promise.all(
			(['voor', 'tegen'] as const).map((vote) =>
				alle({ ...lijstVraag, party: fractie, vote }).then((xs) => {
					for (const d of xs) m.set(d.key, vote);
				})
			)
		);
		return m;
	}
	async function exporteer() {
		exporteren = true;
		const lijst = await heleLijst().catch(() => [] as Besluit[]);
		const stemmenLijst = await stemmenVan(lijst).catch(() => new Map<string, Stem>());
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
		const motie = await motieVelden(lijst);
		exporteren = false;
		download(
			`Overzicht ${bestandsnaam()}.csv`,
			csvTekst(
				csvTabel(
					lijst,
					page.url.origin,
					fractie || null,
					stemmenLijst,
					namen,
					lijst.some(isMotie) ? motie : undefined
				)
			)
		);
	}
	const bestandsnaam = () =>
		naam
			.replace(/[\\/:*?"<>|]+/g, ' ')
			.slice(0, 80)
			.trim() || 'onderwerp';

	// ── Richting: the researcher's own coding of a motie (stance-voorstel, 10 Oct) ──────
	// Positief, negatief or neutraal with respect to this topic, kept in this browser per
	// topic, counted over the moties on the page, and in the CSV with the dictum, the
	// indieners and their fracties. The dictum is the motie's own sentence, asked per motie
	// when it is opened (one request each), until the API gives it with the list.
	// Read at once in the browser; the server renders no coding (leesCodering keeps to {}).
	let codering = $state<Codering>(leesCodering());
	const onderwerp = $derived(onderwerpSleutel(termen));
	const mijn = $derived(codering[onderwerp] ?? {});
	const isMotie = (d: Besluit) => /^motie/i.test(soortVan(d));
	function kies(d: Besluit, r: Richting | null) {
		codering = metRichting(codering, onderwerp, d.key, r);
		schrijfCodering(codering);
	}

	type Stuk = { dictum: string | null; metTekst: boolean; indieners: string; fracties: string };
	let stukken = $state<Record<string, Stuk | 'laden' | 'fout'>>({});
	const uitStuk = (doc: Awaited<ReturnType<typeof getDecisionDocument>>): Stuk => ({
		dictum: dictumUit(doc?.text),
		metTekst: !!doc?.text?.trim(),
		indieners: (doc?.submitters ?? []).map((x) => x.name).join('; '),
		fracties: [
			...new Set((doc?.submitters ?? []).flatMap((x) => (x.faction ? [x.faction] : [])))
		].join('; ')
	});
	async function laadStuk(key: string) {
		if (stukken[key] && stukken[key] !== 'fout') return;
		stukken = { ...stukken, [key]: 'laden' };
		try {
			// The answer first, then the current state: a spread before the await would write
			// back an older copy over a load that ended in between.
			const stuk = uitStuk(await getDecisionDocument(key));
			stukken = { ...stukken, [key]: stuk };
		} catch {
			stukken = { ...stukken, [key]: 'fout' };
		}
	}
	let dictumOpen = $state<Set<string>>(new Set());
	function toonDictum(key: string) {
		const open = new Set(dictumOpen);
		if (open.has(key)) open.delete(key);
		else {
			open.add(key);
			void laadStuk(key);
		}
		dictumOpen = open;
	}

	// ── All moties of the selection, for the table Richting ───────────────
	// Counted over every motie within the Kamer and the period, not only the rows of the list:
	// asked once the table is in view, per kind of motie, with the fractie's voor and tegen as
	// two more lists. The table counts the rows of the CSV (csvTabel), so the two agree.
	let moties = $state<Besluit[] | null>(null);
	let motieStemmen = $state<Map<string, Stem>>(new Map());
	let motiesLaden = $state(false);
	let richtingZien = $state(false);
	const motieSoorten = $derived(
		soorten
			.map(([k]) => k)
			.filter((k) => /^motie/i.test(k))
			.join('|')
	);
	$effect(() => {
		if (bron !== 'api' || !(richtingZien || richtingF) || !motieSoorten || !termenSleutel) return;
		const basis = basisVan(termenSleutel.split('|'), kamer, van, tot);
		const wie = fractie;
		const ac = new AbortController();
		moties = null;
		motieStemmen = new Map();
		motiesLaden = true;
		const taken = motieSoorten
			.split('|')
			.flatMap((kind) => [
				{ kind, vote: null },
				...(wie ? (['voor', 'tegen'] as const).map((vote) => ({ kind, vote })) : [])
			]);
		const gezien = new Map<string, Besluit>();
		const st = new Map<string, Stem>();
		tweeTegelijk(taken, ({ kind, vote }) =>
			alle({ ...basis, kind, ...(vote ? { party: wie, vote } : {}) }, ac.signal).then((xs) => {
				for (const d of xs) {
					if (vote) st.set(d.key, vote);
					else gezien.set(d.key, d);
				}
			})
		)
			.then(() => {
				moties = [...gezien.values()].sort(
					(a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.key.localeCompare(b.key)
				);
				motieStemmen = st;
			})
			.catch(() => {})
			.finally(() => {
				if (!ac.signal.aborted) motiesLaden = false;
			});
		return () => ac.abort();
	});
	const alleMoties = $derived(bron === 'zelf' ? besluiten.filter(isMotie) : moties);
	const motieStemmenAlle = $derived(bron === 'zelf' ? stemmen : motieStemmen);
	const heeftMoties = $derived(soorten.some(([k, t]) => /^motie/i.test(k) && t.totaal > 0));
	const richtingRijen = $derived(
		alleMoties
			? richtingTabel(
					csvTabel(
						alleMoties,
						'',
						fractie || null,
						motieStemmenAlle,
						new Map(),
						new Map(alleMoties.map((d) => [d.key, { richting: mijn[d.key] ?? '' }] as const))
					),
					fractie || null
				)
			: null
	);
	const gecodeerd = $derived((alleMoties ?? []).filter((d) => mijn[d.key]).length);

	/** The list on this page: asked of the API page by page, or filtered here where all is here. */
	const hier = $derived(bron !== 'api' || !!richtingF);
	const lijst = $derived(
		richtingF
			? filter(alleMoties ?? [], f, motieStemmenAlle).filter((d) =>
					richtingF === 'geen' ? !mijn[d.key] : mijn[d.key] === richtingF
				)
			: bron === 'api'
				? apiLijst
				: filter(besluiten, f, stemmen)
	);
	/** How many the list holds, also where only a page of it is loaded. */
	const lijstAantal = $derived(hier ? lijst.length : (lijstTotaal ?? 0));
	/** A fractie's vote on a row: known per row where the page counted, else from the filter. */
	const stemVan = (d: Besluit): Stem | undefined =>
		!fractie
			? undefined
			: richtingF
				? motieStemmenAlle.get(d.key)
				: bron === 'api'
					? (f.stem ?? motieStemmen.get(d.key))
					: stemmen.get(d.key);
	// Another list starts at its first rows again.
	let getoond = $derived.by(() => {
		void lijst;
		return STAP;
	});

	/** Once in view, the table Richting asks for its moties. */
	function inBeeld(el: HTMLElement) {
		const kijk = new IntersectionObserver(([e]) => {
			if (!e.isIntersecting) return;
			richtingZien = true;
			kijk.disconnect();
		});
		kijk.observe(el);
		return { destroy: () => kijk.disconnect() };
	}

	/** The coding of this topic as a file, and a file read back into it. */
	function bewaarCodering() {
		const titels = new Map(
			[...(alleMoties ?? []), ...lijst].map((d) => [d.key, d.subject?.trim() ?? ''] as const)
		);
		download(`Richting ${bestandsnaam()}.csv`, coderingNaarCsv(onderwerp, mijn, titels));
	}
	let importFout = $state(false);
	async function laadCodering(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		(e.currentTarget as HTMLInputElement).value = '';
		if (!file) return;
		const gelezen = coderingUitCsv(await file.text());
		importFout = !Object.keys(gelezen).length;
		if (importFout) return;
		codering = samen(codering, gelezen);
		schrijfCodering(codering);
	}

	/** At the CSV: the coded moties' dictum and indieners, two at a time, at most this many. */
	const CSV_STUKKEN = 300;
	async function motieVelden(lijst: Besluit[]) {
		const gecodeerd = lijst.filter((d) => isMotie(d) && mijn[d.key]);
		await tweeTegelijk(
			gecodeerd.slice(0, CSV_STUKKEN).map((d) => d.key),
			(k) => laadStuk(k)
		);
		return new Map(
			lijst.filter(isMotie).map((d) => {
				const st = stukken[d.key];
				const stuk = st && st !== 'laden' && st !== 'fout' ? st : null;
				return [
					d.key,
					{
						richting: mijn[d.key] ?? '',
						dictum: stuk?.dictum ?? '',
						indieners: stuk?.indieners ?? '',
						fracties: stuk?.fracties ?? ''
					}
				] as const;
			})
		);
	}

	const tally = (d: Besluit) =>
		d.tally?.Voor != null && d.tally?.Tegen != null
			? `${d.tally.Voor} voor, ${d.tally.Tegen} tegen`
			: null;
</script>

<RouteKop
	pad="/onderwerpen/overzicht"
	title={naam ? `${naam}, overzicht, Concordans` : undefined}
/>

{#snippet cel(n: number, patch: Patch, bezig = false)}
	{#if n > 0}
		<a href="{hrefMet(patch)}#t-lijst" title="De besluiten achter dit getal">{getal(n)}</a>
	{:else}
		<span class="nul">{bezig ? '…' : '0'}</span>
	{/if}
{/snippet}

<!-- One form for every table of the page: a row per kind, year or direction; all, aangenomen,
     verworpen, and the chosen fractie's voor and tegen. Every number opens its list. -->
{#snippet tabel(
	kolom: string,
	rijen: [string, Telling][],
	patchVan: (k: string) => Patch,
	labelVan: (k: string) => string = (k) => k,
	wacht = false
)}
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
				<th scope="col" class="getal">Alle</th>
				{#each KOLOMMEN as k (k.uitkomst)}<th scope="col" class="getal">{k.label}</th>{/each}
				{#if fractie}
					<th scope="col" class="getal">voor</th>
					<th scope="col" class="getal">tegen</th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each rijen as [k, t] (k)}
				<tr>
					<th scope="row">{labelVan(k)}</th>
					<td class="getal">{@render cel(t.totaal, patchVan(k), wacht)}</td>
					{#each KOLOMMEN as c (c.uitkomst)}
						<td class="getal"
							>{@render cel(t[c.uitkomst], { ...patchVan(k), uitkomst: c.uitkomst }, wacht)}</td
						>
					{/each}
					{#if fractie}
						<td class="getal"
							>{@render cel(t.voor, { ...patchVan(k), stem: 'voor' }, wacht || stemmenLaden)}</td
						>
						<td class="getal"
							>{@render cel(t.tegen, { ...patchVan(k), stem: 'tegen' }, wacht || stemmenLaden)}</td
						>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<div class="overzicht">
	<p class="terug"><a href="/onderwerpen">Onderwerpen</a></p>
	<!-- The heading with its action at the right (docs/bediening.md). -->
	<header class="kop">
		<h1 class="titel">{naam || 'Overzicht'}</h1>
		{#if termen.length}
			<button
				type="button"
				class="actie-knop"
				onclick={exporteer}
				disabled={!lijst.length || exporteren}>{exporteren ? 'Ophalen…' : 'CSV'}</button
			>
		{/if}
	</header>

	{#if !termen.length}
		<p class="status">Geen onderwerp gekozen.</p>
	{:else}
		<!-- The choose-line: the period, nothing else. -->
		<div class="regel">
			<Periode
				{van}
				{tot}
				klein={false}
				onChange={(v, t) => zet({ van: v || null, tot: t || null })}
			/>
		</div>
		<div class="indeling">
			<aside class="facetten" aria-label="Verfijnen">
				<button
					type="button"
					class="verfijnen-knop"
					aria-expanded={verfijnenOpen}
					aria-controls="overzicht-facetten"
					onclick={() => (verfijnenOpen = !verfijnenOpen)}
					>Verfijnen{(kamer ? 1 : 0) + (fractie ? 1 : 0)
						? ` (${(kamer ? 1 : 0) + (fractie ? 1 : 0)})`
						: ''}</button
				>
				<div class="facet-lijst" id="overzicht-facetten" class:open={verfijnenOpen}>
					<section class="facet" aria-labelledby="f-kamer">
						<h2 class="facet__kop" id="f-kamer">Kamer</h2>
						{#each [{ c: 'TK', label: 'Tweede Kamer' }, { c: 'EK', label: 'Eerste Kamer' }] as k (k.c)}
							<FilterOptie
								label={k.label}
								on={kamer === k.c}
								onToggle={() => zet({ kamer: kamer === k.c ? null : k.c })}
							/>
						{/each}
					</section>
					<section class="facet" aria-labelledby="f-fractie">
						<h2 class="facet__kop" id="f-fractie">Fractie</h2>
						<TekstMenu klein label="Fractie" tekst={fractie || 'Geen fractie'}>
							{#snippet inhoud(sluit)}
								<div class="fractie-lijst">
									<button
										type="button"
										role="menuitemradio"
										class="fractie-menuitem"
										aria-checked={!fractie}
										onclick={() => {
											sluit();
											zet({ fractie: null, stem: null });
										}}>Geen fractie</button
									>
									{#each [{ kop: 'Huidige fracties', actief: true }, { kop: 'Eerdere fracties', actief: false }] as groep (groep.kop)}
										<span class="fractie-kop" aria-hidden="true">{groep.kop}</span>
										{#each fractieKeuze.filter((x) => !!x.active === groep.actief) as x (x.key)}
											<button
												type="button"
												role="menuitemradio"
												class="fractie-menuitem"
												aria-checked={fractie === x.naam}
												onclick={() => {
													sluit();
													zet({ fractie: x.naam, stem: null });
												}}>{x.naam}</button
											>
										{/each}
									{/each}
								</div>
							{/snippet}
						</TekstMenu>
					</section>
				</div>
			</aside>
			<div class="inhoud">
				{#if bron === 'zelf'}
					<p class="stand">
						{#each perTerm as p (p.term)}
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
				{/if}

				{#if fout && !besluiten.length && bron === 'zelf'}
					<p class="status status--fout">Het overzicht kon niet worden geladen.</p>
				{:else if leegte}
					<p class="status">Geen besluiten met deze woorden in de titel.</p>
				{:else}
					<!-- The core figures in one line, every number a list. -->
					<p class="kern">
						{@render cel(alles.totaal, {}, bezig)}
						{alles.totaal === 1 ? 'besluit' : 'besluiten'}{#if bezig}, tellen…{:else}:
							{@render cel(alles.aangenomen, { uitkomst: 'aangenomen' })} aangenomen,
							{@render cel(alles.verworpen, { uitkomst: 'verworpen' })}
							verworpen{#if fractie};
								<span class="kern__fractie"
									>{fractie}
									{@render cel(alles.voor, { stem: 'voor' }, stemmenLaden)} voor, {@render cel(
										alles.tegen,
										{ stem: 'tegen' },
										stemmenLaden
									)} tegen</span
								>{/if}{/if}
					</p>

					<div class="tabellen" class:tabellen--fractie={!!fractie}>
						<div class="tabellen__kolom">
							<section class="sectie" aria-labelledby="t-soort">
								<h2 id="t-soort">Per soort</h2>
								{@render tabel('Soort', soorten, (k) => ({ soort: k }))}
							</section>
							{#if heeftMoties}
								<section class="sectie" aria-labelledby="t-richting" use:inBeeld>
									<h2 id="t-richting">Richting</h2>
									<div class="sectie__regel">
										<span
											>{#if alleMoties}{getal(gecodeerd)} van {getal(alleMoties.length)} moties gecodeerd{:else if motiesLaden || !richtingZien}Moties
												laden…{:else}De moties konden niet worden geladen.{/if}</span
										>
										<!-- Bewaren and laden behind one quiet word (docs/bediening.md). -->
										<TekstMenu klein rechts label="Codering" tekst="Codering">
											{#snippet inhoud(sluit)}
												<button
													type="button"
													role="menuitem"
													class="codering-menuitem"
													disabled={!Object.keys(mijn).length}
													onclick={() => {
														sluit();
														bewaarCodering();
													}}>Bewaren als CSV</button
												>
												<label class="codering-menuitem">
													Laden uit CSV
													<input
														type="file"
														accept=".csv,text/csv"
														class="verborgen"
														onchange={(e) => {
															sluit();
															laadCodering(e);
														}}
													/>
												</label>
											{/snippet}
										</TekstMenu>
										{#if importFout}<span class="stil">Geen codering in dit bestand.</span>{/if}
									</div>
									{@render tabel(
										'Richting',
										richtingRijen ??
											RICHTING_RIJEN.map((r) => [
												r,
												{ totaal: 0, aangenomen: 0, verworpen: 0, overig: 0, voor: 0, tegen: 0 }
											]),
										(k) => ({ richting: k }),
										(k) => RIJ_LABEL[k as RichtingRij],
										!richtingRijen
									)}
								</section>
							{/if}
						</div>
						<section class="sectie" aria-labelledby="t-jaar">
							<h2 id="t-jaar">Per jaar</h2>
							{@render tabel('Jaar', jaren, (k) => ({ jaar: k }))}
						</section>
					</div>

					<section class="lijst" aria-labelledby="t-lijst">
						<div class="lijst__kop">
							<h2 id="t-lijst">Besluiten</h2>
							<span class="aantal">{lijstLaden && !hier ? '…' : getal(lijstAantal)}</span>
							{#if filterLabels.length}
								<!-- What is chosen stands in ink in the tables above; the way back is one link. -->
								<span class="wis"><TekstLink href={hrefMet({})}>Alle besluiten</TekstLink></span>
							{/if}
						</div>
						<ol class="rijen">
							{#each hier ? lijst.slice(0, getoond) : lijst as d (d.key)}
								{@const s = stemVan(d)}
								{@const u = uitkomstVan(d)}
								<li class="rij">
									<span class="rij__datum">{korteDatum(d.date)}</span>
									<div class="rij__tekst">
										<span class="rij__soort"
											>{soortVan(d)}, {d.chamber === 'EK' ? 'Eerste Kamer' : 'Tweede Kamer'}</span
										>
										<a
											class="rij__titel"
											href={buildBronHref(
												null,
												{ collection: 'decisions', key: d.key },
												{ mode: 'graph' }
											)}>{d.subject?.trim() || soortVan(d)}</a
										>
										<div class="rij__regel">
											<span class="rij__uitkomst"
												><UitkomstTeken
													soort={u === 'aangenomen' ? 'ja' : u === 'verworpen' ? 'nee' : 'open'}
													woord={UITKOMST_LABEL[u]}
												/>{tally(d) ? `, ${tally(d)}` : ''}{#if s}<span class="rij__stem"
														>{fractie} <StemTeken keuze={s} /></span
													>{/if}</span
											>
											{#if isMotie(d)}
												<!-- The researcher's coding, quiet: three words, the chosen one in ink; a
										     second click clears it. -->
												<span
													class="rij__richting"
													role="group"
													aria-label={`Richting ten opzichte van ${naam}`}
												>
													{#each RICHTINGEN as r (r)}
														<button
															type="button"
															class="keus"
															aria-pressed={mijn[d.key] === r}
															onclick={() => kies(d, mijn[d.key] === r ? null : r)}
															>{RICHTING_LABEL[r]}</button
														>
													{/each}
													<button
														type="button"
														class="keus keus--dictum"
														aria-expanded={dictumOpen.has(d.key)}
														onclick={() => toonDictum(d.key)}>Dictum</button
													>
												</span>
											{/if}
										</div>
										{#if isMotie(d) && dictumOpen.has(d.key)}
											{@const st = stukken[d.key]}
											<p class="rij__dictum">
												{#if st === 'laden' || st === undefined}Laden…{:else if st === 'fout'}Kon
													niet worden geladen.{:else if st.dictum}{st.dictum}{:else if !st.metTekst}Tekst
													niet in de gegevens.{:else}Geen dictum in de tekst.{/if}
											</p>
										{/if}
									</div>
								</li>
							{/each}
						</ol>
						{#if !hier && lijst.length < lijstAantal}
							<p class="volgende">
								{#if lijstLaden}Laden…{:else}<TekstLink onclick={meerLaden}
										>Volgende besluiten, nog {getal(lijstAantal - lijst.length)}</TekstLink
									>{/if}
							</p>
						{:else if hier && lijst.length > getoond}
							<p class="volgende">
								<TekstLink onclick={() => (getoond += STAP)}
									>Volgende besluiten, nog {getal(lijst.length - getoond)}</TekstLink
								>
							</p>
						{/if}
						{#if richtingF && !alleMoties}<p class="status">Moties laden…</p>{/if}
					</section>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Rungs of docs/typografie.md: the topic at 1, a section at 2, a row's title at 4, the
	   meta lines at 5 and the labels beside a heading at 6. */
	.overzicht {
		max-width: 1180px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-8);
	}
	.terug {
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.terug a {
		color: var(--ink-2);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.titel {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.stand {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin: 0 0 var(--s-5);
		color: var(--ink-3);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	/* The core figures: one sentence at the size of a section heading. */
	.kern {
		margin: 0 0 var(--s-6);
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		color: var(--ink-2);
	}
	.kern__fractie {
		white-space: nowrap;
	}
	.tabellen {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
		gap: var(--s-6);
		align-items: start;
	}
	.tabellen__kolom {
		display: flex;
		flex-direction: column;
		gap: var(--s-6);
		min-width: 0;
	}
	/* With a fractie's two columns a table needs the width of the page. */
	.tabellen--fractie {
		grid-template-columns: minmax(0, 1fr);
	}
	.sectie h2,
	.lijst h2 {
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 800;
		color: var(--ink);
	}
	/* A state line under a heading, with its quiet actions (rung 6). */
	.sectie__regel {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-1) var(--s-4);
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.verborgen {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.stil {
		color: var(--ink-3);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	th,
	td {
		padding: var(--s-1) var(--s-2);
		border-bottom: 1px solid var(--rule);
		text-align: left;
		font-weight: 400;
	}
	/* Column heads at rung 6, whole words; the fractie over its two columns at rung 3. */
	thead th {
		font-size: var(--t-micro);
		color: var(--ink-3);
		border-bottom-color: var(--rule-strong);
		white-space: nowrap;
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
		overflow-wrap: anywhere;
	}
	.getal {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	td a,
	.kern a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 2px;
	}
	td a:hover,
	.kern a:hover {
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
		margin-bottom: var(--s-2);
		padding-bottom: var(--s-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	.lijst__kop h2 {
		margin: 0;
	}
	.aantal {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.wis {
		color: var(--ink-3);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
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
	.rij__soort {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.rij__datum {
		padding-top: 2px;
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
	/* The outcome left, the coding right on the same line; it wraps under on a phone. */
	.rij__regel {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.rij__uitkomst :global(.uk) {
		font-weight: 600;
	}
	.rij__stem {
		margin-left: var(--s-3);
	}
	.rij__richting {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		margin-left: auto;
	}
	.keus {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-3);
		cursor: pointer;
	}
	.keus:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.keus[aria-pressed='true'] {
		color: var(--ink);
		font-weight: 600;
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 3px;
	}
	.keus--dictum {
		margin-left: var(--s-2);
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 2px;
	}
	.rij__dictum {
		margin: var(--s-1) 0 0;
		padding-left: var(--s-3);
		border-left: 2px solid var(--rule);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.status {
		color: var(--ink-3);
		font-family: var(--font-serif);
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
		.rij__richting {
			margin-left: 0;
		}
		th,
		td {
			padding: var(--s-1) 2px;
		}
		th:first-child {
			padding-left: 0;
		}
	}

	/* The heading: the topic, its action at the right. */
	.kop {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--s-3);
		margin-bottom: var(--s-4);
	}
	.actie-knop {
		height: var(--veld-h);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	.actie-knop:hover:not(:disabled) {
		border-color: var(--ink);
	}
	.actie-knop:disabled {
		color: var(--rule-strong);
		cursor: default;
	}
	.regel {
		max-width: 380px;
		margin-bottom: var(--s-5);
	}
	/* The facets at the left of the figures and the list, as Actueel and Bladeren. */
	.indeling {
		display: grid;
		grid-template-columns: 200px minmax(0, 1fr);
		column-gap: var(--s-7);
		align-items: start;
	}
	.inhoud {
		min-width: 0;
	}
	.facetten {
		position: sticky;
		top: var(--s-4);
	}
	.facet {
		margin-bottom: var(--s-5);
	}
	.facet__kop {
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.verfijnen-knop {
		display: none;
	}
	.fractie-lijst {
		display: flex;
		flex-direction: column;
	}
	.fractie-kop {
		padding: var(--s-2) var(--s-3) var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.fractie-menuitem,
	.codering-menuitem {
		display: block;
		padding: var(--s-1) var(--s-3);
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		color: var(--ink);
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
	}
	.fractie-menuitem:hover,
	.fractie-menuitem:focus-visible,
	.codering-menuitem:hover,
	.codering-menuitem:focus-within {
		background: var(--paper-2);
		outline: none;
	}
	.fractie-menuitem[aria-checked='true'] {
		font-weight: 600;
	}
	.codering-menuitem:disabled {
		color: var(--rule-strong);
		cursor: default;
	}
	.volgende {
		margin: var(--s-4) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
		text-align: center;
	}
	@media (max-width: 767px) {
		.indeling {
			grid-template-columns: minmax(0, 1fr);
		}
		.regel {
			max-width: none;
			margin-bottom: var(--s-3);
		}
		.facetten {
			position: static;
			margin-bottom: var(--s-4);
		}
		.verfijnen-knop {
			display: inline;
			padding: 0;
			border: 0;
			background: none;
			font-family: var(--font-ui);
			font-size: var(--t-ui);
			color: var(--ink);
			text-decoration: underline;
			text-decoration-color: var(--rule-strong);
			text-underline-offset: 4px;
			cursor: pointer;
		}
		.facet-lijst {
			display: none;
			padding-top: var(--s-3);
		}
		.facet-lijst.open {
			display: block;
		}
	}
</style>
