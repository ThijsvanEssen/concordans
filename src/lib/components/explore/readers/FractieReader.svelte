<script lang="ts">
  // Phase 4: standalone fractie reader. Loads fractie metadata + the
  // instruments touched via member publications.
  import type { GraphNode } from '$lib/graph/types';
  import {
    fetchFractie,
    fetchFractieTouchedInstruments,
  } from '$lib/api/parliamentary-client';
  import type {
    FractieDTO,
    FractieTouchedInstrumentsResponse,
  } from '$lib/api/parliamentary';
  import { getNodeGraph } from '$lib/api/nodes';
  import type { Neighbor } from '$lib/api/types';
  import { initials } from '$lib/util/initials';
  import type { Fractielidmaatschap } from '$lib/api/parliamentary';

  function isHuidigLid(l: Neighbor): boolean {
    const fracs = ((l.props as Record<string, unknown> | null)?.['fractielidmaatschappen'] as Fractielidmaatschap[] | undefined) ?? [];
    if (fracs.length === 0) return false;
    return fracs.some((f) => f.tot_en_met === null);
  }

  let { node, onNavigate }: {
    node: GraphNode;
    onNavigate?: (collection: string, key: string) => void;
  } = $props();

  type State =
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | {
        kind: 'loaded';
        f: FractieDTO;
        touched: FractieTouchedInstrumentsResponse | null;
        leden: Neighbor[];
      };

  let view = $state<State>({ kind: 'loading' });
  let showAllTouched = $state(false);
  let token = 0;

  $effect(() => {
    const n = node;
    const t = ++token;
    view = { kind: 'loading' };
    showAllTouched = false;
    Promise.all([
      fetchFractie(n.key),
      fetchFractieTouchedInstruments(n.key, { limit: 20 }).catch(() => null),
      getNodeGraph(n.collection, n.key, { neighborLimit: 100 }).catch(() => null),
    ])
      .then(([f, touched, graph]) => {
        if (t !== token) return;
        const all = graph?.neighbors?.all ?? [];
        const leden = all.filter(
          (nb) => (nb.collection === 'leden' || nb.collection === 'kamerleden')
            && nb.relation === 'LID_VAN_FRACTIE',
        );
        view = { kind: 'loaded', f, touched, leden };
      })
      .catch(() => {
        if (t === token) view = { kind: 'error', message: 'Fractie kon niet geladen worden.' };
      });
  });
</script>

