<script lang="ts">
  // Index — bladeren door één categorie tegelijk, met filters en sortering.
  // Geen netwerk, geen artikeltekst. Layout zonder linker zijbalk; in plaats
  // daarvan een horizontale categorie-strook bovenaan en een uniforme
  // toolbar daaronder. Een rij klapt inline uit met rijke metadata en de
  // drie weergavemodi (Ontdekken / Verdiepen / Lezen) als acties.
  //
  // URL-state houdt elke filter- en sortkeuze vast zodat een gefilterde
  // weergave gedeeld kan worden via een link.
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    fetchCommissies,
    fetchCommissiesWithLeden,
    fetchFracties,
    fetchInstruments,
    fetchJudgments,
    fetchLeden,
    fetchOpenDossiers,
    fetchStemmingen,
    fetchZetels,
  } from '$lib/api/parliamentary-client';
  import type {
    CommissieDTO,
    DossierSummaryDTO,
    FractieDTO,
    InstrumentJurisdiction,
    InstrumentSummaryDTO,
    JudgmentSummaryDTO,
    JudgmentTier,
    LidDTO,
    StemmingSummaryDTO,
    ZetelsResponse,
  } from '$lib/api/parliamentary';
  import { partyColor } from '$lib/utils/party-color';
  import Hemicycle from './Hemicycle.svelte';
  import IndexToolbar, { type Facet, type SortOption } from './index/IndexToolbar.svelte';
  import IndexFaseFilter, { type FaseDef } from './index/IndexFaseFilter.svelte';
  import IndexDetail from './index/IndexDetail.svelte';

  type CategoryKey =
    | 'wetten' | 'arresten' | 'dossiers' | 'commissies'
    | 'leden' | 'fracties' | 'stemmingen';

  let {
    category,
    onSelectCategory,
    onSelectItem,
    onDiscoverItem,
    onReadItem,
    onResultCountChange,
  }: {
    category: CategoryKey;
    onSelectCategory: (k: CategoryKey) => void;
    /** Verdiepen — split mode met netwerk + leespanel. */
    onSelectItem: (collection: string, key: string) => void;
    /** Ontdekken — graph mode met focus op de bron. */
    onDiscoverItem?: (collection: string, key: string) => void;
    /** Lezen — volledige tekst. Alleen relevant voor wetten en arresten. */
    onReadItem?: (collection: string, key: string) => void;
    /** Stuurt {filtered, total, category} terug zodat de chrome het kan tonen. */
    onResultCountChange?: (info: { filtered: number; total: number; category: CategoryKey }) => void;
  } = $props();

  type CategoryDef = { key: CategoryKey; label: string; collection: string };
  const CATEGORIES: CategoryDef[] = [
    { key: 'wetten',     label: 'Wetten',     collection: 'instruments' },
    { key: 'arresten',   label: 'Arresten',   collection: 'judgments' },
    { key: 'dossiers',   label: 'Dossiers',   collection: 'kamerstukdossiers' },
    { key: 'commissies', label: 'Commissies', collection: 'commissies' },
    { key: 'leden',      label: 'Kamerleden', collection: 'leden' },
    { key: 'fracties',   label: 'Fracties',   collection: 'fracties' },
    { key: 'stemmingen', label: 'Stemmingen', collection: 'stemmingen' },
  ];

  // ── URL-driven filter state ─────────────────────────────────────────────
  const q          = $derived($page.url.searchParams.get('q') ?? '');
  const fasesParam = $derived($page.url.searchParams.get('fases') ?? '');
  const fases      = $derived(fasesParam ? fasesParam.split(',').filter(Boolean) : []);
  const trajectKind = $derived($page.url.searchParams.get('traject_kind') ?? '');
  const aangenomen = $derived($page.url.searchParams.get('aangenomen') ?? '');
  const dateFrom   = $derived($page.url.searchParams.get('from') ?? '');
  const dateTo     = $derived($page.url.searchParams.get('to') ?? '');
  const dossierNr  = $derived($page.url.searchParams.get('dossier') ?? '');
  const partijFilt = $derived($page.url.searchParams.get('partij') ?? '');
  const jurisdiction = $derived(($page.url.searchParams.get('jurisdiction') ?? '') as InstrumentJurisdiction | '');
  const court        = $derived($page.url.searchParams.get('court') ?? '');
  const tier         = $derived(($page.url.searchParams.get('tier') ?? '') as JudgmentTier | '');
  const sort         = $derived($page.url.searchParams.get('sort') ?? '');
  // Richting heeft een per-categorie default (zie SORT_DEFAULT_DIR) wanneer
  // er geen ?dir= in de URL staat. Numerieke sortering wil meestal aflopend
  // (meeste eerst), alfabetisch wil oplopend.
  const dirRaw       = $derived($page.url.searchParams.get('dir'));
  const onlyActive   = $derived($page.url.searchParams.get('only_active') === '1');
  const alleenGeldig = $derived($page.url.searchParams.get('alleen_geldig') === '1');
  // Voor Kamerleden en Fracties laden we standaard alleen huidige
  // (zittende) records. ?include_inactive=1 trekt ook historische erbij.
  const includeInactive = $derived($page.url.searchParams.get('include_inactive') === '1');

  function patchUrl(patch: Record<string, string | null>) {
    const url = new URL($page.url.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    goto(url.toString(), { replaceState: false, keepFocus: true, noScroll: true });
  }

  function toggleArrParam(name: string, current: string[], v: string) {
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    patchUrl({ [name]: next.length ? next.join(',') : null });
  }

  // Categorie wisselen: filters resetten zodat ?fase= uit een Dossiers-bezoek
  // niet lekt naar een Stemmingen-bezoek.
  function switchCategory(k: CategoryKey) {
    const url = new URL($page.url.toString());
    for (const p of [
      'q', 'fases', 'traject_kind', 'aangenomen', 'from', 'to', 'dossier',
      'partij', 'jurisdiction', 'court', 'tier', 'sort', 'dir',
      'only_active', 'alleen_geldig', 'include_inactive',
    ]) {
      url.searchParams.delete(p);
    }
    url.searchParams.set('kind', k);
    goto(url.toString(), { replaceState: false, keepFocus: true, noScroll: true });
    onSelectCategory(k);
  }

  // ── Data loaders per category ───────────────────────────────────────────
  let dossiers = $state<DossierSummaryDTO[] | null>(null);
  let commissies = $state<CommissieDTO[] | null>(null);
  let leden = $state<LidDTO[] | null>(null);
  let fracties = $state<FractieDTO[] | null>(null);
  let zetels = $state<ZetelsResponse | null>(null);
  let stemmingen = $state<StemmingSummaryDTO[] | null>(null);
  let instruments = $state<InstrumentSummaryDTO[] | null>(null);
  let instrumentsTotal = $state(0);
  let judgments = $state<JudgmentSummaryDTO[] | null>(null);
  let judgmentsTotal = $state(0);
  let dossiersTotal = $state(0);
  // Paginering is beschikbaar waar de endpoint `offset` ondersteunt.
  // `/api/fracties` retourneert in één keer alles; geen Load More daar.
  let instrumentsHasMore = $state(false);
  let judgmentsHasMore   = $state(false);
  let dossiersHasMore    = $state(false);
  let ledenHasMore       = $state(false);
  let stemmingenHasMore  = $state(false);
  let loading = $state(false);
  let loadingMore = $state(false);
  let error = $state<string | null>(null);

  const PAGE_SIZE = 100;
  const PAGE_SIZE_LARGE = 200;

  function evalHasMore(returned: number, requested: number, total?: number): boolean {
    if (typeof total === 'number' && total > 0) return total > returned;
    return returned >= requested;
  }

  async function loadMoreInstruments() {
    if (loadingMore || !instruments || !instrumentsHasMore) return;
    loadingMore = true;
    try {
      const r = await fetchInstruments({
        limit: PAGE_SIZE,
        offset: instruments.length,
        q: q || undefined,
        jurisdiction: (jurisdiction as InstrumentJurisdiction) || undefined,
        sort: (sort as 'title' | 'article_count' | 'recent_mutation') || undefined,
      });
      const seen = new Set(instruments.map((w) => w.id));
      const fresh = r.items.filter((w) => !seen.has(w.id));
      instruments = [...instruments, ...fresh];
      instrumentsTotal = r.total;
      instrumentsHasMore = fresh.length > 0 && evalHasMore(instruments.length, instruments.length + 1, r.total) && r.items.length >= PAGE_SIZE;
    } catch { /* keep partial */ }
    finally { loadingMore = false; }
  }

  async function loadMoreJudgments() {
    if (loadingMore || !judgments || !judgmentsHasMore) return;
    loadingMore = true;
    try {
      const r = await fetchJudgments({
        limit: PAGE_SIZE,
        offset: judgments.length,
        q: q || undefined,
        court: court || undefined,
        tier: (tier as JudgmentTier) || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        sort: (sort as 'date_desc' | 'date_asc' | 'citation_count') || undefined,
      });
      const seen = new Set(judgments.map((j) => j.id));
      const fresh = r.items.filter((j) => !seen.has(j.id));
      judgments = [...judgments, ...fresh];
      judgmentsTotal = r.total;
      judgmentsHasMore = fresh.length > 0 && r.items.length >= PAGE_SIZE && (r.total === 0 || judgments.length < r.total);
    } catch { /* keep partial */ }
    finally { loadingMore = false; }
  }

  async function loadMoreLeden() {
    if (loadingMore || !leden || !ledenHasMore) return;
    loadingMore = true;
    try {
      const r = await fetchLeden({ limit: PAGE_SIZE_LARGE, offset: leden.length });
      const seen = new Set(leden.map((l) => l.id));
      const fresh = r.filter((l) => !seen.has(l.id));
      leden = [...leden, ...fresh];
      ledenHasMore = fresh.length > 0 && r.length >= PAGE_SIZE_LARGE;
    } catch { /* keep partial */ }
    finally { loadingMore = false; }
  }

  // `/api/fracties` retourneert in één keer alles; geen paginering.

  // `/api/dossiers/open` ondersteunt sinds de backend-bugfix `offset` en
  // retourneert `{total, items}`. Meer laden voegt de volgende slice
  // achteraan toe, ontdubbeld op id voor de zekerheid.
  async function loadMoreDossiers() {
    if (loadingMore || !dossiers || !dossiersHasMore) return;
    loadingMore = true;
    try {
      const r = await fetchOpenDossiers({
        fase: fases.length === 1 ? fases[0] : undefined,
        limit: PAGE_SIZE_LARGE,
        offset: dossiers.length,
      });
      const seen = new Set(dossiers.map((d) => d.id));
      const fresh = r.items.filter((d) => !seen.has(d.id));
      dossiers = [...dossiers, ...fresh];
      dossiersTotal = r.total;
      dossiersHasMore = dossiers.length < r.total && fresh.length > 0;
    } catch { /* keep partial */ }
    finally { loadingMore = false; }
  }

  async function loadMoreStemmingen() {
    if (loadingMore || !stemmingen || !stemmingenHasMore) return;
    loadingMore = true;
    try {
      const r = await fetchStemmingen({ limit: PAGE_SIZE_LARGE, offset: stemmingen.length });
      const seen = new Set(stemmingen.map((s) => s.id));
      const fresh = r.items.filter((s) => !seen.has(s.id));
      stemmingen = [...stemmingen, ...fresh];
      stemmingenHasMore = fresh.length > 0 && r.items.length >= PAGE_SIZE_LARGE && stemmingen.length < r.total;
    } catch { /* keep partial */ }
    finally { loadingMore = false; }
  }

  // Dossiers — re-fetch wanneer de server-side fase-filter wijzigt.
  // We zetten `fase=` alleen door wanneer er precies één fase geselecteerd
  // is; bij multi-select valt het filter terug naar client-side (de
  // server-kant `has_stage` is AND, wij willen OR voor de pijl-multi-select).
  // Sentinel-waarde voor de eerste run zodat het effect ook bij een lege
  // key (geen filter) triggert.
  let lastDossierFetchKey: string | null = null;
  $effect(() => {
    if (category !== 'dossiers') return;
    const fase = fases.length === 1 ? fases[0] : '';
    const key = `${fase}`;
    if (key === lastDossierFetchKey) return;
    lastDossierFetchKey = key;
    loading = true;
    error = null;
    const ac = new AbortController();
    fetchOpenDossiers({ fase: fase || undefined, limit: PAGE_SIZE_LARGE, signal: ac.signal })
      .then((r) => {
        dossiers = r.items;
        dossiersTotal = r.total;
        dossiersHasMore = r.items.length < r.total;
      })
      .catch((e) => { if ((e as Error)?.name !== 'AbortError') error = 'Dossiers konden niet worden geladen.'; })
      .finally(() => { loading = false; });
    return () => ac.abort();
  });

  let lastWettenKey: string | null = null;
  $effect(() => {
    if (category !== 'wetten') return;
    const key = `${q}|${jurisdiction}|${sort}`;
    if (key === lastWettenKey) return;
    lastWettenKey = key;
    loading = true;
    error = null;
    const ac = new AbortController();
    fetchInstruments({
      limit: 100,
      q: q || undefined,
      jurisdiction: (jurisdiction as InstrumentJurisdiction) || undefined,
      sort: (sort as 'title' | 'article_count' | 'recent_mutation') || undefined,
      signal: ac.signal,
    })
      .then((r) => {
        instruments = r.items;
        instrumentsTotal = r.total;
        instrumentsHasMore = evalHasMore(r.items.length, 100, r.total);
      })
      .catch((e) => { if ((e as Error)?.name !== 'AbortError') error = 'Wetten konden niet worden geladen.'; })
      .finally(() => { loading = false; });
    return () => ac.abort();
  });

  let lastArrestenKey: string | null = null;
  $effect(() => {
    if (category !== 'arresten') return;
    const key = `${q}|${court}|${tier}|${dateFrom}|${dateTo}|${sort}`;
    if (key === lastArrestenKey) return;
    lastArrestenKey = key;
    loading = true;
    error = null;
    const ac = new AbortController();
    fetchJudgments({
      limit: 100,
      q: q || undefined,
      court: court || undefined,
      tier: (tier as JudgmentTier) || undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      sort: (sort as 'date_desc' | 'date_asc' | 'citation_count') || undefined,
      signal: ac.signal,
    })
      .then((r) => {
        judgments = r.items;
        judgmentsTotal = r.total;
        judgmentsHasMore = evalHasMore(r.items.length, 100, r.total);
      })
      .catch((e) => {
        if ((e as Error)?.name === 'AbortError') return;
        const msg = (e as Error)?.message ?? '';
        error = msg.includes('500')
          ? 'Arresten-lijst is tijdelijk niet beschikbaar (backend-fout). Probeer later opnieuw.'
          : 'Arresten konden niet worden geladen.';
      })
      .finally(() => { loading = false; });
    return () => ac.abort();
  });

  // One-shot loaders voor categorieën zonder afhankelijke filters
  // (commissies, stemmingen). Leden en fracties hebben hun eigen effect
  // hieronder omdat ze met `actief`-filter heen-en-weer kunnen.
  $effect(() => {
    const c = category;
    if (c !== 'commissies' && c !== 'stemmingen') return;
    if (c === 'commissies' && commissies !== null) return;
    if (c === 'stemmingen' && stemmingen !== null) return;

    loading = true;
    error = null;
    const ac = new AbortController();
    (async () => {
      try {
        if (c === 'commissies') {
          commissies = await fetchCommissies(ac.signal);
        } else if (c === 'stemmingen') {
          const r = await fetchStemmingen({ limit: 200, offset: 0, signal: ac.signal });
          stemmingen = r.items;
          stemmingenHasMore = stemmingen.length >= 200 && (r.total === 0 || stemmingen.length < r.total);
        }
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') error = 'Laden mislukt';
      } finally {
        loading = false;
      }
    })();
    return () => ac.abort();
  });

  // Leden — server-side `actief`-filter werkt sinds backend-bugfix.
  // Default toont alleen zittende Kamerleden; ?include_inactive=1 trekt
  // ook historische erbij via `include_all=true`.
  let lastLedenKey: string | null = null;
  $effect(() => {
    if (category !== 'leden') return;
    const key = `${includeInactive ? '1' : '0'}`;
    if (key === lastLedenKey) return;
    lastLedenKey = key;
    loading = true;
    error = null;
    const ac = new AbortController();
    fetchLeden({
      limit: 1000,
      actief: includeInactive ? undefined : true,
      include_all: includeInactive ? true : undefined,
      signal: ac.signal,
    })
      .then((r) => { leden = r; ledenHasMore = false; })
      .catch((e) => { if ((e as Error)?.name !== 'AbortError') error = 'Kamerleden konden niet worden geladen.'; })
      .finally(() => { loading = false; });
    return () => ac.abort();
  });

  // Fracties — server-side `actief`-filter. Default toont alleen
  // zittende fracties. Bij API-fout (fracties-endpoint is flaky) valt het
  // terug op een afleiding via commissies-met-leden in één bulkcall.
  let lastFractiesKey: string | null = null;
  $effect(() => {
    if (category !== 'fracties') return;
    const key = `${includeInactive ? '1' : '0'}`;
    if (key === lastFractiesKey) return;
    lastFractiesKey = key;
    loading = true;
    error = null;
    const ac = new AbortController();
    (async () => {
      try {
        try {
          fracties = await fetchFracties({
            actief: includeInactive ? undefined : true,
            signal: ac.signal,
          });
        } catch {
          const withLeden = await fetchCommissiesWithLeden(ac.signal);
          const seen = new Map<string, FractieDTO>();
          for (const cc of withLeden) {
            for (const lid of cc.leden ?? []) {
              const p = lid.partij;
              if (!p || seen.has(p)) continue;
              seen.set(p, { id: `fractie:${p}`, key: p, naam: p, afkorting: p });
            }
          }
          fracties = [...seen.values()].sort(
            (a, b) => (a.afkorting ?? '').localeCompare(b.afkorting ?? ''),
          );
        }
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') error = 'Fracties konden niet worden geladen.';
      } finally { loading = false; }
    })();
    return () => ac.abort();
  });

  // Hemicycle-data — eenmalig bij activatie van Fracties.
  $effect(() => {
    if (category !== 'fracties' || zetels !== null) return;
    const ac = new AbortController();
    fetchZetels(ac.signal)
      .then((r) => { zetels = r; })
      .catch(() => { /* optional — silent fail */ });
    return () => ac.abort();
  });

  // ── Client-side filter en sortering ─────────────────────────────────────
  function norm(s: string | null | undefined): string { return (s ?? '').toLowerCase(); }


  const instrumentsFiltered = $derived.by(() => {
    if (!instruments) return null;
    let out = instruments;
    if (alleenGeldig) {
      out = out.filter((w) => !/vervallen/i.test(w.title ?? w.short_title ?? ''));
    }
    return out;
  });

  const judgmentsFiltered = $derived.by(() => judgments);

  const dossiersFiltered = $derived.by(() => {
    if (!dossiers) return null;
    let out = dossiers;
    if (fases.length > 0) {
      out = out.filter((d) => {
        const cur = (d.huidige_fase ?? '').toLowerCase();
        return fases.some((f) => cur === f.toLowerCase());
      });
    }
    if (trajectKind) {
      out = out.filter((d) => (d.traject_kind ?? 'overig') === trajectKind);
    }
    if (q) {
      const n = norm(q);
      out = out.filter((d) =>
        norm(d.titel).includes(n) || norm(d.kamerstuknummer).includes(n));
    }
    const nrOf = (s: string | undefined | null) => {
      const m = String(s ?? '').match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };
    const s = sort || 'nummer';
    const sign = dir === 'asc' ? 1 : -1;
    if (s === 'nummer') out = [...out].sort((a, b) => (nrOf(a.kamerstuknummer) - nrOf(b.kamerstuknummer)) * sign);
    if (s === 'title')  out = [...out].sort((a, b) => (a.titel ?? '').localeCompare(b.titel ?? '', 'nl') * sign);
    if (s === 'fase')   out = [...out].sort((a, b) => (a.huidige_fase ?? '').localeCompare(b.huidige_fase ?? '', 'nl') * sign);
    return out;
  });

  const commissiesFiltered = $derived.by(() => {
    if (!commissies) return null;
    let out = commissies;
    if (onlyActive) out = out.filter((c) => (c.active_dossier_count ?? 0) > 0);
    if (q) {
      const n = norm(q);
      out = out.filter((c) =>
        norm(c.naam).includes(n) || norm(c.afkorting).includes(n) || norm(c.slug).includes(n));
    }
    const s = sort || 'dossiers';
    const sign = dir === 'asc' ? 1 : -1;
    if (s === 'dossiers') {
      // sign=1 (asc) → minst eerst; sign=-1 (desc, default) → meest eerst.
      out = [...out].sort((a, b) =>
        ((a.active_dossier_count ?? 0) - (b.active_dossier_count ?? 0)) * sign
        || (a.naam ?? '').localeCompare(b.naam ?? '', 'nl'));
    } else if (s === 'naam') {
      out = [...out].sort((a, b) => (a.naam ?? '').localeCompare(b.naam ?? '', 'nl') * sign);
    } else if (s === 'afkorting') {
      out = [...out].sort((a, b) => (a.afkorting ?? '').localeCompare(b.afkorting ?? '', 'nl') * sign);
    }
    return out;
  });

  // De server-fetch past de actief-/include_all-filter al toe; client-side
  // hoeven we alleen partij- en zoekfilter + sortering te doen.
  const ledenParties = $derived.by(() => {
    if (!leden) return [];
    const set = new Set<string>();
    for (const l of leden) if (l.partij) set.add(l.partij);
    return [...set].sort((a, b) => a.localeCompare(b, 'nl'));
  });

  const ledenFiltered = $derived.by(() => {
    if (!leden) return null;
    let out = leden;
    if (partijFilt) out = out.filter((l) => l.partij === partijFilt);
    if (q) {
      const n = norm(q);
      out = out.filter((l) => norm(l.naam).includes(n) || norm(l.partij).includes(n));
    }
    const s = sort || 'naam';
    const sign = dir === 'asc' ? 1 : -1;
    if (s === 'naam')   out = [...out].sort((a, b) => (a.naam ?? '').localeCompare(b.naam ?? '', 'nl') * sign);
    if (s === 'partij') out = [...out].sort((a, b) => (a.partij ?? '').localeCompare(b.partij ?? '', 'nl') * sign);
    return out;
  });

  const fractiesFiltered = $derived.by(() => {
    if (!fracties) return null;
    let out = fracties;
    if (q) {
      const n = norm(q);
      out = out.filter((f) => norm(f.naam).includes(n) || norm(f.afkorting).includes(n));
    }
    const s = sort || 'zetels';
    const sign = dir === 'asc' ? 1 : -1;
    if (s === 'zetels')    out = [...out].sort((a, b) => ((a.aantal_zetels ?? 0) - (b.aantal_zetels ?? 0)) * sign);
    if (s === 'afkorting') out = [...out].sort((a, b) => (a.afkorting ?? '').localeCompare(b.afkorting ?? '', 'nl') * sign);
    if (s === 'naam')      out = [...out].sort((a, b) => (a.naam ?? '').localeCompare(b.naam ?? '', 'nl') * sign);
    return out;
  });

  const stemmingenFiltered = $derived.by(() => {
    if (!stemmingen) return null;
    let out = stemmingen;
    if (aangenomen === 'true')  out = out.filter((s) => s.aangenomen === true);
    if (aangenomen === 'false') out = out.filter((s) => s.aangenomen === false);
    if (dossierNr) out = out.filter((s) => s.dossier_nummers.includes(dossierNr));
    if (dateFrom)  out = out.filter((s) => !!s.datum && s.datum >= dateFrom);
    if (dateTo)    out = out.filter((s) => !!s.datum && s.datum <= dateTo);
    if (q) {
      const n = norm(q);
      out = out.filter((s) => norm(s.onderwerp).includes(n));
    }
    const s = sort || 'datum';
    const sign = dir === 'asc' ? 1 : -1;
    if (s === 'datum')     out = [...out].sort((a, b) => (a.datum ?? '').localeCompare(b.datum ?? '') * sign);
    if (s === 'onderwerp') out = [...out].sort((a, b) => (a.onderwerp ?? '').localeCompare(b.onderwerp ?? '', 'nl') * sign);
    if (s === 'uitslag')   out = [...out].sort((a, b) => (Number(a.aangenomen) - Number(b.aangenomen)) * sign);
    return out;
  });

  // ── Fase-tijdlijn definitions ──────────────────────────────────────────
  const FASES: FaseDef[] = [
    { id: 'wetsvoorstel', label: 'Wetsvoorstel', tone: 'slate' },
    { id: 'mvt',          label: 'MvT',          tone: 'slate' },
    { id: 'advies_rvs',   label: 'Advies RvS',   tone: 'slate' },
    { id: 'nota',         label: 'Nota',         tone: 'ochre' },
    { id: 'verslag',      label: 'Verslag',      tone: 'ochre' },
    { id: 'amendementen', label: 'Amendementen', tone: 'ochre' },
    { id: 'stemming',     label: 'Stemming',     tone: 'ochre' },
    { id: 'afgehandeld',  label: 'Afgehandeld',  tone: 'olive' },
  ];
  const faseCounts = $derived.by<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    if (!dossiers) return out;
    for (const d of dossiers) {
      const f = (d.huidige_fase ?? '').toLowerCase();
      out[f] = (out[f] ?? 0) + 1;
    }
    return out;
  });

  // ── Sort defaults & toolbar-config per category ────────────────────────
  const SORT_DEFAULTS: Record<CategoryKey, string> = {
    wetten:     'title',
    arresten:   'date_desc',
    dossiers:   'nummer',
    commissies: 'dossiers',
    leden:      'naam',
    fracties:   'zetels',
    stemmingen: 'datum',
  };
  // Default-richting per (categorie, sort-id). Numerieke en datum-sleutels
  // willen meestal aflopend; tekst- en label-sleutels oplopend.
  const SORT_DEFAULT_DIR: Record<string, 'asc' | 'desc'> = {
    'commissies:dossiers': 'desc',
    'fracties:zetels':     'desc',
    'wetten:article_count':   'desc',
    'wetten:recent_mutation': 'desc',
    'arresten:citation_count': 'desc',
    'dossiers:nummer':     'desc',
    'stemmingen:datum':    'desc',
  };
  const sortValue = $derived(sort || SORT_DEFAULTS[category]);
  const dir = $derived<'asc' | 'desc'>(
    dirRaw === 'asc' || dirRaw === 'desc'
      ? dirRaw
      : (SORT_DEFAULT_DIR[`${category}:${sortValue}`] ?? 'asc'),
  );

  const wettenSortOptions: SortOption[] = [
    { id: 'title',           label: 'Citatietitel' },
    { id: 'article_count',   label: 'Aantal artikelen' },
    { id: 'recent_mutation', label: 'Laatste mutatie' },
  ];
  const arrestenSortOptions: SortOption[] = [
    { id: 'date_desc',      label: 'Datum (nieuw → oud)' },
    { id: 'date_asc',       label: 'Datum (oud → nieuw)' },
    { id: 'citation_count', label: 'Meest geciteerd' },
  ];
  const dossiersSortOptions: SortOption[] = [
    { id: 'nummer', label: 'Kamerstuknummer' },
    { id: 'title',  label: 'Titel' },
    { id: 'fase',   label: 'Fase' },
  ];
  const commissiesSortOptions: SortOption[] = [
    { id: 'dossiers',  label: 'Actieve dossiers' },
    { id: 'afkorting', label: 'Afkorting' },
    { id: 'naam',      label: 'Naam' },
  ];
  const ledenSortOptions: SortOption[] = [
    { id: 'naam',   label: 'Naam' },
    { id: 'partij', label: 'Fractie' },
  ];
  const fractiesSortOptions: SortOption[] = [
    { id: 'zetels',    label: 'Zetels' },
    { id: 'afkorting', label: 'Afkorting' },
    { id: 'naam',      label: 'Naam' },
  ];
  const stemmingenSortOptions: SortOption[] = [
    { id: 'datum',     label: 'Datum' },
    { id: 'uitslag',   label: 'Uitslag' },
    { id: 'onderwerp', label: 'Onderwerp' },
  ];

  function countWhere<T>(rows: T[] | null, pred: (r: T) => boolean): number {
    return rows ? rows.filter(pred).length : 0;
  }

  // Pills voor de toolbar; voor Dossiers gebruiken we een custom snippet (timeline).
  const wettenFacets = $derived.by<Facet[]>(() => {
    const rows = instruments ?? [];
    return [
      { id: 'nl', label: 'Nederland', on: jurisdiction === 'nl',
        count: countWhere(rows, (r) => r.jurisdiction === 'nl'),
        onClick: () => patchUrl({ jurisdiction: jurisdiction === 'nl' ? null : 'nl' }) },
      { id: 'eu', label: 'Europese Unie', on: jurisdiction === 'eu',
        count: countWhere(rows, (r) => r.jurisdiction === 'eu'),
        onClick: () => patchUrl({ jurisdiction: jurisdiction === 'eu' ? null : 'eu' }) },
      { sep: true },
      { id: 'geldig', label: 'Alleen geldend recht', on: alleenGeldig,
        onClick: () => patchUrl({ alleen_geldig: alleenGeldig ? null : '1' }) },
    ];
  });

  const arrestenFacets = $derived.by<Facet[]>(() => {
    const opts: Array<[JudgmentTier, string]> = [
      ['hoge_raad',   'Hoge Raad'],
      ['gerechtshof', 'Gerechtshof'],
      ['rechtbank',   'Rechtbank'],
      ['bijzonder',   'Bijzonder'],
    ];
    return opts.map(([v, l]) => ({
      id: v, label: l, on: tier === v,
      onClick: () => patchUrl({ tier: tier === v ? null : v }),
    }));
  });

  const commissiesFacets = $derived.by<Facet[]>(() => [
    { id: 'hide', label: 'Verberg commissies zonder dossiers', on: onlyActive,
      count: countWhere(commissies, (r) => (r.active_dossier_count ?? 0) === 0),
      onClick: () => patchUrl({ only_active: onlyActive ? null : '1' }) },
  ]);

  const ledenFacets = $derived.by<Facet[]>(() => {
    const parties: Facet[] = ledenParties.map((p) => ({
      id: p, label: p, on: partijFilt === p,
      swatch: partyColor(p),
      count: countWhere(leden, (r) => r.partij === p),
      onClick: () => patchUrl({ partij: partijFilt === p ? null : p }),
    }));
    return [
      ...parties,
      { sep: true },
      {
        id: 'incl_inactive',
        label: 'Toon ook historische leden',
        on: includeInactive,
        onClick: () => patchUrl({ include_inactive: includeInactive ? null : '1' }),
      },
    ];
  });

  const fractiesFacets = $derived.by<Facet[]>(() => [
    {
      id: 'incl_inactive',
      label: 'Toon ook inactieve fracties',
      on: includeInactive,
      onClick: () => patchUrl({ include_inactive: includeInactive ? null : '1' }),
    },
  ]);

  const stemmingenFacets = $derived.by<Facet[]>(() => [
    { id: 'aan', label: 'Aangenomen', on: aangenomen === 'true',
      count: countWhere(stemmingen, (s) => s.aangenomen === true),
      onClick: () => patchUrl({ aangenomen: aangenomen === 'true' ? null : 'true' }) },
    { id: 'ver', label: 'Verworpen', on: aangenomen === 'false',
      count: countWhere(stemmingen, (s) => s.aangenomen === false),
      onClick: () => patchUrl({ aangenomen: aangenomen === 'false' ? null : 'false' }) },
  ]);

  const searchPlaceholders: Record<CategoryKey, string> = {
    wetten:     'Zoek in titel, BWB of citatie',
    arresten:   'Zoek in zaaknaam of ECLI',
    dossiers:   'Zoek in titel of kamerstuknummer',
    commissies: 'Zoek op afkorting of naam',
    leden:      'Zoek op naam of partij',
    fracties:   'Zoek op naam of afkorting',
    stemmingen: 'Zoek in onderwerp',
  };

  // ── Open-state (inline detail) + Esc-handler ──────────────────────────
  let openId = $state<string | null>(null);
  function toggleOpen(id: string) { openId = openId === id ? null : id; }
  $effect(() => { void category; openId = null; }); // bij categorie-wissel sluiten

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && openId) { openId = null; }
  }

  // ── Result-count meldingen aan de chrome ──────────────────────────────
  const totals: Record<CategoryKey, number> = $derived({
    wetten:     instrumentsTotal || (instruments?.length ?? 0),
    arresten:   judgmentsTotal   || (judgments?.length   ?? 0),
    dossiers:   dossiersTotal || (dossiers?.length ?? 0),
    commissies: commissies?.length ?? 0,
    leden:      leden?.length      ?? 0,
    fracties:   fracties?.length   ?? 0,
    stemmingen: stemmingen?.length ?? 0,
  });
  const visible = $derived<{ rows: unknown[] | null; total: number }>({
    rows:
      category === 'wetten'     ? instrumentsFiltered :
      category === 'arresten'   ? judgmentsFiltered   :
      category === 'dossiers'   ? dossiersFiltered    :
      category === 'commissies' ? commissiesFiltered  :
      category === 'leden'      ? ledenFiltered       :
      category === 'fracties'   ? fractiesFiltered    :
      stemmingenFiltered,
    total: totals[category],
  });
  $effect(() => {
    if (!onResultCountChange || !visible.rows) return;
    onResultCountChange({
      filtered: visible.rows.length,
      total: visible.total,
      category,
    });
  });

  // ── Action handlers ────────────────────────────────────────────────────
  function discover(collection: string, key: string) {
    if (onDiscoverItem) onDiscoverItem(collection, key);
    else onSelectItem(collection, key);
  }
  function deepen(collection: string, key: string) { onSelectItem(collection, key); }
  function read(collection: string, key: string) {
    if (onReadItem) onReadItem(collection, key);
    else onSelectItem(collection, key);
  }

  // Fase-toon voor de huidige_fase-tag op een rij.
  function faseTone(fase: string | null | undefined): 'slate' | 'ochre' | 'olive' | 'spine' {
    if (!fase) return 'slate';
    const f = fase.toLowerCase();
    if (f.includes('verworpen')) return 'spine';
    if (f.includes('afgehandeld') || f.includes('aangenomen') || f.includes('in werking')) return 'olive';
    if (['nota', 'verslag', 'amendementen', 'stemming', 'plenair'].some((x) => f.includes(x))) return 'ochre';
    return 'slate';
  }

  function fmtDateShort(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
    } catch { return iso; }
  }

  function pageClass(): string {
    return category === 'fracties' || category === 'stemmingen' ? 'page page--wide' : 'page';
  }
