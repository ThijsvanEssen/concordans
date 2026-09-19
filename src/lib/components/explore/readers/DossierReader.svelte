<script lang="ts">
  // Phase 4: standalone dossier reader. Loads dossier detail, documents, and
  // mutated articles. Mirrors routes/dossier/[nummer]/+page.svelte but
  // adapted for the Lezen measure column — no page chrome, more compact.
  import type { GraphNode } from '$lib/graph/types';
  import {
    fetchDossier,
    fetchDossierDocuments,
    fetchDossierMutations,
    fetchDossierTimeline,
  } from '$lib/api/parliamentary-client';
  import type {
    DossierDetailResponse,
    DossierDocumentsResponse,
    DossierMutationsResponse,
    DossierTimelineResponse,
    TimelineEntryDTO,
    LegislativeStage,
  } from '$lib/api/parliamentary';
  import LegislativeStepper from '$lib/components/parliamentary/LegislativeStepper.svelte';
  import LegislativeTimeline from '$lib/components/parliamentary/LegislativeTimeline.svelte';
  import { fetchPartyColors } from '$lib/api/parliamentary-client';
  import type { PartyColorsResponse } from '$lib/api/parliamentary';
  import GlossaryPill from './GlossaryPill.svelte';
  import { FASE_LABELS, KIND_SHORT, formatDate } from './_shared';

  let { node }: { node: GraphNode } = $props();

  type State =
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | {
        kind: 'loaded';
        d: DossierDetailResponse;
        docs: DossierDocumentsResponse | null;
        mutations: DossierMutationsResponse | null;
        timeline: DossierTimelineResponse | null;
      };

  let view = $state<State>({ kind: 'loading' });
  let partyColors = $state<Record<string, string>>({});
  let showAllArticles = $state(false);
  let showAllStemmingen = $state(false);
  let token = 0;

  // Party colours are dossier-independent; fetch once.
  fetchPartyColors().then((r: PartyColorsResponse) => { partyColors = r.colors ?? {}; }).catch(() => {});

  $effect(() => {
    const n = node;
    const t = ++token;
    view = { kind: 'loading' };
    Promise.all([
      fetchDossier(n.key),
      fetchDossierDocuments(n.key).catch(() => null),
      fetchDossierMutations(n.key).catch(() => null),
      // Full timeline drives both the LegislativeTimeline component and the
      // stemmingen list (we filter Stemming entries client-side since the
      // backend's soort= filter rejects this value).
      fetchDossierTimeline(n.key, { order: 'asc', limit: 500 }).catch(() => null),
    ])
      .then(([d, docs, mutations, timeline]) => {
        if (t !== token) return;
        view = { kind: 'loaded', d, docs, mutations, timeline };
      })
      .catch(() => {
        if (t === token) view = { kind: 'error', message: 'Dossier kon niet geladen worden.' };
      });
  });

  // Pull stemming entries out of the timeline. The body holds aangenomen
  // + agendapunt_onderwerp, which is the only readable summary we have.
  function stemmingEntries(t: DossierTimelineResponse | null): TimelineEntryDTO[] {
    if (!t) return [];
    return t.entries.filter((e) => (e.soort ?? '').toLowerCase().includes('stemming'));
  }

  // Pluck article-typed mutation targets so we can list "betrokken artikelen".
  function articleTargets(m: DossierMutationsResponse | null) {
    if (!m) return [] as { key: string; label: string; collection: string; relation: string | null }[];
    const articles = new Map<string, { key: string; label: string; collection: string; relation: string | null }>();
    for (const e of m.edges) {
      if (!e.to_id) continue;
      const target = m.nodes.find((n) => n.id === e.to_id);
      if (!target || target.collection !== 'instrument_articles') continue;
      if (articles.has(target.id)) continue;
      articles.set(target.id, {
        key: target.key,
        label: target.display_name ?? target.key,
        collection: target.collection,
        relation: e.relation,
      });
    }
    return [...articles.values()];
  }
