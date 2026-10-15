<script lang="ts">
	// Overview of a topic: its events in the Kruiswoord (concept ux-voorstel/1f, ronde 6), the
	// months as rows and the columns under Stukken, Stemmingen and a chosen fractie, and under it
	// the list of a chosen number. The stemmingen are counted by /api/decisions per day
	// (facets.days), with one fractie's voor and tegen where a fractie is chosen; moties,
	// brieven and toezeggingen are the feed's events, counted per period by /api/feed/periods
	// (#444); an amendment counts once per chain of replacing papers (REVISES), in the period of
	// its first paper, as its `amendment_chains` give (#451). A number of the amendments asks
	// the feed for its own period when it opens. Where the counts are not whole, the feed's
	// pages count as before. A strekking chosen (the researcher's own reading of a motie) makes
	// every number count only the moties so read. The questions are $lib/onderwerpen/overview-load.
	import { motionOrAmendment } from '$lib/text/document-kind';
	import { untrack } from 'svelte';
	import { formatCount } from '$lib/text/getal';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { siteTitle } from '$lib/seo/kop.svelte';
	import { page } from '$app/state';
	import { navigate, withParams, type ParamPatch } from '$lib/util/address';
	import { load } from '$lib/util/load.svelte';
	import { getFeed } from '$lib/api/feed';
	import { isAborted, report } from '$lib/api/errors';
	import Bepaalregel from '$lib/components/ui/Bepaalregel.svelte';
	import type { KolomKop } from '$lib/onderwerpen/Kruiswoord.svelte';
	import OverviewFacets from '$lib/onderwerpen/OverviewFacets.svelte';
	import OverviewCourse from '$lib/onderwerpen/OverviewCourse.svelte';
	import OverviewList from '$lib/onderwerpen/OverviewList.svelte';
	import { isDay, langeDatum, maandNaam, vandaag } from '$lib/text/datum';
	import { download, safeFileName } from '$lib/verbonden/export';
	import { lees, uitParams, vindIndex } from '$lib/onderwerpen/onderwerpen';
	import { dossierOwnName } from '$lib/bron/dossier-naam';
	import { getDecisionDocument } from '$lib/api/records';
	import { besluiten, telling } from '$lib/api/decisions';
	import {
		BOTH_CHAMBERS,
		CHAMBER_CHOICES,
		chamberFromParam,
		type Chamber
	} from '$lib/components/parliamentary/chamber';
	import { normalizeItem, type FeedItem } from '$lib/components/actueel/feed';
	import { twoAtATime } from '$lib/util/two-at-a-time';
	import {
		LAAG_LABEL,
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
		type Strekking
	} from '$lib/onderwerpen/strekking';
	import {
		csvTabel,
		csvTekst,
		soortVan,
		lijstQuery,
		type Besluit,
		type Filter,
		type Stem
	} from '$lib/onderwerpen/overzicht';
	import {
		DOSSIERS_MAX,
		allDecisions,
		amendmentPapers,
		countDecisions,
		countFactionVotes,
		countFeed,
		decisionQuery,
		dossiersOf,
		factionVotesOn,
		feedQuery,
		followChains,
		motionsOf,
		type PeriodCounts,
		type Topic
	} from '$lib/onderwerpen/overview-load';
	import {
		FEED_KOLOM,
		STEMKOLOMMEN,
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
		type Keuze,
		type Kolom,
		type Telbaar,
		type Vak
	} from '$lib/onderwerpen/kruiswoord';

	/** Rows of a list before `Volgende`. */
	const STEP = 50;
	/** At the CSV: the coded moties' dictum and indieners, two at a time, at most this many. */
	const CSV_DOCUMENTS = 300;

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
	const fractie = $derived(params.get('fractie') ?? '');
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
	/** The topic as every question takes it: a new one only where the address names another. */
	const topic = $derived<Topic>({ words: termen, chamber: kamer, from: van, to: tot });
	const asked = $derived(termen.length > 0);

	const FILTERS = ['soort', 'uitkomst', 'jaar', 'stem', 'cel'];
	const hrefMet = (patch: ParamPatch, alleen = false) =>
		withParams(page.url, patch, { clear: alleen ? FILTERS : [] });
	/** Every patch here is a filter: a step in the history (a filter is a step, typing is not). */
	const zet = (patch: ParamPatch, alleen = false) =>
		navigate(hrefMet(patch, alleen), { step: true });
	const kies = (k: Keuze | null) => zet({ cel: k ? schrijfKeuze(k) : null }, true);

	// ── The stemmingen, counted by the API (first paint) ─────────────────────
	// One question with all the words: the decisions per day with how many passed, the counts
	// per kind (for the moties of a strekking) and the total. The cheapest call of the page.
	const counts = load(
		() => (asked ? topic : null),
		(t, signal) => (t ? countDecisions(t, signal) : Promise.resolve(null)),
		'Overzicht tellingen'
	);
	const geteld = $derived(counts.state.status === 'ready' ? counts.state.data : null);
	const getelden = $derived(geteld?.counted ?? null);
	const dagen = $derived(geteld?.days ?? []);
	// Busy from the first draw where the address names a topic: until then the totals read
	// "…", not 0 (UX-toets 10 Oct, #26).
	const tellenLaden = $derived(asked && counts.state.status === 'loading');
	const tellenFout = $derived(counts.state.status === 'error');

	// One fractie's voor and tegen per day: two more counted questions, no list.
	const factionDays = load(
		() => (fractie && asked ? { topic, party: fractie } : null),
		(k, signal) => (k ? countFactionVotes(k.topic, k.party, signal) : Promise.resolve(null)),
		'Overzicht fractie'
	);
	const fractieDagen = $derived(
		factionDays.state.status === 'ready' ? factionDays.state.data : null
	);
	const fractieLaden = $derived(!!fractie && asked && factionDays.state.status === 'loading');
	const fractieFout = $derived(factionDays.state.status === 'error');

	// ── The feed's events: moties, amendments, brieven, toezeggingen ─────────
	// Counted per period, else page after page, the newest first; each page fills the grid as
	// it comes. Where the pages run out first, the months before the last event counted are not
	// counted, and the page says so. The feed's own fractie (what its members signed) is not
	// the fractie's vote: these columns stay unfiltered by fractie.
	let feed = $state<FeedItem[]>([]);
	let periods = $state<PeriodCounts | null>(null);
	/** The day of the last event counted, where the feed has more than was asked. */
	let feedGrens = $state<string | null>(null);
	/** The newest day of the Kamers' papers the feed reads: the grid's last month. */
	let dataTot = $state<string | null>(null);
	const feedLoad = load(
		() => (asked ? { topic, week } : null),
		async (k, signal) => {
			feed = [];
			periods = null;
			feedGrens = null;
			if (!k) return;
			feedGrens = await countFeed(k.topic, k.week, signal, {
				periods: (p) => {
					periods = p;
					dataTot = p.newest;
				},
				page: (items, newest) => {
					feed = [...feed, ...items];
					dataTot ??= newest;
				}
			});
		},
		'Overzicht feed'
	);
	const perioden = $derived(periods?.counted ?? null);
	/** The amendments counted by their chains: the feed is asked for them only when a cell of the
	 *  column opens, and only for its period. */
	const ketensGeteld = $derived(periods?.chains ?? false);
	const feedLaden = $derived(asked && feedLoad.state.status === 'loading');
	/** The feed's pages broke off: its columns are not counted, not 0. */
	const feedFout = $derived(feedLoad.state.status === 'error');

	// Counted by their chains, the amendments of one number are asked when it opens: the feed's
	// amendment papers of its period (a month, a week, a year or the whole period).
	let celPapieren = $state<FeedItem[]>([]);
	let celGrens = $state<string | null>(null);
	const cellLoad = load(
		() =>
			ketensGeteld && keuze?.kolom === 'amendementen'
				? { ...topic, from: celPeriode.v, to: celPeriode.t }
				: null,
		async (t, signal) => {
			if (!t) return;
			celPapieren = [];
			celGrens = null;
			celGrens = await amendmentPapers(t, signal, (items) => {
				celPapieren = [...celPapieren, ...items];
			});
		},
		'Overzicht feed'
	);
	const celLaden = $derived(
		ketensGeteld && keuze?.kolom === 'amendementen' && cellLoad.state.status === 'loading'
	);

	// An amendment once per chain, once its papers are in (followChains, two dossiers at a time).
	const papieren = $derived(
		(ketensGeteld ? celPapieren : feed).filter((i) => i.kind === FEED_KOLOM.amendementen)
	);
	const papierenLaden = $derived(ketensGeteld ? celLaden : feedLaden);
	let amendementen = $state<Amendement[]>([]);
	const chains = load(
		() => (papierenLaden ? null : papieren),
		async (ps, signal) => {
			if (!ps) return;
			amendementen = [];
			await followChains(ps, signal, (found) => {
				amendementen = found;
			});
		},
		'Overzicht amendementen'
	);
	const ketensLaden = $derived(!papierenLaden && chains.state.status === 'loading');
	const ketensFout = $derived(chains.state.status === 'error');
	const ketenDossiers = $derived(dossiersOf(papieren).length);

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
	// period are asked, page after page, DECISIONS_MAX at most per kind, and every number counts
	// only those so read: the moties by the day of their vote, their outcome and the fractie's
	// vote.
	let codering = $state<Codering>(leesCodering());
	const onderwerp = $derived(onderwerpSleutel(termen));
	const mijn = $derived(codering[onderwerp] ?? {});
	const isMotie = (d: Besluit) => motionOrAmendment(soortVan(d)) === 'motie';
	function kiesStrekking(d: Besluit, r: Strekking | null) {
		codering = coderingMet(codering, onderwerp, d.key, r);
		schrijfCodering(codering);
	}
	const motieSoorten = $derived(
		(getelden?.soorten ?? [])
			.map(([k]) => k)
			.filter((k) => motionOrAmendment(k) === 'motie')
			.join('|')
	);
	const motiesGevraagd = $derived(!!laag && !!motieSoorten && asked);
	/** The moties of the topic; they stay while no strekking is chosen, for the coding's titles. */
	let moties = $state<Besluit[] | null>(null);
	/** The day of the last motie asked, where a kind had more than DECISIONS_MAX. */
	let motiesGrens = $state<string | null>(null);
	const motions = load(
		() => (motiesGevraagd ? { topic, kinds: motieSoorten } : null),
		async (k, signal) => {
			if (!k) return;
			moties = null;
			motiesGrens = null;
			const r = await motionsOf(k.topic, k.kinds.split('|'), signal);
			moties = r.motions;
			motiesGrens = r.boundary;
		},
		'Overzicht moties'
	);
	const motiesLaden = $derived(motiesGevraagd && motions.state.status === 'loading');
	const motiesFout = $derived(motions.state.status === 'error');
	/** A chosen fractie's vote on each motie, where a strekking is chosen. */
	const factionVotes = load(
		() => (motiesGevraagd && fractie ? { topic, party: fractie, kinds: motieSoorten } : null),
		async (k, signal) => {
			if (!k) return null;
			const perKind = await Promise.all(
				k.kinds
					.split('|')
					.map((kind) => factionVotesOn({ ...decisionQuery(k.topic), kind }, k.party, signal))
			);
			return new Map(perKind.flatMap((m) => [...m]));
		},
		'Overzicht fractiestemmen'
	);
	const fractieStemmen = $derived<ReadonlyMap<string, Stem>>(
		(factionVotes.state.status === 'ready' ? factionVotes.state.data : null) ?? new Map()
	);
	const fractieStemmenLaden = $derived(
		motiesGevraagd && !!fractie && factionVotes.state.status === 'loading'
	);
	const fractieStemmenFout = $derived(factionVotes.state.status === 'error');
	/** The moties of the chosen strekking. */
	const laagMoties = $derived(
		laag && moties ? moties.filter((d) => (mijn[d.key] ?? 'geen') === laag) : null
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
		!tellenLaden && !feedLaden && geteld?.total === 0 && !feed.length && !fractieLaden
	);
	/** The coding file read held no coding. */
	let importFout = $state(false);
	/** What was not counted in full, under the heading of the Verloop. */
	const notes = $derived.by(() => {
		const grens = ketensGeteld ? celGrens : feedGrens;
		return [
			...(grens && !laag
				? [
						`${perioden ? 'Amendementen' : 'Moties, amendementen, brieven en toezeggingen'} doorzocht vanaf ${langeDatum(grens)}.`
					]
				: []),
			...(ketenDossiers > DOSSIERS_MAX && !laag
				? [`Amendementen in ${DOSSIERS_MAX} van ${getal(ketenDossiers)} dossiers nagelopen.`]
				: []),
			...(laag && motiesGrens ? [`Moties doorzocht vanaf ${langeDatum(motiesGrens)}.`] : []),
			...(importFout ? ['Geen codering in dit bestand.'] : [])
		];
	});

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
	/** The rows of a list counted here shown, STEP more at a time; another list starts again. */
	let lokaalGetoond = $derived.by(() => {
		void lokaal;
		return STEP;
	});
	const lijstVraag = $derived(
		lijstQuery(
			decisionQuery({ ...topic, from: celPeriode.v, to: celPeriode.t }),
			celFilter,
			fractie || null
		)
	);

	/** The next page of a list, asked on Volgende. */
	let meerLaden = $state(false);
	/** The next page of a list did not come: said under it. */
	let meerFout = $state<unknown>(null);
	const meerMislukt = (e: unknown) => {
		report('Overzicht lijst', e);
		if (!isAborted(e)) meerFout = e;
	};

	let apiLijst = $state<Besluit[]>([]);
	let lijstTotaal = $state<number | null>(null);
	const lijstGevraagd = $derived(lijstSoort === 'besluiten' && asked);
	const decisionList = load(
		() => (lijstGevraagd ? lijstVraag : null),
		async (query, signal) => {
			if (!query) return;
			apiLijst = [];
			lijstTotaal = null;
			meerFout = null;
			const first = { ...query, limit: STEP, offset: 0 };
			const r = await besluiten(first, signal);
			apiLijst = r.items;
			lijstTotaal = r.total;
			// The total still being counted: the list stands, its number comes after ('…').
			telling(r, first, signal)
				.then((t) => {
					if (t) lijstTotaal = t.total;
				})
				.catch(meerMislukt);
		},
		'Overzicht lijst'
	);
	async function volgendeBesluiten() {
		if (meerLaden) return;
		meerLaden = true;
		meerFout = null;
		try {
			const r = await besluiten({ ...lijstVraag, limit: STEP, offset: apiLijst.length });
			apiLijst = [...apiLijst, ...r.items];
		} catch (e) {
			meerMislukt(e);
		} finally {
			meerLaden = false;
		}
	}

	// A cell of the feed: its kind in that month, page by page.
	let feedLijst = $state<FeedItem[]>([]);
	let feedCursor = $state<string | null>(null);
	const feedVraag = $derived(
		keuze && lijstSoort === 'feed'
			? {
					...feedQuery({ ...topic, from: celPeriode.v, to: celPeriode.t }),
					kind: FEED_KOLOM[keuze.kolom]!,
					limit: STEP,
					facets: false
				}
			: null
	);
	const feedList = load(
		() => feedVraag,
		async (query, signal) => {
			feedLijst = [];
			feedCursor = null;
			meerFout = null;
			if (!query) return;
			const r = await getFeed(query, { signal, wait: 'short' });
			feedLijst = r.items.map(normalizeItem);
			feedCursor = r.next_cursor ?? null;
		},
		'Overzicht lijst'
	);
	async function volgendeStukken() {
		if (meerLaden || !feedVraag || !feedCursor) return;
		meerLaden = true;
		meerFout = null;
		try {
			const r = await getFeed({ ...feedVraag, cursor: feedCursor }, { wait: 'short' });
			feedLijst = [...feedLijst, ...r.items.map(normalizeItem)];
			feedCursor = r.next_cursor ?? null;
		} catch (e) {
			meerMislukt(e);
		} finally {
			meerLaden = false;
		}
	}
	const celAmendementen = $derived(
		keuze?.kolom === 'amendementen'
			? amendementen.filter((a) => inVak(vakVan(a.datum, indeling), keuze.vak))
			: []
	);
	let amendementenGetoond = $derived.by(() => {
		void keuze;
		return STEP;
	});

	const lijstLaden = $derived(
		(lijstGevraagd && decisionList.state.status === 'loading') || meerLaden
	);
	const feedLijstLaden = $derived(
		(!!feedVraag && feedList.state.status === 'loading') || meerLaden
	);
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
	/** What the list could not load: its first page, its next, or the amendments of a cell. */
	const lijstFout = $derived.by(() => {
		const fout = (s: { status: string; error?: unknown }) =>
			s.status === 'error' ? s.error : null;
		if (lijstSoort === 'besluiten') return fout(decisionList.state) ?? meerFout;
		if (lijstSoort === 'feed') return fout(feedList.state) ?? meerFout;
		if (lijstSoort === 'amendementen') return fout(cellLoad.state) ?? fout(chains.state);
		return null;
	});
	const besluitRijen = $derived(lokaal ? lokaal.slice(0, lokaalGetoond) : apiLijst);
	/** A fractie's vote on a row: where the number says it, else as counted for a strekking. */
	const stemVan = (d: Besluit): Stem | undefined =>
		fractie ? (celFilter.stem ?? fractieStemmen.get(d.key)) : undefined;
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
	const selectie = $derived(
		keuze || laag
			? {
					label: [keuze ? keuzeNaam : '', laag ? `strekking ${LAAG_LABEL[laag].toLowerCase()}` : '']
						.filter(Boolean)
						.join(', ')
						.replace(/^./, (c) => c.toUpperCase()),
					clear: keuze ? () => kies(null) : null
				}
			: null
	);
	const oudeFilters = $derived(!keuze && !!(f.soort || f.uitkomst || f.jaar || f.stem));
	const volgende = $derived.by(() => {
		if (lokaal && lokaal.length > lokaalGetoond)
			return {
				label: `Volgende besluiten, nog ${getal(lokaal.length - lokaalGetoond)}`,
				loading: false,
				onclick: () => (lokaalGetoond += STEP)
			};
		if (lijstSoort === 'besluiten' && apiLijst.length < (lijstTotaal ?? 0))
			return {
				label: `Volgende besluiten, nog ${getal((lijstTotaal ?? 0) - apiLijst.length)}`,
				loading: lijstLaden,
				onclick: volgendeBesluiten
			};
		if (lijstSoort === 'feed' && feedCursor)
			return { label: 'Volgende stukken', loading: feedLijstLaden, onclick: volgendeStukken };
		if (lijstSoort === 'amendementen' && celAmendementen.length > amendementenGetoond)
			return {
				label: `Volgende amendementen, nog ${getal(celAmendementen.length - amendementenGetoond)}`,
				loading: false,
				onclick: () => (amendementenGetoond += STEP)
			};
		return null;
	});

	// ── CSV: the decisions of the list ──────────────────────────────────────
	let exporteren = $state(false);
	/** The fractie's vote per decision of the list: from the cell, or asked as two lists. */
	async function stemmenVan(rijen: Besluit[]): Promise<ReadonlyMap<string, Stem>> {
		if (!fractie) return new Map();
		const s = celFilter.stem;
		if (s) return new Map(rijen.map((d) => [d.key, s] as const));
		if (lokaal) return fractieStemmen;
		return factionVotesOn(lijstVraag, fractie);
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
		const lijst = lokaal ?? (await allDecisions(lijstVraag));
		const stemmenLijst = await stemmenVan(lijst);
		// The names the decisions carry (API 0.79.30), one per number.
		const namen = new Map<string, string>();
		for (const d of lijst)
			for (const x of d.dossiers ?? []) {
				const n = dossierOwnName(x);
				if (n) namen.set(x.number, n);
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
	const bestandsnaam = () => safeFileName(naam, 80) || 'onderwerp';

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
	/** At the CSV: the coded moties' dictum and indieners, two at a time. */
	async function motieVelden(lijst: Besluit[]) {
		const gecodeerd = lijst.filter((d) => isMotie(d) && mijn[d.key]);
		await twoAtATime(
			gecodeerd.slice(0, CSV_DOCUMENTS).map((d) => d.key),
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
	async function laadCodering(file: File) {
		try {
			const gelezen = coderingUitCsv(await file.text());
			importFout = !Object.keys(gelezen).length;
			if (importFout) return;
			codering = samen(codering, gelezen);
			schrijfCodering(codering);
		} catch (e) {
			report('Codering', e);
			importFout = true;
		}
	}
</script>

<RouteKop title={naam ? siteTitle(`${naam}, overzicht`) : undefined} />

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
			<OverviewFacets
				faction={fractie}
				chamber={kamer}
				onChoose={(x) => zet({ fractie: x, stem: null, cel: null })}
			/>
			<div class="inhoud">
				{#if tellenFout && !feed.length}
					<p class="status status--fout stil">Het overzicht kon niet worden geladen.</p>
				{:else if leegte}
					<p class="status stil">
						Geen gebeurtenissen met deze woorden in de titel{van || tot ? ' in deze periode' : ''}.
					</p>
				{:else}
					<OverviewCourse
						layer={laag}
						{notes}
						onLayer={(l) => zet({ strekking: l, cel: null })}
						onWeek={() => zet({ per: week ? null : 'week', cel: null })}
						grid={{
							kolommen,
							vakken,
							rijen,
							keuze,
							onKies: kies,
							bezig,
							failed,
							ongeteld,
							uit,
							nieuwSinds: vorige,
							week
						}}
					/>
					<OverviewList
						kind={lijstSoort}
						count={lijstLaadt && !lijstAantal ? '…' : getal(lijstAantal)}
						selection={selectie}
						allHref={oudeFilters ? hrefMet({}, true) : null}
						decisions={besluitRijen}
						amendments={celAmendementen.slice(0, amendementenGetoond)}
						feedItems={feedLijst}
						faction={fractie}
						voteOf={stemVan}
						coding={mijn}
						topicName={naam}
						onStrekking={kiesStrekking}
						canSaveCoding={Object.keys(mijn).length > 0}
						onSaveCoding={bewaarCodering}
						onLoadCoding={laadCodering}
						more={volgende}
						error={lijstFout}
						loading={lijstLaadt && !lijstAantal}
					/>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* The frame and grid of Bladeren (lib/styles/frame.css): .blad, and .blad__indeling below. */
	.terug {
		margin: 0 0 var(--s-2);
		font-size: var(--t-meta);
	}
	.terug a {
		color: var(--ink-2);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.regel {
		margin-bottom: var(--s-5);
	}
	/* The facets at the left of the figures and the list, as Actueel and Bladeren. */
	.inhoud {
		min-width: 0;
	}
	.status--fout {
		color: var(--ink-2);
	}
	@media (max-width: 768px) {
		.regel {
			margin-bottom: var(--s-3);
		}
	}
</style>