</script>

<svelte:window onkeydown={handleKey} />

<div class="index-view">
  <!-- Horizontale categorie-strip — vervangt de linker zijbalk. -->
  <nav class="catbar" aria-label="Categorieën">
    {#each CATEGORIES as cat (cat.key)}
      <button
        type="button"
        class="cat"
        class:cat--on={cat.key === category}
        onclick={() => switchCategory(cat.key)}
      >
        <span class="cat-name">{cat.label}</span>
      </button>
    {/each}
  </nav>

  <div class="stage">
    <div class="stage-scroll">
      <div class={pageClass()}>
        <!-- Hemicycle alleen op Fracties -->
        {#if category === 'fracties' && zetels}
          <div class="hemi-card">
            <div class="hemi-svg-wrap">
              <Hemicycle data={zetels} onSelect={(k) => deepen('fracties', k)} />
            </div>
          </div>
        {/if}

        <!-- Toolbar — zelfde patroon voor elke categorie -->
        <IndexToolbar
          query={q}
          onQueryChange={(v) => { patchUrl({ q: v || null }); openId = null; }}
          searchPlaceholder={searchPlaceholders[category]}
          sortOptions={
            category === 'wetten'     ? wettenSortOptions :
            category === 'arresten'   ? arrestenSortOptions :
            category === 'dossiers'   ? dossiersSortOptions :
            category === 'commissies' ? commissiesSortOptions :
            category === 'leden'      ? ledenSortOptions :
            category === 'fracties'   ? fractiesSortOptions :
            stemmingenSortOptions
          }
          sort={sortValue}
          onSortChange={(v) => patchUrl({ sort: v || null })}
          dir={dir}
          onDirToggle={() => patchUrl({ dir: dir === 'asc' ? 'desc' : 'asc' })}
          facets={
            category === 'wetten'     ? wettenFacets :
            category === 'arresten'   ? arrestenFacets :
            category === 'commissies' ? commissiesFacets :
            category === 'leden'      ? ledenFacets :
            category === 'stemmingen' ? stemmingenFacets :
            category === 'fracties'   ? fractiesFacets :
            null
          }
          customFilter={category === 'dossiers' ? dossiersTimeline : null}
        />

        {#if loading}
          <p class="status-line">Laden…</p>
        {:else if error}
          <p class="status-line status-line--error">{error}</p>

        {:else if category === 'wetten' && instrumentsFiltered}
          {#if instrumentsFiltered.length === 0}
            <div class="empty">Geen wetten met deze filters.</div>
          {:else}
            <ul class="list">
              {#each instrumentsFiltered as w (w.id)}
                {@const isOpen = openId === w.id}
                <li class="row-wrap">
                  <button type="button" class="row" class:row--on={isOpen} onclick={() => toggleOpen(w.id)}>
                    <div class="row-id">
                      <span class="row-id-main">{(w.bwb_id ?? w.celex ?? '').toUpperCase()}</span>
                      {#if w.short_title && w.short_title !== w.title}
                        <span class="row-id-sub">{w.short_title}</span>
                      {/if}
                    </div>
                    <div class="row-body">
                      <div class="row-title">{w.citation_title ?? w.short_title ?? w.title ?? w.key}</div>
                      <span class="row-sub">{w.article_count > 0 ? `${w.article_count} artikelen` : 'geen artikelen geïndexeerd'}</span>
                    </div>
                    <div class="row-aside">
                      <span class="tag tag--outline" class:tag--teal={w.jurisdiction === 'eu'}>
                        {w.jurisdiction === 'eu' ? 'EU' : 'NL'}
                      </span>
                    </div>
                  </button>
                  {#if isOpen}
                    <div class="detail">
                      <IndexDetail
                        category="wetten"
                        record={w}
                        onDiscover={() => discover('instruments', w.key)}
                        onSplit={() => deepen('instruments', w.key)}
                        onRead={() => read('instruments', w.key)}
                      />
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
            {#if instrumentsHasMore}
              <div class="load-more">
                <button type="button" class="load-more-btn" onclick={loadMoreInstruments} disabled={loadingMore}>
                  {loadingMore ? 'Laden…' : (instrumentsTotal > instrumentsFiltered.length ? `Meer laden (${(instrumentsTotal - instrumentsFiltered.length).toLocaleString('nl-NL')} resterend)` : 'Meer laden')}
                </button>
              </div>
            {/if}
          {/if}

        {:else if category === 'arresten' && judgmentsFiltered}
          {#if judgmentsFiltered.length === 0}
            <div class="empty">Geen arresten met deze filters.</div>
          {:else}
            <ul class="list">
              {#each judgmentsFiltered as j (j.id)}
                {@const isOpen = openId === j.id}
                <li class="row-wrap">
                  <button type="button" class="row" class:row--on={isOpen} onclick={() => toggleOpen(j.id)}>
                    <div class="row-id">
                      <span class="row-id-main">{fmtDateShort(j.date)}</span>
                      {#if j.court}
                        <span class="row-id-sub">{j.court}</span>
                      {/if}
                    </div>
                    <div class="row-body">
                      <div class="row-title">{j.display_name ?? j.ecli ?? j.key}</div>
                      <span class="row-sub row-sub--mono">{j.ecli ?? ''}</span>
                    </div>
                    <div class="row-aside">
                      {#if j.inbound_citation_count > 0}
                        <span class="num-strong">{j.inbound_citation_count}<span class="num-lbl">citaties</span></span>
                      {/if}
                    </div>
                  </button>
                  {#if isOpen}
                    <div class="detail">
                      <IndexDetail
                        category="arresten"
                        record={j}
                        onDiscover={() => discover('judgments', j.key)}
                        onSplit={() => deepen('judgments', j.key)}
                        onRead={() => read('judgments', j.key)}
                      />
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
            {#if judgmentsHasMore}
              <div class="load-more">
                <button type="button" class="load-more-btn" onclick={loadMoreJudgments} disabled={loadingMore}>
                  {loadingMore ? 'Laden…' : (judgmentsTotal > judgmentsFiltered.length ? `Meer laden (${(judgmentsTotal - judgmentsFiltered.length).toLocaleString('nl-NL')} resterend)` : 'Meer laden')}
                </button>
              </div>
            {/if}
          {/if}

        {:else if category === 'dossiers' && dossiersFiltered}
          {#if dossiersFiltered.length === 0}
            <div class="empty">Geen dossiers met deze filters.</div>
          {:else}
            <ul class="list">
              {#each dossiersFiltered as d (d.id)}
                {@const isOpen = openId === d.id}
                <li class="row-wrap">
                  <button type="button" class="row" class:row--on={isOpen} onclick={() => toggleOpen(d.id)}>
                    <div class="row-id">
                      <span class="row-id-main">{d.kamerstuknummer}</span>
                      {#if d.traject_kind}
                        <span class="row-id-sub">{d.traject_kind}</span>
                      {/if}
                    </div>
                    <div class="row-body">
                      <div class="row-title">{d.titel ?? '—'}</div>
                    </div>
                    <div class="row-aside">
                      {#if d.huidige_fase && d.huidige_fase.toLowerCase() !== 'onbekend'}
                        <span class="tag tag--{faseTone(d.huidige_fase)}">
                          <span class="tag-dot" aria-hidden="true"></span>{d.huidige_fase}
                        </span>
                      {/if}
                    </div>
                  </button>
                  {#if isOpen}
                    <div class="detail">
                      <IndexDetail
                        category="dossiers"
                        record={d}
                        onDiscover={() => discover('kamerstukdossiers', d.key)}
                        onSplit={() => deepen('kamerstukdossiers', d.key)}
                      />
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
            {#if dossiersHasMore}
              <div class="load-more">
                <button type="button" class="load-more-btn" onclick={loadMoreDossiers} disabled={loadingMore}>
                  {loadingMore ? 'Laden…' : `Meer dossiers laden (${(dossiersTotal - (dossiers?.length ?? 0)).toLocaleString('nl-NL')} resterend)`}
                </button>
              </div>
            {/if}
          {/if}

        {:else if category === 'commissies' && commissiesFiltered}
          {#if commissiesFiltered.length === 0}
            <div class="empty">Geen commissies met deze filters.</div>
          {:else}
            <ul class="list">
              {#each commissiesFiltered as c, i (c.id)}
                {@const isOpen = openId === c.id}
                {@const prev = i > 0 ? commissiesFiltered[i - 1] : null}
                {@const hereLeeg = (c.active_dossier_count ?? 0) === 0}
                {@const prevActief = prev ? (prev.active_dossier_count ?? 0) > 0 : false}
                {@const dividerHere = !onlyActive && (sort === '' || sort === 'dossiers') && hereLeeg && prevActief}
                {#if dividerHere}
                  <li class="group-divider" aria-hidden="true">
                    <span>Zonder lopende dossiers</span>
                  </li>
                {/if}
                <li class="row-wrap">
                  <button type="button" class="row" class:row--on={isOpen} onclick={() => toggleOpen(c.id)}>
                    <div class="row-id">
                      <span class="row-id-main">{c.afkorting ?? ''}</span>
                    </div>
                    <div class="row-body">
                      <div class="row-title">{c.naam ?? c.key}</div>
                      <span class="row-sub">
                        {c.active_dossier_count > 0
                          ? `${c.active_dossier_count} actief ${c.active_dossier_count === 1 ? 'dossier' : 'dossiers'}`
                          : 'Geen actieve dossiers'}
                      </span>
                    </div>
                    <div class="row-aside">
                      {#if (c.active_dossier_count ?? 0) > 0}
                        <span class="num-strong">{c.active_dossier_count}</span>
                      {:else}
                        <span class="tag tag--outline" style="color: var(--fg-4);">—</span>
                      {/if}
                    </div>
                  </button>
                  {#if isOpen}
                    <div class="detail">
                      <IndexDetail
                        category="commissies"
                        record={c}
                        onDiscover={() => discover('commissies', c.slug ?? c.key)}
                        onSplit={() => deepen('commissies', c.slug ?? c.key)}
                      />
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}

        {:else if category === 'leden' && ledenFiltered}
          {#if ledenFiltered.length === 0}
            <div class="empty">Geen kamerleden met deze filters.</div>
          {:else}
            <ul class="list">
              {#each ledenFiltered as l (l.id)}
                {@const isOpen = openId === l.id}
                <li class="row-wrap">
                  <button type="button" class="row" class:row--on={isOpen} onclick={() => toggleOpen(l.id)}>
                    <div class="row-id">
                      <span class="row-id-main row-id-main--inline">
                        <span class="party-dot" style:background={partyColor(l.partij ?? '')}></span>
                        {l.partij ?? ''}
                      </span>
                    </div>
                    <div class="row-body">
                      <div class="row-title">{l.naam ?? l.key}</div>
                    </div>
                    <div class="row-aside"></div>
                  </button>
                  {#if isOpen}
                    <div class="detail">
                      <IndexDetail
                        category="leden"
                        record={l}
                        onDiscover={() => discover('leden', l.key)}
                        onSplit={() => deepen('leden', l.key)}
                      />
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
            {#if ledenHasMore}
              <div class="load-more">
                <button type="button" class="load-more-btn" onclick={loadMoreLeden} disabled={loadingMore}>
                  {loadingMore ? 'Laden…' : 'Meer kamerleden laden'}
                </button>
              </div>
            {/if}
          {/if}

        {:else if category === 'fracties' && fractiesFiltered}
          {#if fractiesFiltered.length === 0}
            <div class="empty">Geen fracties met deze filters.</div>
          {:else}
            <ul class="list">
              {#each fractiesFiltered as f (f.id)}
                {@const isOpen = openId === f.id}
                {@const totalSeats = fractiesFiltered.reduce((a, x) => a + (x.aantal_zetels ?? 0), 0)}
                <li class="row-wrap">
                  <button type="button" class="row" class:row--on={isOpen} onclick={() => toggleOpen(f.id)}>
                    <div class="row-id">
                      <span class="row-id-main row-id-main--inline">
                        <span class="party-dot" style:background={partyColor(f.afkorting ?? '')}></span>
                        {f.afkorting ?? ''}
                      </span>
                    </div>
                    <div class="row-body">
                      <div class="row-title">{f.naam ?? f.key}</div>
                      {#if f.aantal_zetels != null && totalSeats > 0}
                        <span class="row-sub">{(f.aantal_zetels / totalSeats * 100).toFixed(1)}% van de zetels</span>
                      {/if}
                    </div>
                    <div class="row-aside">
                      {#if f.aantal_zetels != null}
                        <span class="num-strong">{f.aantal_zetels}<span class="num-lbl">zetels</span></span>
                      {/if}
                    </div>
                  </button>
                  {#if isOpen}
                    <div class="detail">
                      <IndexDetail
                        category="fracties"
                        record={f}
                        onDiscover={() => discover('fracties', f.key)}
                        onSplit={() => deepen('fracties', f.key)}
                      />
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}

        {:else if category === 'stemmingen' && stemmingenFiltered}
          {#if stemmingenFiltered.length === 0}
            <div class="empty">Geen stemmingen met deze filters.</div>
          {:else}
            <ul class="list">
              {#each stemmingenFiltered as s (s.id)}
                {@const isOpen = openId === s.id}
                {@const total = s.voor_zetels + s.tegen_zetels}
                {@const vPct = total > 0 ? (s.voor_zetels / total) * 100 : 0}
                <li class="row-wrap">
                  <button type="button" class="row" class:row--on={isOpen} onclick={() => toggleOpen(s.id)}>
                    <div class="row-id">
                      <span class="row-id-main">{fmtDateShort(s.datum)}</span>
                      {#if s.dossier_nummers[0]}
                        <span class="row-id-sub">{s.dossier_nummers[0]}</span>
                      {/if}
                    </div>
                    <div class="row-body">
                      <div class="row-title">{s.onderwerp ?? '—'}</div>
                      {#if total > 0}
                        <span class="stem-mini" title="Zetelverdeling — {s.voor_fracties} vs {s.tegen_fracties} fracties">
                          <span class="stem-mini__v">{s.voor_zetels}</span>
                          <span class="stem-mini__bar">
                            <span class="stem-mini__bar-v" style:width="{vPct}%"></span>
                            <span class="stem-mini__bar-t" style:width="{100 - vPct}%"></span>
                          </span>
                          <span class="stem-mini__t">{s.tegen_zetels}</span>
                          <span class="stem-mini__unit">zetels</span>
                        </span>
                      {/if}
                    </div>
                    <div class="row-aside">
                      <span class="tag" class:tag--moss={s.aangenomen} class:tag--spine={!s.aangenomen}>
                        <span class="tag-dot" aria-hidden="true"></span>
                        {s.aangenomen ? 'Aangenomen' : 'Verworpen'}
                      </span>
                    </div>
                  </button>
                  {#if isOpen}
                    <div class="detail">
                      <IndexDetail
                        category="stemmingen"
                        record={s}
                        onDiscover={() => discover('stemmingen', s.key)}
                        onSplit={() => deepen('stemmingen', s.key)}
                      />
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
            {#if stemmingenHasMore}
              <div class="load-more">
                <button type="button" class="load-more-btn" onclick={loadMoreStemmingen} disabled={loadingMore}>
                  {loadingMore ? 'Laden…' : 'Meer stemmingen laden'}
                </button>
              </div>
            {/if}
          {/if}
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Snippet voor de Dossiers fase-tijdlijn (passes als customFilter naar Toolbar). -->
{#snippet dossiersTimeline()}
  <IndexFaseFilter
    phases={FASES}
    selected={fases}
    counts={faseCounts}
    onToggle={(p) => toggleArrParam('fases', fases, p)}
  />
{/snippet}

<style>
  .index-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Horizontale categorie-strook ─────────────────────────────────── */
  .catbar {
    display: flex; align-items: stretch; gap: 0;
    padding: 0 32px;
    border-bottom: 1px solid var(--rule);
    background: var(--paper);
    flex-shrink: 0;
    overflow-x: auto;
  }
  .cat {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 16px 20px 14px;
    background: transparent; border: 0; cursor: pointer;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }
  .cat-name {
    font-family: var(--font-serif); font-size: 17px; color: var(--fg-3); line-height: 1;
    transition: color 120ms;
  }
  .cat:hover .cat-name { color: var(--ink-2); }
  .cat--on { border-bottom-color: var(--ink); }
  .cat--on .cat-name { color: var(--ink); font-weight: 500; }

  /* ── Stage container ─────────────────────────────────────────────── */
  .stage { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  .stage-scroll { flex: 1; overflow-y: auto; }
  .page { max-width: 1320px; margin: 0 auto; padding: 28px 32px 80px; }
  .page--wide { max-width: 1480px; }

  /* ── Hemicycle-card (alleen Fracties) ────────────────────────────── */
  .hemi-card {
    margin-bottom: 28px;
    padding: 22px 28px;
    background: var(--paper-2);
    border: 1px solid var(--rule);
    border-radius: 2px;
  }
  .hemi-svg-wrap :global(.hemicycle) { background: transparent; }

  /* ── Status & lege staten ────────────────────────────────────────── */
  .status-line {
    font-family: var(--font-serif); font-style: italic; font-size: 14px;
    color: var(--fg-3); margin: 12px 0;
  }
  .status-line--error { color: var(--spine); }
  .empty {
    padding: 80px 40px; text-align: center;
    font-family: var(--font-serif); font-style: italic; font-size: 16px; color: var(--fg-3);
  }

  /* ── Lijst & editorial rij ───────────────────────────────────────── */
  .list { list-style: none; padding: 0; margin: 0; }
  .row-wrap { display: flex; flex-direction: column; }
  .row {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr) 200px;
    gap: 28px;
    width: 100%;
    padding: 18px 4px;
    border: 0;
    border-bottom: 1px solid var(--rule);
    cursor: pointer;
    background: transparent;
    text-align: left;
    align-items: baseline;
    transition: background 120ms;
    color: inherit;
    font: inherit;
  }
  .row:hover { background: var(--paper-2); }
  .row--on { background: var(--paper-2); }
  .row--on .row-title { color: var(--accent); }
  .row:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; }

  .row-id {
    font-family: var(--font-mono); font-size: 12px; color: var(--ink-3);
    line-height: 1.4; padding-top: 3px;
  }
  .row-id-main {
    display: block;
  }
  .row-id-main--inline {
    display: inline-flex; align-items: center; gap: 8px;
  }
  .row-id-sub {
    display: block;
    font-family: var(--font-sans); font-size: 10px; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--fg-4); margin-top: 2px;
  }

  .row-body { min-width: 0; }
  .row-title {
    font-family: var(--font-serif); font-size: 19px; color: var(--ink);
    line-height: 1.28; letter-spacing: -0.002em;
    text-wrap: pretty;
    transition: color 120ms;
    /* Twee regels max — volledige titel beschikbaar via inline detail */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  .row-sub {
    display: block; margin-top: 5px;
    font-family: var(--font-sans); font-size: 11.5px; color: var(--fg-3); letter-spacing: 0.01em;
  }
  .row-sub--mono { font-family: var(--font-mono); font-size: 11px; }

  .row-aside {
    display: flex; align-items: center; justify-content: flex-end; gap: 8px;
    text-align: right;
    flex-wrap: wrap;
    padding-top: 2px;
  }

  /* Status-tags op rij-niveau */
  .tag {
    display: inline-flex; align-items: baseline; gap: 5px;
    height: 22px; padding: 0 9px;
    font-family: var(--font-sans); font-size: 10.5px; letter-spacing: 0.04em;
    border-radius: 2px;
    border: 1px solid transparent;
    white-space: nowrap; line-height: 22px;
  }
  .tag-dot { width: 5px; height: 5px; border-radius: 50%; align-self: center; flex-shrink: 0; }
  .tag--moss   { color: var(--moss);   background: var(--moss-faint); }
  .tag--moss   .tag-dot { background: var(--moss); }
  .tag--spine  { color: var(--spine);  background: var(--spine-faint); }
  .tag--spine  .tag-dot { background: var(--spine); }
  .tag--ochre  { color: var(--ochre);  background: var(--ochre-faint); }
  .tag--ochre  .tag-dot { background: var(--ochre); }
  .tag--olive  { color: var(--olive);  background: var(--olive-faint); }
  .tag--olive  .tag-dot { background: var(--olive); }
  .tag--teal   { color: var(--teal);   background: var(--teal-faint); }
  .tag--teal   .tag-dot { background: var(--teal); }
  .tag--slate  { color: var(--slate);  background: var(--slate-faint); }
  .tag--slate  .tag-dot { background: var(--slate); }
  .tag--outline {
    color: var(--ink-3); background: transparent;
    border-color: var(--rule);
  }
  .tag--outline.tag--teal { color: var(--teal); border-color: var(--teal-faint); }

  .num-strong {
    font-family: var(--font-serif); font-size: 17px; color: var(--ink);
    font-feature-settings: "lnum"; line-height: 1;
  }
  .num-lbl {
    font-family: var(--font-sans); font-size: 10px; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--fg-3); margin-left: 4px;
  }

  .party-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    flex-shrink: 0;
    vertical-align: middle;
  }

  /* Mini voor/tegen-bar in de stemmingen-rij */
  .stem-mini {
    display: inline-grid; grid-template-columns: 32px 140px 32px auto; gap: 8px;
    align-items: center;
    font-family: var(--font-mono); font-size: 12px;
    margin-top: 6px;
  }
  .stem-mini__v { color: var(--moss-2);  text-align: right; font-weight: 500; }
  .stem-mini__t { color: var(--spine-2); text-align: left;  font-weight: 500; }
  .stem-mini__unit {
    font-family: var(--font-sans);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-4);
  }
  .stem-mini__bar {
    height: 8px; background: var(--paper-3); border-radius: 2px;
    overflow: hidden; display: flex;
  }
  .stem-mini__bar-v { background: var(--moss-2); }
  .stem-mini__bar-t { background: var(--spine-2); }

  /* Inline detail-paneel */
  .detail {
    background: var(--paper-2);
    border-bottom: 1px solid var(--rule);
    padding: 0 4px 0 200px;
  }

  /* Commissies: visuele scheiding tussen actief en leeg */
  .group-divider {
    list-style: none;
    padding: 18px 4px 10px;
    font-family: var(--font-sans); font-size: 10px; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--fg-4);
    border-bottom: 1px solid var(--rule);
  }

  /* Meer-laden knop */
  .load-more {
    display: flex; justify-content: center;
    padding: 24px 0 12px;
  }
  .load-more-btn {
    height: 32px;
    padding: 0 16px;
    background: var(--paper);
    border: 1px solid var(--rule-strong);
    border-radius: 2px;
    font-family: var(--font-sans); font-size: 12px; color: var(--ink-2);
    cursor: pointer;
    transition: background 80ms, color 80ms, border-color 80ms;
  }
  .load-more-btn:hover:not(:disabled) {
    background: var(--ink); color: var(--paper); border-color: var(--ink);
  }
  .load-more-btn:disabled { opacity: 0.6; cursor: wait; }

  /* Smaller viewports — stapel kolommen */
  @media (max-width: 768px) {
    .row {
      grid-template-columns: 1fr;
      gap: 4px;
      padding: 14px 4px;
    }
    .row-aside { justify-content: flex-start; padding-top: 6px; }
    .detail { padding-left: 0; }
    .catbar { padding: 0 16px; }
    .cat { padding: 12px 14px; }
    .page { padding: 18px 16px 60px; }
  }
</style>