<div class="r-fractie">
  {#if view.kind === 'loading'}
    <p class="loading">Laden…</p>
  {:else if view.kind === 'error'}
    <p class="error">{view.message}</p>
  {:else}
    {@const f = view.f}
    <header class="head">
      <div class="kicker-row">
        <span class="kicker">Fractie</span>
        <a class="graph-link" href="/explore?focus=fracties/{f.key}">Toon op grafiek →</a>
      </div>
      <h2 class="title">{f.afkorting ?? f.naam ?? f.key}</h2>
      {#if f.naam && f.afkorting && f.naam !== f.afkorting}
        <p class="sub">{f.naam}</p>
      {/if}
      {#if f.aantal_zetels != null}
        <div class="chips">
          <span class="seats-chip">{f.aantal_zetels} zetels</span>
        </div>
      {/if}
    </header>

    {#if view.leden.length > 0}
      {@const actieveLen = view.leden.filter(isHuidigLid)}
      {@const vorigeLen = view.leden.filter((l) => !isHuidigLid(l))}
      <section class="sec">
        <h3 class="sec-title">
          Huidige leden ({actieveLen.length})
          <span class="status-dot" aria-hidden="true"></span>
        </h3>
        {#if actieveLen.length > 0}
          <ul class="member-list">
            {#each actieveLen as l (l.id)}
              <li class="member-row">
                <span class="member-avatar" aria-hidden="true">{initials(l.display_name)}</span>
                <button type="button" class="member-name" onclick={() => onNavigate?.(l.collection, l.key)}>
                  {l.display_name ?? l.key}
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty-note">Geen actieve leden geregistreerd.</p>
        {/if}
      </section>
      {#if vorigeLen.length > 0}
        <section class="sec">
          <h3 class="sec-title sec-title--former">Voormalige leden ({vorigeLen.length})</h3>
          <ul class="member-list member-list--former">
            {#each vorigeLen as l (l.id)}
              <li class="member-row">
                <span class="member-avatar member-avatar--former" aria-hidden="true">{initials(l.display_name)}</span>
                <button type="button" class="member-name member-name--former" onclick={() => onNavigate?.(l.collection, l.key)}>
                  {l.display_name ?? l.key}
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/if}

    {#if view.touched && view.touched.items.length > 0}
      {@const total = view.touched.count}
      {@const shown = showAllTouched ? view.touched.items : view.touched.items.slice(0, 6)}
      <section class="sec">
        <h3 class="sec-title">Bijgedragen aan ({total})</h3>
        <ul class="touched-list">
          {#each shown as inst (inst.instrument_id)}
            <li class="touched-item">
              <a class="touched-name" href="/explore?focus=instruments/{inst.instrument_key}">
                {inst.short_title ?? inst.citation_title ?? inst.title ?? inst.bwb_id ?? inst.instrument_key}
              </a>
              <span class="touched-count">{inst.count} bijdragen</span>
            </li>
          {/each}
        </ul>
        {#if view.touched.items.length > 6 && !showAllTouched}
          <button type="button" class="more-btn" onclick={() => (showAllTouched = true)}>
            +{view.touched.items.length - 6} meer
          </button>
        {/if}
      </section>
    {/if}

  {/if}
</div>

<style>
  .r-fractie {
    display: flex; flex-direction: column; gap: var(--s-4);
    padding: var(--s-5) var(--s-5) var(--s-6); color: var(--ink-2);
    height: 100%; overflow-y: auto;
  }
  .loading, .error { font-family: var(--font-serif); font-style: italic; color: var(--ink-4); margin: 0; }

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
    font-family: var(--font-sans); font-size: 10px; font-weight: 500;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-4);
  }
  .title { font-family: var(--font-serif); font-size: 19px; font-weight: 400; color: var(--ink); margin: 0; line-height: 1.25; }
  .sub { font-family: var(--font-serif); font-size: 13px; color: var(--ink-3); margin: 0; }
  .chips { display: flex; gap: 4px; }
  .seats-chip {
    display: inline-flex; align-items: center; height: 18px; padding: 0 7px;
    border-radius: var(--r-1); font-family: var(--font-mono); font-size: 10px;
    border: 1px solid var(--rule); background: var(--paper-2); color: var(--ink-2);
  }

  .sec { display: flex; flex-direction: column; gap: var(--s-2); }
  .sec-title {
    font-family: var(--font-sans); font-size: 10px; font-weight: 500;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-4); margin: 0;
  }

  .touched-list { list-style: none; margin: 0; padding: 0; }
  .touched-item {
    display: flex; align-items: baseline; gap: var(--s-2);
    padding: 4px 0; border-bottom: 1px dotted var(--rule);
  }
  .touched-name {
    flex: 1; font-family: var(--font-serif); font-size: 13px;
    color: var(--ink-2); text-decoration: none;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .touched-name:hover { color: var(--spine); }
  .touched-count { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--spine); flex-shrink: 0; }

  .status-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--green, #16a34a); margin-left: 5px; vertical-align: middle;
  }
  .sec-title--former { color: var(--ink-4); }
  .empty-note { font-family: var(--font-serif); font-style: italic; font-size: 12px; color: var(--ink-4); margin: 0; }

  .member-list { list-style: none; margin: 0; padding: 0; }
  .member-list--former { opacity: 0.75; }
  .member-row { display: flex; align-items: center; gap: var(--s-2); padding: 3px 0; border-bottom: 1px dotted var(--rule); }
  .member-avatar {
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--paper-3); border: 1px solid var(--rule);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-serif); font-size: 10px; color: var(--ink-3); flex-shrink: 0;
  }
  .member-avatar--former { background: var(--paper-2); }
  .member-name {
    flex: 1; min-width: 0; font-family: var(--font-serif); font-size: 13px;
    color: var(--ink-2); background: none; border: none; padding: 0;
    cursor: pointer; text-align: left; overflow-wrap: anywhere;
  }
  .member-name:hover { color: var(--spine); }
  .member-name--former { color: var(--ink-3); }

  .more-btn {
    font-family: var(--font-serif); font-style: italic; font-size: 11px; color: var(--spine);
    background: none; border: none; padding: 3px 0; cursor: pointer; text-align: left;
  }
  .more-btn:hover { color: var(--ink); }
</style>
