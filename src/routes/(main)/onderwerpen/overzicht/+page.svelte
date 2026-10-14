<script lang="ts">
	import { untrack } from 'svelte';
	import { fractieNaam } from '$lib/bron/menselijk';
	import { formatCount } from '$lib/text/getal';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	// Overzicht of a topic: its events in the Kruiswoord (concept ux-voorstel/1f, ronde 6), the
	// months as rows and the columns under Stukken, Stemmingen and a chosen fractie, and under it
	// the list of a chosen number. The stemmingen are counted by /api/decisions per day
	// (facets.days), with one fractie's voor and tegen where a fractie is chosen; moties,
	// brieven and toezeggingen are the feed's events, counted per period by /api/feed/periods
	// (#444); an amendment counts once per chain of replacing papers (REVISES), in the period of
	// its first paper, as its `amendment_chains` give (#451). A number of the amendments asks
	// the feed for its own period when it opens. Where the counts are not whole, the feed's
	// pages count as before. A strekking chosen (the researcher's own reading of a motie) makes
	// every number count only the moties so read.
	import { page } from '$app/state';
	import { navigate, withParams, type ParamPatch } from '$lib/util/address';
	import { api, unwrap } from '$lib/api/client';
	import { isAborted, report } from '$lib/api/errors';
	import { failureText } from '$lib/components/ui/LoadState.svelte';
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import KeuzeKnoppen from '$lib/components/ui/Keuze.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Bepaalregel from '$lib/components/ui/Bepaalregel.svelte';
	import StemTeken from '$lib/components/parliamentary/Stem.svelte';
	import UitkomstTeken from '$lib/components/parliamentary/Uitkomst.svelte';
	import Kruiswoord, { type KolomKop } from '$lib/onderwerpen/Kruiswoord.svelte';
	import StrekkingTeken from '$lib/onderwerpen/StrekkingTeken.svelte';
	import { buildOpenHref } from '$lib/bron/href';
	import { daysBetween, isDay, korteDatum, langeDatum, maandNaam, vandaag } from '$lib/text/datum';
	import { download } from '$lib/verbonden/export';
	import { lees, uitParams, vindIndex } from '$lib/onderwerpen/onderwerpen';
	import { dossierLabel, dossierName } from '$lib/bron/dossier-naam';
	import { getDecisionDocument } from '$lib/api/records';
	import { besluiten, geteld, telling } from '$lib/api/decisions';
	import { getAmendementen } from '$lib/components/parliamentary/amendementen';
	import {
		BOTH_CHAMBERS,
		CHAMBER_CHOICES,
		chamberFromParam,
		chamberName,
		type Chamber
	} from '$lib/components/parliamentary/chamber';
	import { feedStand, normalizeItem, type FeedItem } from '$lib/components/actueel/feed';
	import {
		LAAG_LABEL,
		STREKKINGEN,
		STREKKING_LABEL,
		STREKKING_LAGEN,
		coderingNaarCsv,
		coderingUitCsv,
		dictumUit,
		leesCodering,
		metStrekking as coderingMet,
		onderwerpSleutel,
		samen,
		schrijfCodering,
		type Codering,
		type Strekking,
		type StrekkingLaag
	} from '$lib/onderwerpen/strekking';
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
		STEMKOLOMMEN,
		amendementKetens,
		besluitTelbaar,
		grenzenVan,
		inCel,
		inVak,
		kolomVanKind,
		leesKeuze,
		metStrekking,
		schrijfKeuze,
		tel,
		vakVan,
		vakken as vakkenVan,
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
	const kamer: Chamber | '' = $derived(chamberFromParam(params.get('kamer')) ?? '');
	// The period, as everywhere (Periode.svelte): days in the URL and to the API.
	const dag = (v: string | null) => (isDay(v) ? v : '');
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
	/** The chosen number (`cel=moties:2026-10`, `cel=voor:2025`, `cel=brieven`). */
	const keuze = $derived(leesKeuze(params.get('cel')));
	/** A strekking chosen: every number counts only the moties so read. */
	const laag = $derived(STREKKING_LAGEN.find((r) => r === params.get('strekking')) ?? null);
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

	const FILTERS = ['soort', 'uitkomst', 'jaar', 'stem', 'cel'];
	const hrefMet = (patch: ParamPatch, alleen = false) =>
		withParams(page.url, patch, { clear: alleen ? FILTERS : [] });
	/** Every patch here is a filter: a step in the history (a filter is a step, typing is not). */
	const zet = (patch: ParamPatch, alleen = false) =>
		navigate(hrefMet(patch, alleen), { step: true });
	const kies = (k: Keuze | null) => zet({ cel: k ? schrijfKeuze(k) : null }, true);

	// ── The stemmingen, counted by the API (first paint) ─────────────────────
	// One question with all the words: the decisions per day with how many passed, the
	// counts per kind (for the moties of a strekking) and the total. The cheapest call of the page.
	let getelden = $state<Getelden | null>(null);
	let dagen = $state<Dag[]>([]);
	let apiTotaal = $state<number | null>(null);
	// Busy from the first draw where the address names a topic: its counts are asked in an
	// effect, after it; until then the totals read "…", not 0 (UX-toets 10 Oct, #26).
	let tellenLaden = $state(untrack(() => !!termenSleutel));
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
		// Only counts: the counted answer (API 0.79.41, decisions.ts).
		geteld({ ...basis, limit: 1 }, ac.signal)
			.then((r) => {
				getelden = r.facets?.years ? uitFacets(r.facets, null) : null;
				dagen = (r.facets?.days ?? []).flatMap((d) =>
					d.date ? [{ date: d.date, count: d.count, passed: d.passed ?? 0 }] : []
				);
				apiTotaal = r.total;
			})
			.catch((e) => {
				report('Overzicht tellingen', e);
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
	let fractieFout = $state(false);
	$effect(() => {
		const woorden = termenSleutel ? termenSleutel.split('|') : [];
		const basis = basisVan(woorden, kamer, van, tot);
		const wie = fractie;
		const ac = new AbortController();
		fractieDagen = null;
		fractieFout = false;
		const vragen = !!wie && !!woorden.length;
		fractieLaden = vragen;
		if (!vragen) return;
		const vraag = (vote: Stem) =>
			geteld({ ...basis, party: wie, vote, limit: 1 }, ac.signal).then((r) =>
				(r.facets?.days ?? []).flatMap((d) => (d.date ? [{ date: d.date, count: d.count }] : []))
			);
		Promise.all([vraag('voor'), vraag('tegen')])
			.then(([voor, tegen]) => (fractieDagen = { voor, tegen }))
			.catch((e) => {
				report('Overzicht fractie', e);
				if (!ac.signal.aborted) fractieFout = true;
			})
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
	let feed = $state<FeedItem[]>([]);
	/** The newest day of the Kamers' papers the feed reads: the grid's last month. */
	const newestDay = (dataAsOf: Parameters<typeof feedStand>[0]) =>
		feedStand(dataAsOf)?.newest.slice(0, 10) ?? null;
	/**
	 * Moties, brieven and toezeggingen counted per period by /api/feed/periods (#444), in one
	 * call, and the amendments once per chain (`amendment_chains`, #451); null where it has no
	 * complete answer (partial, or it failed), and the feed's pages count them as before.
	 */
	let perioden = $state<Telbaar[] | null>(null);
	/** The amendments counted by their chains in /api/feed/periods: the feed is asked for them
	 *  only when a cell of the column opens, and only for its period. */
	let ketensGeteld = $state(false);
	let feedLaden = $state(untrack(() => !!termenSleutel));
	/** The feed's pages broke off: its columns are not counted, not 0. */
	let feedFout = $state(false);
	/** The day of the last event counted, where the feed has more than was asked. */
	let feedGrens = $state<string | null>(null);
	let dataTot = $state<string | null>(null);
	const KINDS = Object.values(FEED_KOLOM).join(',');
	$effect(() => {
		const woorden = termenSleutel ? termenSleutel.split('|') : [];
		const k = kamer;
		const v = van;
		const t = tot;
		const ac = new AbortController();
		const perWeek = week;
		feed = [];
		perioden = null;
		ketensGeteld = false;
		feedGrens = null;
		feedFout = false;
		feedLaden = !!woorden.length;
		if (!woorden.length) return;
		const filters = {
			q: woorden,
			...(k ? { chamber: k } : {}),
			...(v ? { since: v } : {}),
			...(t ? { until: t } : {})
		};
		// Per day for weeks, which the API allows over at most 400 days from a first day.
		const dagen400 = !!v && daysBetween(v, t || vandaag()) <= 400;
		const per = perWeek ? (dagen400 ? 'day' : null) : 'month';
		(async () => {
			if (per) {
				// Without the periods the feed's pages count, as before #444.
				const r = await unwrap(
					api.GET('/api/feed/periods', {
						params: { query: { ...filters, per } },
						signal: ac.signal
					})
				).catch((e) => {
					report('Overzicht perioden', e);
					return null;
				});
				if (r && !r.partial) {
					const ketens = (r.periods ?? []).every((p) => p.amendment_chains != null);
					perioden = (r.periods ?? []).flatMap((p) => [
						...Object.entries(p.counts ?? {}).flatMap(([kind, count]) => {
							const kolom = kolomVanKind(kind);
							return kolom && kolom !== 'amendementen' ? [{ date: p.period, kolom, count }] : [];
						}),
						...(ketens && p.amendment_chains?.count
							? [
									{
										date: p.period,
										kolom: 'amendementen' as Kolom,
										count: p.amendment_chains.count
									}
								]
							: [])
					]);
					ketensGeteld = ketens;
					dataTot = newestDay(r.data_as_of);
				}
			}
			// Everything counted: the feed waits for a cell of the amendments (below).
			if (ketensGeteld) return;
			let cursor: string | undefined;
			for (let n = 0; n < FEED_PAGINAS; n++) {
				const r = await unwrap(
					api.GET('/api/feed', {
						params: {
							query: {
								...filters,
								kind: perioden ? FEED_KOLOM.amendementen : KINDS,
								limit: PAGINA,
								facets: false,
								...(cursor ? { cursor } : {})
							}
						},
						signal: ac.signal
					})
				);
				feed = [...feed, ...r.items.map(normalizeItem)];
				dataTot ??= newestDay(r.data_as_of);
				cursor = r.next_cursor ?? undefined;
				if (!cursor) return;
			}
			feedGrens = feed.at(-1)?.date ?? null;
		})()
			.catch((e) => {
				report('Overzicht feed', e);
				if (!ac.signal.aborted) feedFout = true;
			})
			.finally(() => {
				if (!ac.signal.aborted) feedLaden = false;
			});
		return () => {
			ac.abort();
			feedLaden = false;
		};
	});

	// Counted by their chains, the amendments of one number are asked when it opens: the feed's
	// amendment papers of its period (a month, a week, a year or the whole period), whose chains
	// the effect below finds.
	$effect(() => {
		if (!ketensGeteld || keuze?.kolom !== 'amendementen') return;
		const woorden = termenSleutel ? termenSleutel.split('|') : [];
		const { v: sinds, t: totEnMet } = celPeriode;
		const k = kamer;
		const ac = new AbortController();
		feed = [];
		feedGrens = null;
		feedFout = false;
		feedLaden = true;
		(async () => {
			let cursor: string | undefined;
			for (let n = 0; n < FEED_PAGINAS; n++) {
				const r = await unwrap(
					api.GET('/api/feed', {
						params: {
							query: {
								q: woorden,
								...(k ? { chamber: k } : {}),
								...(sinds ? { since: sinds } : {}),
								...(totEnMet ? { until: totEnMet } : {}),
								kind: FEED_KOLOM.amendementen,
								limit: PAGINA,
								facets: false,
								...(cursor ? { cursor } : {})
							}
						},
						signal: ac.signal
					})
				);
				feed = [...feed, ...r.items.map(normalizeItem)];
				cursor = r.next_cursor ?? undefined;
				if (!cursor) return;
			}
			feedGrens = feed.at(-1)?.date ?? null;
		})()
			.catch((e) => {
				report('Overzicht feed', e);
				if (!ac.signal.aborted) feedFout = true;
			})
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
	let ketensFout = $state(false);
	let ketenDossiers = $state<{ gedaan: number; totaal: number }>({ gedaan: 0, totaal: 0 });
	$effect(() => {
		if (feedLaden) return;
		const papieren = feed.filter((i) => i.kind === FEED_KOLOM.amendementen);
		const ids = new Set(papieren.map((i) => `${i.node.collection}/${i.node.key}`));
		const dossiers = [
			...new Map(papieren.flatMap((i) => (i.dossier ? [[i.dossier.key, i.dossier]] : []))).values()
		];
		const ac = new AbortController();
		amendementen = [];
		ketensFout = false;
		ketenDossiers = { gedaan: 0, totaal: dossiers.length };
		ketensLaden = !!dossiers.length;
		if (!dossiers.length) return;
		const rij = dossiers.slice(0, DOSSIERS_MAX);
		const gevonden = new Map<string, Amendement>();
		const werk = async () => {
			for (let d = rij.shift(); d; d = rij.shift()) {
				if (ac.signal.aborted) return;
				const tr = await getAmendementen(d.key);
				if (ac.signal.aborted) return;
				for (const a of amendementKetens(tr?.rijen ?? [], ids, d.number))
					if (!gevonden.has(a.id)) gevonden.set(a.id, a);
				amendementen = [...gevonden.values()].sort((a, b) => b.datum.localeCompare(a.datum));
				ketenDossiers = { ...ketenDossiers, gedaan: ketenDossiers.gedaan + 1 };
			}
		};
		Promise.all([werk(), werk()])
			.catch((e) => {
				report('Overzicht amendementen', e);
				if (!ac.signal.aborted) ketensFout = true;
			})
			.finally(() => {
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

	// ── Strekking: the researcher's own reading of a motie (stance-voorstel, 10 Oct) ──────
	// Bevorderend, beperkend or neutraal with respect to this topic, kept in this browser per
	// topic, per motie as voted (its decision). With a strekking chosen, the moties voted in the
	// period are asked, page after page, CSV_MAX at most per kind, and every number counts only
	// those so read: the moties by the day of their vote, their outcome and the fractie's vote.
	let codering = $state<Codering>(leesCodering());
	const onderwerp = $derived(onderwerpSleutel(termen));
	const mijn = $derived(codering[onderwerp] ?? {});
	const isMotie = (d: Besluit) => /^motie/i.test(soortVan(d));
	function kiesStrekking(d: Besluit, r: Strekking | null) {
		codering = coderingMet(codering, onderwerp, d.key, r);
		schrijfCodering(codering);
	}
	const strekkingVan = (d: Besluit): StrekkingLaag => mijn[d.key] ?? 'geen';
	let moties = $state<Besluit[] | null>(null);
	let motiesLaden = $state(false);
	let motiesFout = $state(false);
	/** The day of the last motie asked, where a kind had more than CSV_MAX. */
	let motiesGrens = $state<string | null>(null);
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
			// A total still being counted (null) says nothing: a short page ends it.
			if (r.items.length < PAGINA || (r.total !== null && offset + PAGINA >= r.total)) break;
		}
		return uit;
	}
	$effect(() => {
		motiesLaden = false;
		if (!laag || !motieSoorten || !termenSleutel) return;
		const basis = basisVan(termenSleutel.split('|'), kamer, van, tot);
		const ac = new AbortController();
		moties = null;
		motiesGrens = null;
		motiesFout = false;
		motiesLaden = true;
		Promise.all(motieSoorten.split('|').map((kind) => alle({ ...basis, kind }, ac.signal)))
			.then((lijsten) => {
				moties = lijsten.flat();
				const vol = lijsten.filter((l) => l.length >= CSV_MAX);
				motiesGrens =
					vol
						.map((l) => l.at(-1)?.date ?? '')
						.sort()
						.at(-1) || null;
			})
			.catch((e) => {
				report('Overzicht moties', e);
				if (!ac.signal.aborted) motiesFout = true;
			})
			.finally(() => {
				if (!ac.signal.aborted) motiesLaden = false;
			});
		return () => {
			ac.abort();
			motiesLaden = false;
		};
	});
	/** A chosen fractie's vote on each motie, where a strekking is chosen. */
	let fractieStemmen = $state<ReadonlyMap<string, Stem>>(new Map());
	let fractieStemmenLaden = $state(false);
	let fractieStemmenFout = $state(false);
	$effect(() => {
		const wie = fractie;
		fractieStemmen = new Map();
		fractieStemmenLaden = false;
		fractieStemmenFout = false;
		if (!laag || !wie || !motieSoorten || !termenSleutel) return;
		const basis = basisVan(termenSleutel.split('|'), kamer, van, tot);
		const ac = new AbortController();
		const st = new Map<string, Stem>();
		fractieStemmenLaden = true;
		Promise.all(
			motieSoorten.split('|').flatMap((kind) =>
				(['voor', 'tegen'] as const).map((vote) =>
					alle({ ...basis, kind, party: wie, vote }, ac.signal).then((xs) => {
						for (const d of xs) st.set(d.key, vote);
					})
				)
			)
		)
			.then(() => (fractieStemmen = st))
			.catch((e) => {
				report('Overzicht fractiestemmen', e);
				if (!ac.signal.aborted) fractieStemmenFout = true;
			})
			.finally(() => {
				if (!ac.signal.aborted) fractieStemmenLaden = false;
			});
		return () => {
			ac.abort();
			fractieStemmenLaden = false;
		};
	});
	/** The moties of the chosen strekking. */
	const laagMoties = $derived(
		laag && moties ? moties.filter((d) => strekkingVan(d) === laag) : null
	);

	const telbaar = $derived.by<Telbaar[]>(() => {
		if (laag) return besluitTelbaar(laagMoties ?? [], fractieStemmen);
		const uit: Telbaar[] = [];
		if (perioden) uit.push(...perioden);
		else
			for (const i of feed) {
				const k = kolomVanKind(i.kind);
				if (k && k !== 'amendementen') uit.push({ date: i.date, kolom: k });
			}
		if (!ketensGeteld)
			for (const a of amendementen) uit.push({ date: a.datum, kolom: 'amendementen' });
		if (fractieDagen) {
			for (const d of fractieDagen.voor) uit.push({ date: d.date, kolom: 'voor', count: d.count });
			for (const d of fractieDagen.tegen)
				uit.push({ date: d.date, kolom: 'tegen', count: d.count });
		}
		return uit;
	});
	const rijen = $derived(tel(laag ? [] : dagen, telbaar, indeling, vorige));
	/** From the first event (or the period's start) to the period's end or the data's day. */
	const eerste = $derived(
		[
			...dagen.map((d) => d.date),
			...(perioden ?? feed).map((t) => t.date),
			...amendementen.map((a) => a.datum)
		].reduce<string | null>((a, d) => (d && (!a || d < a) ? d : a), null)
	);
	const vakken = $derived(vakkenVan(van || eerste || '', tot || dataTot || vandaag(), indeling));
	const ongeteld = $derived.by<Partial<Record<Kolom, Vak | null>>>(() => {
		// The period of the last event counted is counted in part; the ones before not at all.
		const voor = (dag: string) => {
			const grens = vakVan(dag, indeling);
			return vakken.find((v) => v < grens) ?? null;
		};
		if (laag) {
			if (!motiesGrens) return {};
			const v = voor(motiesGrens);
			return Object.fromEntries(['moties', ...STEMKOLOMMEN].map((k) => [k, v]));
		}
		// Counted by the API, the columns are whole; the amendments too where their chains are.
		if (!feedGrens || ketensGeteld) return {};
		const v = voor(feedGrens);
		return perioden
			? { amendementen: v }
			: { moties: v, amendementen: v, brieven: v, toezeggingen: v };
	});
	const bezig = $derived.by<Partial<Record<Kolom, boolean>>>(() => {
		if (laag) {
			const b = motiesLaden || (!moties && !!motieSoorten);
			return {
				moties: b,
				aangenomen: b,
				verworpen: b,
				voor: b || fractieStemmenLaden,
				tegen: b || fractieStemmenLaden
			};
		}
		return {
			moties: feedLaden,
			// Counted by their chains, the column stands; only an opened cell's list is asked.
			amendementen: !ketensGeteld && (feedLaden || ketensLaden),
			brieven: feedLaden,
			toezeggingen: feedLaden,
			aangenomen: tellenLaden,
			verworpen: tellenLaden,
			voor: fractieLaden,
			tegen: fractieLaden
		};
	});
	/** The columns whose count broke off: not counted and a line, never a 0 (Kruiswoord). */
	const failed = $derived.by<ReadonlySet<Kolom>>(() => {
		const uit = new Set<Kolom>();
		const mark = (fout: boolean, ...ks: Kolom[]) => fout && ks.forEach((k) => uit.add(k));
		if (laag) {
			mark(motiesFout, 'moties', 'aangenomen', 'verworpen', 'voor', 'tegen');
			mark(fractieStemmenFout, 'voor', 'tegen');
			return uit;
		}
		mark(feedFout, 'moties', 'brieven', 'toezeggingen');
		mark(!ketensGeteld && (feedFout || ketensFout), 'amendementen');
		mark(tellenFout, 'aangenomen', 'verworpen');
		mark(fractieFout, 'voor', 'tegen');
		return uit;
	});
	/** With a strekking, the columns it does not apply to stand empty. */
	const uit = $derived<ReadonlySet<Kolom>>(
		new Set(laag ? (['amendementen', 'brieven', 'toezeggingen'] as Kolom[]) : [])
	);
	const kolommen = $derived.by<KolomKop[]>(() => {
		const metWoord = 'met een woord van het onderwerp in de titel';
		const stemmingen = laag
			? `Stemmingen over moties met de strekking ${LAAG_LABEL[laag].toLowerCase()}`
			: `Stemmingen over moties, amendementen en wetsvoorstellen ${metWoord}`;
		const k: KolomKop[] = [
			{
				k: 'moties',
				label: 'Moties',
				groep: 'Stukken',
				titel: laag
					? `Moties met de strekking ${LAAG_LABEL[laag].toLowerCase()}, op de dag van de stemming.`
					: `Ingediende moties ${metWoord} of de titel van het dossier.`
			},
			{
				k: 'amendementen',
				label: 'Amendementen',
				groep: 'Stukken',
				titel:
					'Een amendement één keer per keten van vervanging, in de maand van zijn eerste stuk; de uitkomst staat in de lijst.'
			},
			{
				k: 'brieven',
				label: 'Brieven',
				groep: 'Stukken',
				titel: `Brieven van de regering ${metWoord} of de titel van het dossier.`
			},
			{
				k: 'toezeggingen',
				label: 'Toezeggingen',
				groep: 'Stukken',
				titel:
					'Toezeggingen van bewindspersonen met een woord van het onderwerp in de tekst of de titel van het dossier.'
			},
			{
				k: 'aangenomen',
				label: 'Aangenomen',
				groep: 'Stemmingen',
				vorm: 'ja',
				titel: `${stemmingen}: aangenomen.`
			},
			{
				k: 'verworpen',
				label: 'Verworpen',
				groep: 'Stemmingen',
				vorm: 'nee',
				titel: `${stemmingen}: verworpen.`
			}
		];
		if (fractie)
			k.push(
				{
					k: 'voor',
					label: 'Voor',
					groep: fractie,
					titel: `${stemmingen}, waarin ${fractie} voor stemde.`
				},
				{
					k: 'tegen',
					label: 'Tegen',
					groep: fractie,
					titel: `${stemmingen}, waarin ${fractie} tegen stemde.`
				}
			);
		return k;
	});
	const leegte = $derived(
		!tellenLaden && !feedLaden && apiTotaal === 0 && !feed.length && !fractieLaden
	);

	// ── The list under the grid ─────────────────────────────────────────────
	// Without a chosen number, and for a number of the stemmingen: the decisions, as
	// /api/decisions gives them, with their outcome, the fractie's vote and the strekking of a
	// motie. With a strekking: its moties, counted here. For a number of the feed: its events of
	// that period; for the amendments: their chains.
	const binnen = (a: string, b: string, max: boolean) => (!a ? b : !b ? a : max === a > b ? a : b);
	const celPeriode = $derived.by(() => {
		if (!keuze?.vak) return { v: van, t: tot };
		const g = grenzenVan(keuze.vak);
		return { v: binnen(van, g.van, true), t: binnen(tot, g.tot, false) };
	});
	const lijstSoort = $derived<'besluiten' | 'lokaal' | 'feed' | 'amendementen'>(
		laag && (!keuze || metStrekking(keuze.kolom))
			? 'lokaal'
			: !keuze || STEMKOLOMMEN.includes(keuze.kolom)
				? 'besluiten'
				: keuze.kolom === 'amendementen'
					? 'amendementen'
					: 'feed'
	);
	const celFilter = $derived<Filter>(
		keuze?.kolom === 'aangenomen'
			? { uitkomst: 'aangenomen' }
			: keuze?.kolom === 'verworpen'
				? { uitkomst: 'verworpen' }
				: keuze?.kolom === 'voor'
					? { stem: 'voor' }
					: keuze?.kolom === 'tegen'
						? { stem: 'tegen' }
						: keuze
							? {}
							: f
	);
	/**
	 * The list of a strekking: its moties, those of the chosen number. A row read while the list
	 * stands keeps its place (the coding is read untracked): reading the list of Niet beoordeeld
	 * does not pull the next row under the pointer.
	 */
	const lokaal = $derived.by(() => {
		if (lijstSoort !== 'lokaal') return null;
		// Counted, and no moties among the decisions: an empty list, not one still loading.
		if (!moties) return getelden && !motieSoorten ? [] : null;
		const codes = untrack(() => mijn);
		const bron = moties.filter((d) => (codes[d.key] ?? 'geen') === laag);
		const k = keuze;
		return k ? bron.filter((d) => inCel(d, fractieStemmen.get(d.key), k, indeling)) : bron;
	});
	/** The rows of a list counted here shown, STAP more at a time; another list starts again. */
	let lokaalGetoond = $derived.by(() => {
		void lokaal;
		return STAP;
	});
	const lijstVraag = $derived(
		lijstQuery(basisVan(termen, kamer, celPeriode.v, celPeriode.t), celFilter, fractie || null)
	);

	let apiLijst = $state<Besluit[]>([]);
	let lijstTotaal = $state<number | null>(null);
	// Busy from the first draw where the address names a topic, as the counts above.
	let lijstLaden = $state(untrack(() => !!termenSleutel));
	/** The list under the grid, or its next page, did not come: said under it. */
	let lijstFout = $state<unknown>(null);
	const lijstMislukt = (e: unknown) => {
		report('Overzicht lijst', e);
		if (!isAborted(e)) lijstFout = e;
	};
	$effect(() => {
		lijstLaden = false;
		if (lijstSoort !== 'besluiten' || !termenSleutel) return;
		const query = lijstVraag;
		const ac = new AbortController();
		apiLijst = [];
		lijstTotaal = null;
		lijstFout = null;
		lijstLaden = true;
		besluiten({ ...query, limit: STAP, offset: 0 }, ac.signal)
			.then(async (r) => {
				apiLijst = r.items;
				lijstTotaal = r.total;
				lijstLaden = false;
				// The total still being counted: the list stands, its number comes after ('…').
				const t = await telling(r, { ...query, limit: STAP, offset: 0 }, ac.signal);
				if (t) lijstTotaal = t.total;
			})
			.catch(lijstMislukt)
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
		lijstFout = null;
		try {
			const r = await unwrap(
				api.GET('/api/decisions', {
					params: { query: { ...lijstVraag, limit: STAP, offset: apiLijst.length } }
				})
			);
			apiLijst = [...apiLijst, ...r.items];
		} catch (e) {
			lijstMislukt(e);
		} finally {
			lijstLaden = false;
		}
	}

	// A cell of the feed: its kind in that month, page by page.
	let feedLijst = $state<FeedItem[]>([]);
	let feedCursor = $state<string | null>(null);
	let feedLijstLaden = $state(untrack(() => !!termenSleutel));
	const feedVraag = $derived(
		keuze && lijstSoort === 'feed'
			? {
					q: termen,
					kind: FEED_KOLOM[keuze.kolom]!,
					limit: STAP,
					facets: false,
					...(kamer ? { chamber: kamer } : {}),
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
		lijstFout = null;
		feedLijstLaden = !!query;
		if (!query) return;
		unwrap(api.GET('/api/feed', { params: { query }, signal: ac.signal }))
			.then((r) => {
				feedLijst = r.items.map(normalizeItem);
				feedCursor = r.next_cursor ?? null;
			})
			.catch(lijstMislukt)
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
		lijstFout = null;
		try {
			const r = await unwrap(
				api.GET('/api/feed', { params: { query: { ...feedVraag, cursor: feedCursor } } })
			);
			feedLijst = [...feedLijst, ...r.items.map(normalizeItem)];
			feedCursor = r.next_cursor ?? null;
		} catch (e) {
			lijstMislukt(e);
		} finally {
			feedLijstLaden = false;
		}
	}
	const celAmendementen = $derived(
		keuze?.kolom === 'amendementen'
			? amendementen.filter((a) => inVak(vakVan(a.datum, indeling), keuze.vak))
			: []
	);
	let amendementenGetoond = $derived.by(() => {
		void keuze;
		return STAP;
	});

	/** How many the list holds, also where only a page of it is loaded; null while counted. */
	const lijstAantal = $derived(
		lijstSoort === 'lokaal'
			? (lokaal?.length ?? null)
			: lijstSoort === 'besluiten'
				? apiLijst.length && lijstTotaal === null
					? null
					: (lijstTotaal ?? 0)
				: lijstSoort === 'amendementen'
					? celAmendementen.length
					: vakken
							.filter((v) => inVak(v, keuze!.vak))
							.reduce((n, v) => n + (rijen.get(v)?.[keuze!.kolom].n ?? 0), 0)
	);
	const lijstLaadt = $derived(
		lijstSoort === 'lokaal'
			? motiesLaden || fractieStemmenLaden
			: lijstSoort === 'besluiten'
				? lijstLaden
				: feedLijstLaden
	);
	const besluitRijen = $derived(lokaal ? lokaal.slice(0, lokaalGetoond) : apiLijst);
	/** A fractie's vote on a row: where the number says it, else as counted for a strekking. */
	const stemVan = (d: Besluit): Stem | undefined =>
		fractie ? (celFilter.stem ?? fractieStemmen.get(d.key)) : undefined;
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
	/** A number; '…' for one still being counted (null). */
	const getal = (n: number | null) => (n === null ? '…' : formatCount(n));
	const naam = $derived(termen.join('; '));
	/** What a chosen number is, in words, over the list: `Stemmingen, aangenomen, 2025`. */
	const keuzeNaam = $derived.by(() => {
		if (!keuze) return '';
		const c = kolommen.find((x) => x.k === keuze.kolom);
		const wat = !c ? '' : c.groep === 'Stukken' ? c.label : `${c.groep}, ${c.label.toLowerCase()}`;
		const v = keuze.vak;
		const wanneer = !v
			? ''
			: v.length === 4
				? v
				: v.includes('-W')
					? `week ${Number(v.slice(6))} van ${v.slice(0, 4)}`
					: `${maandNaam(`${v}-01`, false)} ${v.slice(0, 4)}`;
		return [wat, wanneer].filter(Boolean).join(', ');
	});
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
							naam: fractieNaam(x),
							chamber: x.chamber ?? null,
							active: !!x.active
						}))
						.sort((a, b) => a.naam.localeCompare(b.naam, 'nl')))
			)
			// The facet stands without its fracties.
			.catch((e) => report('Overzicht fracties', e));
	});
	const fractieKeuze = $derived(
		fracties.filter((x) => !kamer || !x.chamber || x.chamber === kamer)
	);

	// ── CSV: the decisions of the list ──────────────────────────────────────
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
		if (lokaal) return fractieStemmen;
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
	/** The CSV could not be made: said beside its button, and nothing is downloaded. */
	let exportFout = $state<unknown>(null);
	function exporteer() {
		exporteren = true;
		exportFout = null;
		maakCsv()
			.catch((e) => {
				report('Overzicht CSV', e);
				exportFout = e;
			})
			.finally(() => (exporteren = false));
	}
	async function maakCsv() {
		const lijst = lokaal ?? (await alle(lijstVraag));
		const stemmenLijst = await stemmenVan(lijst);
		// The names the decisions carry (API 0.79.30), one per number.
		const namen = new Map<string, string>();
		for (const d of lijst)
			for (const x of d.dossiers ?? []) {
				const n = dossierName(x);
				if (n !== x.number) namen.set(x.number, n);
			}
		const motie = await motieVelden(lijst);
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
	/** The dictum of a row opens in place, from the decision itself: no request. */
	function toonDictum(key: string) {
		const open = new Set(dictumOpen);
		if (open.has(key)) open.delete(key);
		else open.add(key);
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
						strekking: mijn[d.key] ?? '',
						dictum: d.dictum ?? stuk?.dictum ?? '',
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
		download(`Strekking ${bestandsnaam()}.csv`, coderingNaarCsv(onderwerp, mijn, titels));
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
	const feedHref = (i: FeedItem) =>
		i.path ?? buildOpenHref(null, `${i.node.collection}/${i.node.key}`, { hasText: i.has_text });
</script>

<RouteKop
	pad="/onderwerpen/overzicht"
	title={naam ? `${naam}, overzicht, Concordans` : undefined}
/>

<div class="overzicht blad">
	<p class="terug"><a href="/onderwerpen">Gevolgd</a></p>
	<!-- The heading with its action at the right (docs/bediening.md). -->
	<header class="blad__kop">
		<h1 class="blad__titel">{naam || 'Overzicht'}</h1>
		{#if termen.length}
			<button
				type="button"
				class="btn is-groot"
				title={lijstSoort === 'besluiten' || lijstSoort === 'lokaal'
					? 'De besluiten van de lijst als CSV'
					: 'Alleen de besluiten gaan als CSV: kies geen getal of een getal van de stemmingen'}
				onclick={exporteer}
				disabled={(lijstSoort !== 'besluiten' && lijstSoort !== 'lokaal') ||
					!besluitRijen.length ||
					exporteren}>{exporteren ? 'Ophalen…' : 'CSV'}</button
			>
		{/if}
	</header>
	{#if exportFout}
		<p class="stil" role="alert">De CSV kon niet worden gemaakt.</p>
	{/if}

	{#if !termen.length}
		<p class="status stil">Geen onderwerp gekozen.</p>
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
					waarde: kamer || BOTH_CHAMBERS,
					opties: CHAMBER_CHOICES,
					onKies: (v) => zet({ kamer: v === BOTH_CHAMBERS ? null : v, cel: null })
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
										class="tekstmenu__item menu-regel"
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
												class="tekstmenu__item menu-regel"
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
					<p class="status status--fout stil">Het overzicht kon niet worden geladen.</p>
				{:else if leegte}
					<p class="status stil">
						Geen gebeurtenissen met deze woorden in de titel{van || tot ? ' in deze periode' : ''}.
					</p>
				{:else}
					<section class="sectie" aria-labelledby="t-verloop">
						<div class="sectie__kop">
							<h2 id="t-verloop">Verloop</h2>
							<span class="schakels">
								<!-- The strekking as a layer: one chosen, every number counts its moties. -->
								<span class="as">
									<span class="as__label" aria-hidden="true">Strekking</span>
									<KeuzeKnoppen
										klein
										label="Strekking"
										opties={[
											{ waarde: 'alle', label: 'Alle' },
											...STREKKING_LAGEN.map((r) => ({ waarde: r, label: LAAG_LABEL[r] }))
										]}
										waarde={laag ?? 'alle'}
										onKies={(w) => zet({ strekking: w === 'alle' ? null : w, cel: null })}
									>
										{#snippet voor(w)}{#if w !== 'alle'}<StrekkingTeken
													strekking={w as StrekkingLaag}
												/>{/if}{/snippet}
									</KeuzeKnoppen>
								</span>
								<FilterOptie
									inline
									label="Per week"
									on={week}
									onToggle={() => zet({ per: week ? null : 'week', cel: null })}
								/>
							</span>
						</div>
						{#if (!laag && (feedGrens || ketenDossiers.totaal > DOSSIERS_MAX)) || (laag && motiesGrens) || importFout}
							<p class="sectie__regel">
								{#if feedGrens && !laag}<span
										>{perioden ? 'Amendementen' : 'Moties, amendementen, brieven en toezeggingen'} doorzocht
										vanaf {langeDatum(feedGrens)}.</span
									>{/if}
								{#if ketenDossiers.totaal > DOSSIERS_MAX && !laag}<span
										>Amendementen in {DOSSIERS_MAX} van {getal(ketenDossiers.totaal)} dossiers nagelopen.</span
									>{/if}
								{#if laag && motiesGrens}<span
										>Moties doorzocht vanaf {langeDatum(motiesGrens)}.</span
									>{/if}
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
							{failed}
							{ongeteld}
							{uit}
							nieuwSinds={vorige}
							{week}
						/>
					</section>

					<section class="lijst" aria-labelledby="t-lijst">
						<div class="lijst__kop">
							<h2 id="t-lijst">Stukken</h2>
							<span class="aantal">{lijstLaadt && !lijstAantal ? '…' : getal(lijstAantal)}</span>
							<!-- Bewaren and laden behind one quiet word, where the coding is done. -->
							<span class="lijst__rechts">
								<TekstMenu klein rechts label="Codering" tekst="Codering">
									{#snippet inhoud(sluit)}
										<button
											type="button"
											role="menuitem"
											class="tekstmenu__item menu-regel"
											disabled={!Object.keys(mijn).length}
											onclick={() => {
												sluit();
												bewaarCodering();
											}}>Bewaren als CSV</button
										>
										<label class="tekstmenu__item menu-regel">
											Laden uit CSV
											<input
												type="file"
												accept=".csv,text/csv"
												class="sr-only"
												onchange={(e) => {
													sluit();
													laadCodering(e).catch((err) => {
														report('Codering', err);
														importFout = true;
													});
												}}
											/>
										</label>
									{/snippet}
								</TekstMenu>
							</span>
						</div>
						{#if keuze || laag}
							<p class="selectie">
								<span
									>{[
										keuze ? keuzeNaam : '',
										laag ? `strekking ${LAAG_LABEL[laag].toLowerCase()}` : ''
									]
										.filter(Boolean)
										.join(', ')
										.replace(/^./, (c) => c.toUpperCase())}</span
								>
								{#if keuze}<TekstLink onclick={() => kies(null)}>Selectie wissen</TekstLink>{/if}
							</p>
						{:else if oudeFilters}
							<p class="selectie">
								<TekstLink href={hrefMet({}, true)}>Alle besluiten</TekstLink>
							</p>
						{/if}
						<ol class="rijen">
							{#if lijstSoort === 'besluiten' || lijstSoort === 'lokaal'}
								{#each besluitRijen as d (d.key)}
									{@const s = stemVan(d)}
									{@const u = uitkomstVan(d)}
									<li class="rij">
										<span class="rij__datum">{korteDatum(d.date)}</span>
										<div class="rij__tekst">
											<span class="rij__soort">{soortVan(d)}, {chamberName(d.chamber)}</span>
											<a
												class="rij__titel"
												href={buildOpenHref(null, { collection: 'decisions', key: d.key })}
												>{d.subject?.trim() || soortVan(d)}</a
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
													<!-- The researcher's reading, quiet: three words, the chosen one in ink;
													     a second click clears it. -->
													<span
														class="rij__strekking"
														role="group"
														aria-label={`Strekking ten opzichte van ${naam}`}
													>
														{#each STREKKINGEN as r (r)}
															<button
																type="button"
																class="keus"
																aria-pressed={mijn[d.key] === r}
																onclick={() => kiesStrekking(d, mijn[d.key] === r ? null : r)}
																>{STREKKING_LABEL[r]}</button
															>
														{/each}
														<!-- Only where the motie has a dictum (the decision's own `dictum`, null
														     for a motie without text): the rule of Actueel (UX-toets 10 Oct). -->
														{#if d.dictum}
															<button
																type="button"
																class="keus keus--dictum"
																aria-expanded={dictumOpen.has(d.key)}
																onclick={() => toonDictum(d.key)}>Dictum</button
															>
														{/if}
													</span>
												{/if}
											</div>
											{#if isMotie(d) && d.dictum && dictumOpen.has(d.key)}
												<p class="rij__dictum">{d.dictum}</p>
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
											<a class="rij__titel" href={buildOpenHref(null, `${collection}/${key}`)}
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
													? `, ${dossierLabel(i.dossier)}`
													: ''}</span
											>
											<a class="rij__titel" href={feedHref(i)}>{i.title}</a>
										</div>
									</li>
								{/each}
							{/if}
						</ol>
						{#if lokaal && lokaal.length > lokaalGetoond}
							<p class="volgende">
								<TekstLink onclick={() => (lokaalGetoond += STAP)}
									>Volgende besluiten, nog {getal(lokaal.length - lokaalGetoond)}</TekstLink
								>
							</p>
						{:else if lijstSoort === 'besluiten' && apiLijst.length < (lijstTotaal ?? 0)}
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
						{#if lijstFout}
							<p class="status stil" role="alert">{failureText('De lijst', lijstFout)}</p>
						{:else if lijstLaadt && !lijstAantal}<p class="status stil">Laden…</p>{/if}
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
	/* An axis as a choice: its name before it, over it on a phone. */
	.as {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
	}
	.as__label {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
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
		grid-template-columns: var(--row-lead) minmax(0, 1fr);
		gap: var(--s-5);
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
	.rij__strekking {
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
	.status--fout {
		color: var(--ink-2);
	}

	@media (max-width: 640px) {
		.rij {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-1);
		}
		.rij__strekking {
			margin-left: 0;
		}
		/* The Strekking on a phone: its name over it, its options in words only and a step
		   closer, so the five fit the width. */
		.as {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--s-1);
		}
		.as :global(.st) {
			display: none;
		}
		.as :global(.keuze button) {
			padding: 0 var(--s-1);
			white-space: nowrap;
		}
	}

	/* The heading: the topic, its action at the right. */
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
	.menu-regel {
		white-space: nowrap;
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
		.facet-lijst {
			display: none;
			padding-top: var(--s-3);
		}
		.facet-lijst.open {
			display: block;
		}
	}
</style>