</script>

<div class="r-dossier">
  {#if view.kind === 'loading'}
    <p class="loading">Laden…</p>
  {:else if view.kind === 'error'}
    <p class="error">{view.message}</p>
  {:else}
    {@const d = view.d}
    {@const stages = ((d.stages_present ?? []).filter((s: string) => s !== 'onbekend')) as LegislativeStage[]}
    {@const currentStage = (d.huidige_fase && d.huidige_fase !== 'onbekend' ? d.huidige_fase : null) as LegislativeStage | null}
    {@const trajectKind = d.traject_kind ?? 'overig'}
    {@const articles = articleTargets(view.mutations)}
    {@const stemmingen = stemmingEntries(view.timeline)}

    <header class="head">
      <div class="kicker-row">
        <span class="kicker">Dossier · <GlossaryPill term="Kamerstuk" label={`Kamerstuk ${d.kamerstuknummer}`} /></span>
        <a
          class="graph-link"
          href="/explore?focus=kamerstukdossiers/{d.kamerstuknummer}&overlay=dossier:{d.kamerstuknummer}"
        >Toon op grafiek →</a>
      </div>
      <h2 class="title">{d.titel ?? d.kamerstuknummer}</h2>
      <div class="chips">
        <span class="kind-chip kind-chip--{trajectKind}" title={KIND_SHORT[trajectKind] ?? trajectKind}>{KIND_SHORT[trajectKind] ?? trajectKind}</span>
        {#if d.huidige_fase}
          <span class="fase-chip">Nu: {FASE_LABELS[d.huidige_fase] ?? d.huidige_fase}</span>
        {/if}
        {#if d.afgedaan}<span class="closed-chip">Afgehandeld</span>{/if}
      </div>
    </header>

    {#if stages.length > 0}
      <div class="stepper-wrap">
        <LegislativeStepper {stages} current={currentStage} />
      </div>
    {/if}

    <ul class="stats">
      <li><span class="stat-num">{d.document_count}</span><span class="stat-label">Documenten</span></li>
      <li><span class="stat-num">{d.stemming_count}</span><span class="stat-label">Stemmingen</span></li>
      <li><span class="stat-num">{d.activiteit_count}</span><span class="stat-label">Activiteiten</span></li>
    </ul>

    {#if articles.length > 0}
      <section class="sec">
        <h3 class="sec-title">Betrokken artikelen</h3>
        <ul class="art-list">
          {#each (showAllArticles ? articles : articles.slice(0, 8)) as a (a.key)}
            <li class="art-item">
              <a class="art-name" href="/explore?focus=instrument_articles/{a.key}">{a.label}</a>
              {#if a.relation}
                <span class="art-rel">{a.relation.toLowerCase()}</span>
              {/if}
            </li>
          {/each}
        </ul>
        {#if articles.length > 8 && !showAllArticles}
          <button type="button" class="more-btn" onclick={() => (showAllArticles = true)}>
            +{articles.length - 8} meer
          </button>
        {/if}
      </section>
    {/if}

    {#if view.docs && view.docs.items.length > 0}
      <section class="sec">
        <h3 class="sec-title">Documenten ({view.docs.total})</h3>
        <ul class="doc-list doc-list--full">
          {#each view.docs.items as doc (doc.key)}
            <li class="doc-item">
              <span class="doc-soort">{doc.soort ?? '—'}</span>
              {#if doc.tk_url}
                <a class="doc-titel doc-titel--link" href={doc.tk_url} target="_blank" rel="noopener noreferrer">
                  {doc.display_name ?? doc.titel ?? doc.key}
                </a>
              {:else}
                <span class="doc-titel">{doc.display_name ?? doc.titel ?? doc.key}</span>
              {/if}
              {#if doc.datum}<span class="doc-date">{formatDate(doc.datum)}</span>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if stemmingen.length > 0}
      <section class="sec">
        <h3 class="sec-title">Stemmingen ({d.stemming_count})</h3>
        <ul class="stem-list">
          {#each (showAllStemmingen ? stemmingen : stemmingen.slice(0, 8)) as e (e.node_id)}
            {@const aangenomen = (e.body as Record<string, unknown> | null)?.['aangenomen'] === true}
            {@const verworpen = (e.body as Record<string, unknown> | null)?.['aangenomen'] === false}
            {@const onderwerp = ((e.body as Record<string, unknown> | null)?.['agendapunt_onderwerp'] as string | null) ?? e.titel ?? '—'}
            <li class="stem-item">
              <span class="stem-result" class:stem-result--ja={aangenomen} class:stem-result--nee={verworpen}>
                {aangenomen ? 'Aangenomen' : verworpen ? 'Verworpen' : '—'}
              </span>
              <span class="stem-onderwerp">{onderwerp}</span>
              {#if e.datum}<span class="stem-date">{formatDate(e.datum)}</span>{/if}
            </li>
          {/each}
        </ul>
        {#if stemmingen.length > 8 && !showAllStemmingen}
          <button type="button" class="more-btn" onclick={() => (showAllStemmingen = true)}>
            +{stemmingen.length - 8} eerdere stemmingen
          </button>
        {/if}
      </section>
    {/if}

    {#if view.timeline && view.timeline.entries.length > 0}
      <section class="sec sec--timeline">
        <h3 class="sec-title">Tijdlijn</h3>
        <LegislativeTimeline entries={view.timeline.entries} {partyColors} />
      </section>
    {/if}

  {/if}
</div>

<style>
  .r-dossier {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
    padding: var(--s-5) var(--s-5) var(--s-6);
    color: var(--ink-2);
    height: 100%;
    overflow-y: auto;
  }
  .loading, .error {
    font-family: var(--font-serif);
    font-style: italic;
    color: var(--ink-4);
    margin: 0;
  }
  .head { display: flex; flex-direction: column; gap: var(--s-2); }
  .kicker-row {
    display: flex; align-items: center; justify-content: space-between; gap: var(--s-3);
  }
  .graph-link {
    font-family: var(--font-sans); font-size: 11px; font-weight: 500;
    color: var(--ink-3); text-decoration: none; white-space: nowrap;
    border: 1px solid var(--rule-strong); border-radius: var(--r-1); padding: 2px 8px;
  }
  .graph-link:hover { color: var(--ink); border-color: var(--ink-3); }
  .kicker {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-4);
  }
  .title {
    font-family: var(--font-serif);
    font-size: 19px;
    font-weight: 400;
    color: var(--ink);
    margin: 0;
    line-height: 1.25;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }

  .kind-chip, .fase-chip, .closed-chip {
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 7px;
    border-radius: var(--r-1);
    font-family: var(--font-sans);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border: 1px solid var(--rule);
    background: var(--paper-3);
    color: var(--ink-3);
  }
  .kind-chip--wetsvoorstel           { background: color-mix(in srgb, #7A1F1A 10%, var(--paper)); color: #7A1F1A; border-color: color-mix(in srgb, #7A1F1A 25%, transparent); }
  .kind-chip--initiatiefwetsvoorstel { background: color-mix(in srgb, #4f46e5 10%, var(--paper)); color: #4f46e5; border-color: color-mix(in srgb, #4f46e5 25%, transparent); }
  .kind-chip--begroting              { background: color-mix(in srgb, #d97706 10%, var(--paper)); color: #d97706; border-color: color-mix(in srgb, #d97706 25%, transparent); }
  .kind-chip--motie                  { background: color-mix(in srgb, #16a34a 10%, var(--paper)); color: #16a34a; border-color: color-mix(in srgb, #16a34a 25%, transparent); }
  .kind-chip--overig                 { background: var(--paper-3); color: var(--ink-4); border-style: dashed; }
  .fase-chip { color: var(--spine); border-color: var(--spine-faint); background: var(--spine-faint); }

  .stepper-wrap { border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); padding: var(--s-3) 0; }

  .stats {
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
    gap: var(--s-2);
  }
  .stats .stat-label { line-height: 1.2; }
  .stats li {
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
    padding: var(--s-2); background: var(--paper-2);
    border: 1px solid var(--rule); border-radius: var(--r-1);
  }
  .stat-num { font-family: var(--font-mono); font-size: 17px; font-weight: 600; color: var(--ink); }
  .stat-label { font-family: var(--font-sans); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-4); }

  .sec { display: flex; flex-direction: column; gap: var(--s-2); }
  .sec-title {
    font-family: var(--font-sans); font-size: 10px; font-weight: 500;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-4); margin: 0;
  }
  .more-btn {
    font-family: var(--font-serif); font-style: italic; font-size: 11px; color: var(--spine);
    background: none; border: none; padding: 3px 0; cursor: pointer; text-align: left;
  }
  .more-btn:hover { color: var(--ink); }

  .art-list, .doc-list { list-style: none; margin: 0; padding: 0; }
  .art-item, .doc-item {
    display: grid; gap: var(--s-2); align-items: baseline;
    padding: 4px 0; border-bottom: 1px dotted var(--rule); font-size: 12px;
  }
  .art-item { grid-template-columns: 1fr auto; align-items: baseline; }
  .doc-item { grid-template-columns: minmax(70px, auto) 1fr auto; }
  .stem-item { align-items: start; padding: 6px 0; }

  .art-name, .doc-titel {
    font-family: var(--font-serif); color: var(--ink-2); text-decoration: none;
    overflow-wrap: anywhere; line-height: 1.4;
  }
  .art-name:hover { color: var(--spine); }
  .doc-titel--link:hover { color: var(--spine); }
  .sec--timeline { gap: 0; }
  .art-rel {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--ink-4);
  }
  .doc-soort { font-family: var(--font-sans); font-size: 10px; color: var(--ink-4); text-transform: uppercase; letter-spacing: 0.04em; }
  .doc-date  { font-family: var(--font-mono); font-size: 10px; color: var(--ink-4); }


  /* Stemmingen list — recent votes for this dossier */
  .stem-list { list-style: none; margin: 0; padding: 0; }
  .stem-item {
    display: grid;
    grid-template-columns: minmax(80px, auto) 1fr auto;
    gap: 8px;
    align-items: baseline;
    padding: 5px 0;
    border-bottom: 1px dotted var(--rule);
    font-size: 12px;
  }
  .stem-result {
    font-family: var(--font-sans);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: var(--r-1);
    border: 1px solid var(--rule);
    color: var(--ink-3);
    background: var(--paper-3);
    text-align: center;
  }
  .stem-result--ja  { color: var(--green, #16a34a); border-color: color-mix(in srgb, var(--green, #16a34a) 25%, transparent); background: color-mix(in srgb, var(--green, #16a34a) 8%, var(--paper)); }
  .stem-result--nee { color: var(--red,   #dc2626); border-color: color-mix(in srgb, var(--red,   #dc2626) 25%, transparent); background: color-mix(in srgb, var(--red,   #dc2626) 8%, var(--paper)); }
  .stem-onderwerp {
    font-family: var(--font-serif);
    color: var(--ink-2);
    overflow-wrap: anywhere;
    min-width: 0;
    line-height: 1.4;
  }
  .stem-date { font-family: var(--font-mono); font-size: 10px; color: var(--ink-4); }

  .foot { border-top: 1px solid var(--rule); padding-top: var(--s-3); display: flex; }
  .full-link {
    font-family: var(--font-sans); font-size: 12px; color: var(--spine);
    text-decoration: none; border-bottom: 1px solid var(--spine-faint);
  }
  .full-link:hover { border-bottom-color: var(--spine); }
</style>
