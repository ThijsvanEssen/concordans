<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	// Overzicht of a topic: its events in the Kruiswoord (concept ux-voorstel/1f), the kinds as
	// columns and the months as rows, and under it the list of a chosen cell. The stemmingen are
	// counted by /api/decisions per day (facets.days), with one fractie's voor and tegen where a
	// fractie is chosen; moties, brieven and toezeggingen are the feed's events, counted from its
	// pages; an amendment counts once per chain of replacing papers (REVISES), in the month of
	// its first paper. Richting lays the researcher's coding over the moties' cells.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api, unwrap } from '$lib/api/client';
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Bepaalregel from '$lib/components/ui/Bepaalregel.svelte';
	import StemTeken from '$lib/components/parliamentary/Stem.svelte';
	import UitkomstTeken from '$lib/components/parliamentary/Uitkomst.svelte';
	import Kruiswoord, { type KolomKop } from '$lib/onderwerpen/Kruiswoord.svelte';
	import { buildBronHref } from '$lib/bron/href';
	import { korteDatum, langeDatum, vandaag } from '$lib/text/datum';
	import { download } from '$lib/verbonden/export';
	import { lees, uitParams, vindIndex } from '$lib/onderwerpen/onderwerpen';
	import { dossierName, naamVanNummer } from '$lib/bron/dossier-naam';
	import { getDecisionDocument } from '$lib/api/records';
	import { getAmendementen } from '$lib/components/parliamentary/amendementen';
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
		csvTabel,
		csvTekst,
		soortVan,
		uitFacets,
		lijstQuery,
		uitkomstVan,
		type Besluit,
		type Filter,
		type Getelden,
		type Stem,
		type Uitkomst
	} from '$lib/onderwerpen/overzicht';
	import {
		FEED_KOLOM,
		amendementKetens,
		grenzenVan,
		kolomVanKind,
		leesKeuze,
		schrijfKeuze,
		tel,
		vakVan,
		vakken as vakkenVan,
		type Aandeel,
		type Amendement,
		type Dag,
		type Keuze,
		type Kolom,
		type Telbaar,
		type Vak
	} from '$lib/onderwerpen/kruiswoord';

	/** Decisions the API gives in one page. */
	const PAGINA = 200;
	/** Rows of a list before `Volgende`. */
	const STAP = 50;
	/** Pages of the feed counted at most (200 events each), the newest first. */
	const FEED_PAGINAS = 5;
	/** Dossiers whose amendments are followed at most (one request each, cached). */
	const DOSSIERS_MAX = 20;

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
	/** The chosen cell (`cel=moties:2026-10`), Richting and the weeks as rows. */
	const keuze = $derived(leesKeuze(params.get('cel')));
	const richtingAan = $derived(params.get('richting') === 'aan');
	const week = $derived(params.get('per') === 'week');
	/** The filters of an older address, read for its list (soort, uitkomst, jaar, stem). */
	const f = $derived<Filter>({
		soort: params.get('soort') || undefined,
		uitkomst: (['aangenomen', 'verworpen', 'overig'] as const).find(
			(u) => u === params.get('uitkomst')
		),
		jaar: params.get('jaar') || undefined,
		stem: (['voor', 'tegen'] as const).find((s) => s === params.get('stem'))
	});

	type Patch = Record<string, string | null>;
	const FILTERS = ['soort', 'uitkomst', 'jaar', 'stem', 'cel'];
	function hrefMet(patch: Patch, alleen = false) {
		const url = new URL(page.url);
		if (alleen) for (const k of FILTERS) url.searchParams.delete(k);
		for (const [k, v] of Object.entries(patch)) {
			if (v === null || v === '') url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		return url.pathname + url.search;
	}
	const zet = (patch: Patch, alleen = false) =>
		goto(hrefMet(patch, alleen), { replaceState: true, keepFocus: true, noScroll: true });
	const kies = (k: Keuze | null) => zet({ cel: k ? schrijfKeuze(k) : null }, true);

	// ── The stemmingen, counted by the API (first paint) ─────────────────────
	// One question with all the words: the decisions per day with how many passed, the
	// counts per kind (for Richting's moties) and the total. The cheapest call of the page.
	let getelden = $state<Getelden | null>(null);
	let dagen = $state<Dag[]>([]);
	let apiTotaal = $state<number | null>(null);
	let tellenLaden = $state(false);
	let tellenFout = $state(false);
	/** The words, the Kamer and the period as /api/decisions takes them. */
	const basisVan = (woorden: string[], k: string, v: string, t: string) => ({
		q: woorden,
		...(k ? { chamber: k } : {}),
		...periode(v, t)
	});
	$effect(() => {
		const woorden = termenSleutel ? termenSleutel.split('|') : [];
		const basis = basisVan(woorden, kamer, van, tot);
		const ac = new AbortController();
		getelden = null;
		dagen = [];
		apiTotaal = null;
		tellenFout = false;
		tellenLaden = !!woorden.length;
		if (!woorden.length) return;
		unwrap(
			api.GET('/api/decisions', { params: { query: { ...basis, limit: 1 } }, signal: ac.signal })
		)
			.then((r) => {
				getelden = r.facets?.years ? uitFacets(r.facets, null) : null;
				dagen = (r.facets?.days ?? []).flatMap((d) =>
					d.date ? [{ date: d.date, count: d.count, passed: d.passed ?? 0 }] : []
				);
				apiTotaal = r.total;
			})
			.catch(() => {
				if (!ac.signal.aborted) tellenFout = true;
			})
			.finally(() => {
				if (!ac.signal.aborted) tellenLaden = false;
			});
		return () => {
			ac.abort();
			tellenLaden = false;
		};
	});

	// One fractie's voor and tegen per day: two more counted questions, no list.
	let fractieDagen = $state<{ voor: Dag[]; tegen: Dag[] } | null>(null);
	let fractieLaden = $state(false);
	$effect(() => {
		const woorden = termenSleutel ? termenSleutel.split('|') : [];
		const basis = basisVan(woorden, kamer, van, tot);
		const wie = fractie;
		const ac = new AbortController();
		fractieDagen = null;
		const vragen = !!wie && !!woorden.length;
		fractieLaden = vragen;
		if (!vragen) return;
		const vraag = (vote: Stem) =>
			unwrap(
				api.GET('/api/decisions', {
					params: { query: { ...basis, party: wie, vote, limit: 1 } },
					signal: ac.signal
				})
			).then((r) =>
				(r.facets?.days ?? []).flatMap((d) => (d.date ? [{ date: d.date, count: d.count }] : []))
			);
		Promise.all([vraag('voor'), vraag('tegen')])
			.then(([voor, tegen]) => (fractieDagen = { voor, tegen }))
			.catch(() => {})
			.finally(() => {
				if (!ac.signal.aborted) fractieLaden = false;
			});
		return () => {
			ac.abort();
			fractieLaden = false;
		};
	});

	// ── The feed's events: moties, amendments, brieven, toezeggingen ─────────
	// Page after page, the newest first, FEED_PAGINAS at most; each page fills the grid as it
	// comes. Where the pages run out first, the months before the last event counted are not
	// counted, and the page says so. The feed's own fractie (what its members signed) is not
	// the fractie's vote: these columns stay unfiltered by fractie.
	type FeedItem = {
		id: string;
		kind: string;
		date: string;
		title: string;
		node: string | null;
		dossier: { key: string; number: string | null; title: string | null } | null;
		path: string | null;
	};
	let feed = $state<FeedItem[]>([]);
	let feedLaden = $state(false);
	/** The day of the last event counted, where the feed has more than was asked. */
	let feedGrens = $state<string | null>(null);
	let dataTot = $state<string | null>(null);
	const KINDS = Object.values(FEED_KOLOM).join(',');
	const naarItem = (i: {
		id: string;
		kind: string;
		date: string;
		title?: string | null;
		node?: { collection: string; key: string } | null;
		dossier?: { key: string; number?: string | null; title?: string | null } | null;
		path?: string | null;
	}): FeedItem => ({
		id: i.id,
		kind: i.kind,
		date: i.date,
		title: i.title ?? '',
		node: i.node ? `${i.node.collection}/${i.node.key}` : null,
		dossier: i.dossier
			? { key: i.dossier.key, number: i.dossier.number ?? null, title: i.dossier.title ?? null }
			: null,
		path: i.path ?? null
	});
	$effect(() => {
		const woorden = termenSleutel ? termenSleutel.split('|') : [];
		const k = kamer;
		const v = van;
		const t = tot;
		const ac = new AbortController();
		feed = [];
		feedGrens = null;
		feedLaden = !!woorden.length;
		if (!woorden.length) return;
		(async () => {
			let cursor: string | undefined;
			for (let n = 0; n < FEED_PAGINAS; n++) {
				const r = await unwrap(
					api.GET('/api/feed', {
						params: {
							query: {
								q: woorden,
								kind: KINDS,
								limit: PAGINA,
								facets: false,
								...(k ? { chamber: k } : {}),
								...(v ? { since: v } : {}),
								...(t ? { until: t } : {}),
								...(cursor ? { cursor } : {})
							}
						},
						signal: ac.signal
					})
				);
				feed = [...feed, ...r.items.map(naarItem)];
				// The newest day of the sources the feed reads: the grid's last month.
				dataTot ??=
					Object.values(r.data_as_of ?? {})
						.map((x) => x.newest?.slice(0, 10) ?? '')
						.sort()
						.at(-1) || null;
				cursor = r.next_cursor ?? undefined;
				if (!cursor) return;
			}
			feedGrens = feed.at(-1)?.date ?? null;
		})()
			.catch(() => {})
			.finally(() => {
				if (!ac.signal.aborted) feedLaden = false;
			});
		return () => {
			ac.abort();
			feedLaden = false;
		};
	});

	// An amendment once per chain: the timetable of each dossier holding a paper of the topic
	// (getAmendementen: one neighbourhood, cached), its chains that hold such a paper. Asked
	// once the feed is counted, two at a time.
	let amendementen = $state<Amendement[]>([]);
	let ketensLaden = $state(false);
	let ketenDossiers = $state<{ gedaan: number; totaal: number }>({ gedaan: 0, totaal: 0 });
	$effect(() => {
		if (feedLaden) return;
		const papieren = feed.filter((i) => i.kind === FEED_KOLOM.amendementen && i.node);
		const ids = new Set(papieren.map((i) => i.node!));
		const dossiers = [
			...new Map(papieren.flatMap((i) => (i.dossier ? [[i.dossier.key, i.dossier]] : []))).values()
		];
		const ac = new AbortController();
		amendementen = [];
		ketenDossiers = { gedaan: 0, totaal: dossiers.length };
		ketensLaden = !!dossiers.length;
		if (!dossiers.length) return;
		const rij = dossiers.slice(0, DOSSIERS_MAX);
		const gevonden = new Map<string, Amendement>();
		const werk = async () => {
			for (let d = rij.shift(); d; d = rij.shift()) {
				if (ac.signal.aborted) return;
				const tr = await getAmendementen(d.key).catch(() => null);
				if (ac.signal.aborted) return;
				for (const a of amendementKetens(tr?.rijen ?? [], ids, d.number))
					if (!gevonden.has(a.id)) gevonden.set(a.id, a);
				amendementen = [...gevonden.values()].sort((a, b) => b.datum.localeCompare(a.datum));
				ketenDossiers = { ...ketenDossiers, gedaan: ketenDossiers.gedaan + 1 };
			}
		};
		Promise.all([werk(), werk()]).finally(() => {
			if (!ac.signal.aborted) ketensLaden = false;
		});
		return () => {
			ac.abort();
			ketensLaden = false;
		};
	});

	// ── The grid ────────────────────────────────────────────────────────────
	/** The visit before this one, where the topic is followed: what is newer is marked. */
	const vorige = $derived.by(() => {
		if (!termen.length) return null;
		const lijst = lees();
		const i = vindIndex(lijst, termen[0]);
		return i >= 0 ? lijst[i].vorige : null;
	});
	const indeling = $derived(week ? 'week' : 'maand');
	const telbaar = $derived.by<Telbaar[]>(() => {
		const uit: Telbaar[] = [];
		for (const i of feed) {
			const k = kolomVanKind(i.kind);
			if (k && k !== 'amendementen') uit.push({ date: i.date, kolom: k });
		}
		for (const a of amendementen) uit.push({ date: a.datum, kolom: 'amendementen' });
		if (fractieDagen) {
			for (const d of fractieDagen.voor)
				uit.push({ date: d.date, kolom: 'aangenomen', count: d.count });
			for (const d of fractieDagen.tegen)
				uit.push({ date: d.date, kolom: 'verworpen', count: d.count });
		}
		return uit;
	});
	const rijen = $derived(tel(fractie ? [] : dagen, telbaar, indeling, vorige));
	/** From the first event (or the period's start) to the period's end or the data's day. */
	const eerste = $derived(
		[...dagen.map((d) => d.date), ...telbaar.map((t) => t.date)].reduce<string | null>(
			(a, d) => (d && (!a || d < a) ? d : a),
			null
		)
	);
	const vakken = $derived(vakkenVan(van || eerste || '', tot || dataTot || vandaag(), indeling));
	const ongeteld = $derived.by<Partial<Record<Kolom, Vak | null>>>(() => {
		if (!feedGrens) return {};
		// The month of the last event counted is counted in part; the ones before not at all.
		const grens = vakVan(feedGrens, indeling);
		const voor = vakken.find((v) => v < grens) ?? null;
		return { moties: voor, amendementen: voor, brieven: voor, toezeggingen: voor };
	});
	const bezig = $derived<Partial<Record<Kolom, boolean>>>({
		moties: feedLaden,
		amendementen: feedLaden || ketensLaden,
		brieven: feedLaden,
		toezeggingen: feedLaden,
		aangenomen: fractie ? fractieLaden : tellenLaden,
		verworpen: fractie ? fractieLaden : tellenLaden
	});
	const alleFracties = $derived(
		fractie ? ' Alle fracties: de fractie geldt alleen voor de stemmingen.' : ''
	);
	const kolommen = $derived<KolomKop[]>([
		{
			k: 'moties',
			label: 'Moties',
			titel: `Ingediende moties met een woord van het onderwerp in de titel of de titel van het dossier.${alleFracties}`
		},
		{
			k: 'amendementen',
			label: 'Amendementen',
			titel: `Een amendement één keer per keten van vervanging, in de maand van zijn eerste stuk; de uitkomst staat in de lijst.${alleFracties}`
		},
		...(fractie
			? ([
					{
						k: 'aangenomen',
						label: 'Voor',
						groep: fractie,
						titel: `Stemmingen waarin ${fractie} voor stemde.`
					},
					{
						k: 'verworpen',
						label: 'Tegen',
						groep: fractie,
						titel: `Stemmingen waarin ${fractie} tegen stemde.`
					}
				] as KolomKop[])
			: ([
					{
						k: 'aangenomen',
						label: 'Aangenomen',
						groep: 'Stemmingen',
						vorm: 'ja',
						titel:
							'Stemmingen over moties, amendementen en wetsvoorstellen met een woord van het onderwerp in de titel: aangenomen.'
					},
					{
						k: 'verworpen',
						label: 'Verworpen',
						groep: 'Stemmingen',
						vorm: 'nee',
						titel:
							'Stemmingen over moties, amendementen en wetsvoorstellen met een woord van het onderwerp in de titel: verworpen.'
					}
				] as KolomKop[])),
		{
			k: 'brieven',
			label: 'Brieven',
			titel: `Brieven van de regering met een woord van het onderwerp in de titel of de titel van het dossier.${alleFracties}`
		},
		{
			k: 'toezeggingen',
			label: 'Toezeggingen',
			titel: `Toezeggingen van bewindspersonen met een woord van het onderwerp in de tekst of de titel van het dossier.${alleFracties}`
		}
	]);
	const leegte = $derived(
		!tellenLaden && !feedLaden && apiTotaal === 0 && !feed.length && !fractieLaden
	);

	// ── Richting: the researcher's own coding of a motie (stance-voorstel, 10 Oct) ──────
	// Positief, negatief or neutraal with respect to this topic, kept in this browser per
	// topic, per motie as voted (its decision). With Richting on, the moties voted in the
	// period are asked, and each month's share of each direction lies as a bar in the cell of
	// the moties. Until a decision names its motie, the bar counts the votes of the month.
	let codering = $state<Codering>(leesCodering());
	const onderwerp = $derived(onderwerpSleutel(termen));
	const mijn = $derived(codering[onderwerp] ?? {});
	const isMotie = (d: Besluit) => /^motie/i.test(soortVan(d));
	function kiesRichting(d: Besluit, r: Richting | null) {
		codering = metRichting(codering, onderwerp, d.key, r);
		schrijfCodering(codering);
	}
	let moties = $state<Besluit[] | null>(null);
	let motiesLaden = $state(false);
	const motieSoorten = $derived(
		(getelden?.soorten ?? [])
			.map(([k]) => k)
			.filter((k) => /^motie/i.test(k))
			.join('|')
	);
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
		motiesLaden = false;
		if (!richtingAan || !motieSoorten || !termenSleutel) return;
		const basis = basisVan(termenSleutel.split('|'), kamer, van, tot);
		const ac = new AbortController();
		moties = null;
		motiesLaden = true;
		Promise.all(motieSoorten.split('|').map((kind) => alle({ ...basis, kind }, ac.signal)))
			.then((lijsten) => (moties = lijsten.flat()))
			.catch(() => {})
			.finally(() => {
				if (!ac.signal.aborted) motiesLaden = false;
			});
		return () => {
			ac.abort();
			motiesLaden = false;
		};
	});
	const aandeel = $derived.by<Map<Vak, Aandeel> | null>(() => {
		if (!richtingAan || !moties) return null;
		const m = new Map<Vak, Aandeel>();
		for (const d of moties) {
			if (!d.date) continue;
			const v = vakVan(d.date, indeling);
			const a = m.get(v) ?? { positief: 0, negatief: 0, neutraal: 0, geen: 0 };
			a[mijn[d.key] ?? 'geen']++;
			m.set(v, a);
		}
		return m;
	});

	// ── The list under the grid ─────────────────────────────────────────────
	// Without a chosen cell, and for a cell of the stemmingen: the decisions, as /api/decisions
	// gives them, with their outcome, the fractie's vote and the coding of a motie. For a cell
	// of the feed: its events of that month; for the amendments: their chains.
	const binnen = (a: string, b: string, max: boolean) => (!a ? b : !b ? a : max === a > b ? a : b);
	const celPeriode = $derived.by(() => {
		if (!keuze) return { v: van, t: tot };
		const g = grenzenVan(keuze.vak);
		return { v: binnen(van, g.van, true), t: binnen(tot, g.tot, false) };
	});
	const lijstSoort = $derived<'besluiten' | 'feed' | 'amendementen'>(
		!keuze || keuze.kolom === 'aangenomen' || keuze.kolom === 'verworpen'
			? 'besluiten'
			: keuze.kolom === 'amendementen'
				? 'amendementen'
				: 'feed'
	);
	const celFilter = $derived<Filter>(
		keuze?.kolom === 'aangenomen'
			? fractie
				? { stem: 'voor' }
				: { uitkomst: 'aangenomen' }
			: keuze?.kolom === 'verworpen'
				? fractie
					? { stem: 'tegen' }
					: { uitkomst: 'verworpen' }
				: keuze
					? {}
					: f
	);
	const lijstVraag = $derived(
		lijstQuery(basisVan(termen, kamer, celPeriode.v, celPeriode.t), celFilter, fractie || null)
	);

	let apiLijst = $state<Besluit[]>([]);
	let lijstTotaal = $state<number | null>(null);
	let lijstLaden = $state(false);
	$effect(() => {
		lijstLaden = false;
		if (lijstSoort !== 'besluiten' || !termenSleutel) return;
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
		return () => {
			ac.abort();
			lijstLaden = false;
		};
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

	// A cell of the feed: its kind in that month, page by page.
	let feedLijst = $state<FeedItem[]>([]);
	let feedCursor = $state<string | null>(null);
	let feedLijstLaden = $state(false);
	const feedVraag = $derived(
		keuze && lijstSoort === 'feed'
			? {
					q: termen,
					kind: FEED_KOLOM[keuze.kolom]!,
					limit: STAP,
					facets: false,
					...(kamer ? { chamber: kamer as 'TK' | 'EK' } : {}),
					...(celPeriode.v ? { since: celPeriode.v } : {}),
					...(celPeriode.t ? { until: celPeriode.t } : {})
				}
			: null
	);
	$effect(() => {
		const query = feedVraag;
		const ac = new AbortController();
		feedLijst = [];
		feedCursor = null;
		feedLijstLaden = !!query;
		if (!query) return;
		unwrap(api.GET('/api/feed', { params: { query }, signal: ac.signal }))
			.then((r) => {
				feedLijst = r.items.map(naarItem);
				feedCursor = r.next_cursor ?? null;
			})
			.catch(() => {})
			.finally(() => {
				if (!ac.signal.aborted) feedLijstLaden = false;
			});
		return () => {
			ac.abort();
			feedLijstLaden = false;
		};
	});
	async function meerFeed() {
		if (feedLijstLaden || !feedVraag || !feedCursor) return;
		feedLijstLaden = true;
		try {
			const r = await unwrap(
				api.GET('/api/feed', { params: { query: { ...feedVraag, cursor: feedCursor } } })
			);
			feedLijst = [...feedLijst, ...r.items.map(naarItem)];
			feedCursor = r.next_cursor ?? null;
		} finally {
			feedLijstLaden = false;
		}
	}
	const celAmendementen = $derived(
		keuze?.kolom === 'amendementen'
			? amendementen.filter((a) => vakVan(a.datum, indeling) === keuze.vak)
			: []
	);
	let amendementenGetoond = $derived.by(() => {
		void keuze;
		return STAP;
	});

	/** How many the list holds, also where only a page of it is loaded. */
	const lijstAantal = $derived(
		lijstSoort === 'besluiten'
			? (lijstTotaal ?? 0)
			: lijstSoort === 'amendementen'
				? celAmendementen.length
				: (rijen.get(keuze!.vak)?.[keuze!.kolom].n ?? feedLijst.length)
	);
	const lijstLaadt = $derived(lijstSoort === 'besluiten' ? lijstLaden : feedLijstLaden);
	/** A fractie's vote on a row, where the cell or an older address says it. */
	const stemVan = (): Stem | undefined => (fractie ? celFilter.stem : undefined);
	const UITKOMST_LABEL: Record<Uitkomst, string> = {
		aangenomen: 'aangenomen',
		verworpen: 'verworpen',
		overig: 'zonder uitkomst'
	};
	const SOORT_LABEL: Record<string, string> = {
		Motie: 'Motie',
		'Brief regering': 'Brief regering',
		toezegging: 'Toezegging'
	};
	const getal = (n: number) => n.toLocaleString('nl-NL');
	const naam = $derived(termen.join('; '));
	const oudeFilters = $derived(!keuze && !!(f.soort || f.uitkomst || f.jaar || f.stem));

	// ── Fracties for the facet ──────────────────────────────────────────────
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

	// ── CSV: the decisions of the list ──────────────────────────────────────
	const CSV_NAMEN = 100;
	const CSV_MAX = 2000;
	let exporteren = $state(false);
	/** One request each, two at a time (the API's limit per address). */
	async function tweeTegelijk<T>(taken: T[], doe: (t: T) => Promise<void>) {
		const rij = [...taken];
		const werk = async () => {
			for (let t = rij.shift(); t !== undefined; t = rij.shift()) await doe(t);
		};
		await Promise.all([werk(), werk()]);
	}
	/** The fractie's vote per decision of the list: from the cell, or asked as two lists. */
	async function stemmenVan(rijen: Besluit[]): Promise<ReadonlyMap<string, Stem>> {
		if (!fractie) return new Map();
		const s = celFilter.stem;
		if (s) return new Map(rijen.map((d) => [d.key, s] as const));
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
		const lijst = await alle(lijstVraag).catch(() => [] as Besluit[]);
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

	/** The coding of this topic as a file, and a file read back into it. */
	function bewaarCodering() {
		const titels = new Map(
			[...(moties ?? []), ...apiLijst].map((d) => [d.key, d.subject?.trim() ?? ''] as const)
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

	const tally = (d: Besluit) =>
		d.tally?.Voor != null && d.tally?.Tegen != null
			? `${d.tally.Voor} voor, ${d.tally.Tegen} tegen`
			: null;
	const feedHref = (i: FeedItem) => {
		if (i.path) return i.path;
		const [collection, key] = (i.node ?? '').split('/');
		return collection && key ? buildBronHref(null, `${collection}/${key}`, { mode: 'graph' }) : '#';
	};
</script>

<RouteKop
	pad="/onderwerpen/overzicht"
	title={naam ? `${naam}, overzicht, Concordans` : undefined}
/>

<div class="overzicht blad">
	<p class="terug"><a href="/onderwerpen">Onderwerpen</a></p>
	<!-- The heading with its action at the right (docs/bediening.md). -->
	<header class="kop">
		<h1 class="titel">{naam || 'Overzicht'}</h1>
		{#if termen.length}
			<button
				type="button"
				class="actie-knop"
				title={lijstSoort === 'besluiten'
					? 'De besluiten van de lijst als CSV'
					: 'Alleen de besluiten gaan als CSV: kies geen cel of een cel van de stemmingen'}
				onclick={exporteer}
				disabled={lijstSoort !== 'besluiten' || !apiLijst.length || exporteren}
				>{exporteren ? 'Ophalen…' : 'CSV'}</button
			>
		{/if}
	</header>

	{#if !termen.length}
		<p class="status">Geen onderwerp gekozen.</p>
	{:else}
		<!-- The choose-line: the period, nothing else. -->
		<div class="regel">
			<Bepaalregel
				periode={{
					van,
					tot,
					onChange: (v, t) => zet({ van: v || null, tot: t || null, cel: null })
				}}
				kamer={{
					waarde: kamer || 'beide',
					opties: [
						{ waarde: 'beide', label: 'Beide' },
						{ waarde: 'TK', label: 'Tweede Kamer' },
						{ waarde: 'EK', label: 'Eerste Kamer' }
					],
					onKies: (v) => zet({ kamer: v === 'beide' ? null : v, cel: null })
				}}
			/>
		</div>
		<div class="indeling blad__indeling">
			<aside class="facetten blad__facetten" aria-label="Verfijnen">
				<button
					type="button"
					class="verfijnen-knop"
					aria-expanded={verfijnenOpen}
					aria-controls="overzicht-facetten"
					onclick={() => (verfijnenOpen = !verfijnenOpen)}>Verfijnen{fractie ? ' (1)' : ''}</button
				>
				<div class="facet-lijst" id="overzicht-facetten" class:open={verfijnenOpen}>
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
											zet({ fractie: null, stem: null, cel: null });
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
													zet({ fractie: x.naam, stem: null, cel: null });
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
				{#if tellenFout && !feed.length}
					<p class="status status--fout">Het overzicht kon niet worden geladen.</p>
				{:else if leegte}
					<p class="status">
						Geen gebeurtenissen met deze woorden in de titel{van || tot ? ' in deze periode' : ''}.
					</p>
				{:else}
					<section class="sectie" aria-labelledby="t-verloop">
						<div class="sectie__kop">
							<h2 id="t-verloop">Verloop</h2>
							<span class="schakels">
								<FilterOptie
									inline
									label="Richting"
									title="Per maand het aandeel van de eigen codering in de cellen van de moties"
									on={richtingAan}
									onToggle={() => zet({ richting: richtingAan ? null : 'aan' })}
								/>
								<FilterOptie
									inline
									label="Per week"
									on={week}
									onToggle={() => zet({ per: week ? null : 'week', cel: null })}
								/>
							</span>
						</div>
						{#if feedGrens || ketenDossiers.totaal > DOSSIERS_MAX || (richtingAan && motiesLaden) || importFout}
							<p class="sectie__regel">
								{#if feedGrens}<span
										>Moties, amendementen, brieven en toezeggingen geteld tot {langeDatum(
											feedGrens
										)}.</span
									>{/if}
								{#if ketenDossiers.totaal > DOSSIERS_MAX}<span
										>Amendementen in {DOSSIERS_MAX} van {getal(ketenDossiers.totaal)} dossiers nagelopen.</span
									>{/if}
								{#if richtingAan && motiesLaden}<span>Moties laden…</span>{/if}
								{#if importFout}<span>Geen codering in dit bestand.</span>{/if}
							</p>
						{/if}
						<Kruiswoord
							{kolommen}
							{vakken}
							{rijen}
							{keuze}
							onKies={kies}
							{bezig}
							{ongeteld}
							{aandeel}
							nieuwSinds={vorige}
							{week}
						/>
					</section>

					<section class="lijst" aria-labelledby="t-lijst">
						<div class="lijst__kop">
							<h2 id="t-lijst">Stukken</h2>
							<span class="aantal">{lijstLaadt && !lijstAantal ? '…' : getal(lijstAantal)}</span>
							{#if richtingAan}
								<!-- Bewaren and laden behind one quiet word, where the coding is done. -->
								<span class="lijst__rechts">
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
								</span>
							{/if}
						</div>
						{#if keuze}
							<p class="selectie">
								{getal(lijstAantal)} in de selectie
								<TekstLink onclick={() => kies(null)}>Selectie wissen</TekstLink>
							</p>
						{:else if oudeFilters}
							<p class="selectie">
								<TekstLink href={hrefMet({}, true)}>Alle besluiten</TekstLink>
							</p>
						{/if}
						<ol class="rijen">
							{#if lijstSoort === 'besluiten'}
								{#each apiLijst as d (d.key)}
									{@const s = stemVan()}
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
																onclick={() => kiesRichting(d, mijn[d.key] === r ? null : r)}
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
							{:else if lijstSoort === 'amendementen'}
								{#each celAmendementen.slice(0, amendementenGetoond) as a (a.id)}
									{@const [collection, key] = a.id.split('/')}
									<li class="rij">
										<span class="rij__datum">{korteDatum(a.datum)}</span>
										<div class="rij__tekst">
											<span class="rij__soort"
												>Amendement{a.dossier ? `, ${a.dossier}` : ''}{a.papieren.length > 1
													? `, ${a.papieren.length} stukken`
													: ''}</span
											>
											<a
												class="rij__titel"
												href={buildBronHref(null, `${collection}/${key}`, { mode: 'graph' })}
												>{a.titel || `Amendement nr. ${a.nummer}`}</a
											>
											{#if a.uitkomst}
												<div class="rij__regel">
													<span class="rij__uitkomst"
														><UitkomstTeken
															soort={a.uitkomst === 'aangenomen'
																? 'ja'
																: a.uitkomst === 'verworpen'
																	? 'nee'
																	: 'open'}
															woord={a.uitkomst}
														/></span
													>
												</div>
											{/if}
										</div>
									</li>
								{/each}
							{:else}
								{#each feedLijst as i (i.id)}
									<li class="rij">
										<span class="rij__datum">{korteDatum(i.date)}</span>
										<div class="rij__tekst">
											<span class="rij__soort"
												>{SOORT_LABEL[i.kind] ?? i.kind}{i.dossier?.number
													? `, ${i.dossier.number}${i.dossier.title ? ` ${i.dossier.title}` : ''}`
													: ''}</span
											>
											<a class="rij__titel" href={feedHref(i)}>{i.title}</a>
										</div>
									</li>
								{/each}
							{/if}
						</ol>
						{#if lijstSoort === 'besluiten' && apiLijst.length < (lijstTotaal ?? 0)}
							<p class="volgende">
								{#if lijstLaden}Laden…{:else}<TekstLink onclick={meerLaden}
										>Volgende besluiten, nog {getal(
											(lijstTotaal ?? 0) - apiLijst.length
										)}</TekstLink
									>{/if}
							</p>
						{:else if lijstSoort === 'feed' && feedCursor}
							<p class="volgende">
								{#if feedLijstLaden}Laden…{:else}<TekstLink onclick={meerFeed}
										>Volgende stukken</TekstLink
									>{/if}
							</p>
						{:else if lijstSoort === 'amendementen' && celAmendementen.length > amendementenGetoond}
							<p class="volgende">
								<TekstLink onclick={() => (amendementenGetoond += STAP)}
									>Volgende amendementen, nog {getal(
										celAmendementen.length - amendementenGetoond
									)}</TekstLink
								>
							</p>
						{/if}
						{#if lijstLaadt && !lijstAantal}<p class="status">Laden…</p>{/if}
					</section>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Rungs of docs/typografie.md: the topic at 1, a section at 2, a row's title at 4, the
	   meta lines at 5 and the labels beside a heading at 6. */
	/* The frame and grid of Bladeren (AppShell): .blad, and .blad__indeling below. */
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
	.lijst {
		margin-top: var(--s-7);
	}
	/* The section's head: its title at the left, its two switches at the right. */
	.sectie__kop {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-1) var(--s-4);
		padding-top: var(--s-3);
		border-top: 2px solid var(--ink);
	}
	.sectie__kop h2 {
		margin: 0 0 var(--s-2);
	}
	.schakels {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
	}
	.lijst__rechts {
		margin-left: auto;
	}
	/* What is chosen in the grid, and the way back: one line over the list. */
	.selectie {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
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
	.rijen {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* As a row of Bladeren (IndexRow): its lead column, gap and inset, so the titles start
	   where they start in every list. */
	.rij {
		display: grid;
		grid-template-columns: 140px minmax(0, 1fr);
		gap: 20px;
		padding: var(--s-3) var(--s-2);
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
		.rij {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-1);
		}
		.rij__richting {
			margin-left: 0;
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
		margin-bottom: var(--s-5);
	}
	/* The facets at the left of the figures and the list, as Actueel and Bladeren. */
	.inhoud {
		min-width: 0;
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
		.regel {
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
