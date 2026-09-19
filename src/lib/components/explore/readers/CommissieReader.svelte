<script lang="ts">
  // Phase 4: standalone commissie reader. Loads commissie detail.
  import type { GraphNode } from '$lib/graph/types';
  import { fetchCommissie } from '$lib/api/parliamentary-client';
  import type { CommissieDetailDTO } from '$lib/api/parliamentary';
  import { initials } from '$lib/util/initials';
  import { FASE_LABELS, KIND_SHORT } from './_shared';

  let { node }: { node: GraphNode } = $props();

  type State =
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'loaded'; c: CommissieDetailDTO };

  let view = $state<State>({ kind: 'loading' });
  let token = 0;

  $effect(() => {
    const n = node;
    const t = ++token;
    view = { kind: 'loading' };
    fetchCommissie(n.key)
      .then((c) => {
        if (t !== token) return;
        view = { kind: 'loaded', c };
      })
      .catch(() => {
        if (t === token) view = { kind: 'error', message: 'Commissie kon niet geladen worden.' };
      });
  });
</script>

<div class="r-commissie">
  {#if view.kind === 'loading'}
    <p class="loading">Laden…</p>
  {:else if view.kind === 'error'}
    <p class="error">{view.message}</p>
  {:else}
    {@const c = view.c}
    {@const openCount = c.dossiers.filter((d) => !d.afgedaan).length}
    {@const closedCount = c.dossiers.filter((d) => d.afgedaan).length}

    <header class="head">
      <div class="kicker-row">
        <span class="kicker">Commissie</span>
        <a
          class="graph-link"
          href="/explore?focus=commissies/{c.key}"
        >Toon op grafiek →</a>
      </div>
      <h2 class="title">{c.naam ?? c.afkorting ?? c.key}</h2>
      {#if c.afkorting && c.naam}
        <div class="chips"><span class="afk-chip">{c.afkorting}</span></div>
      {/if}
    </header>

    <ul class="stats">
      <li><span class="stat-num">{c.leden.length}</span><span class="stat-label">Leden</span></li>
      <li><span class="stat-num">{openCount}</span><span class="stat-label">Open dossiers</span></li>
      <li><span class="stat-num">{closedCount}</span><span class="stat-label">Afgedaan</span></li>
    </ul>

    {#if c.leden.length > 0}
      <section class="sec">
        <h3 class="sec-title">
          Huidige leden ({c.leden.length})
          <span class="status-dot status-dot--actief" aria-hidden="true"></span>
        </h3>
        <ul class="member-list">
          {#each c.leden as lid (lid.key)}
            <li class="member-row">
              <span class="member-avatar" aria-hidden="true">{initials(lid.naam)}</span>
              <a class="member-name" href="/explore?focus=leden/{lid.key}">{lid.naam ?? lid.key}</a>
              {#if lid.partij}<span class="member-partij">{lid.partij}</span>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {@const openDossiers = c.dossiers.filter((d) => !d.afgedaan)}
    {@const closedDossiers = c.dossiers.filter((d) => !!d.afgedaan)}

    {#if openDossiers.length > 0}
      <section class="sec">
        <h3 class="sec-title">Actieve dossiers ({openDossiers.length})</h3>
        <ul class="doss-list">
          {#each openDossiers as dos (dos.key)}
            <li class="doss-item">
              <a class="doss-name" href="/explore?focus=kamerstukdossiers/{dos.key}">
                <span class="doss-num">{dos.kamerstuknummer}</span>
                <span class="doss-titel">{dos.titel ?? dos.kamerstuknummer}</span>
              </a>
              {#if dos.huidige_fase}
                <span class="doss-fase">{FASE_LABELS[dos.huidige_fase] ?? dos.huidige_fase}</span>
              {:else if dos.traject_kind}
                <span class="doss-fase">{KIND_SHORT[dos.traject_kind] ?? dos.traject_kind}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if closedDossiers.length > 0}
      <section class="sec">
        <h3 class="sec-title">Afgedane dossiers ({closedDossiers.length})</h3>
        <ul class="doss-list">
          {#each closedDossiers as dos (dos.key)}
            <li class="doss-item is-closed">
              <a class="doss-name" href="/explore?focus=kamerstukdossiers/{dos.key}">
                <span class="doss-num">{dos.kamerstuknummer}</span>
                <span class="doss-titel">{dos.titel ?? dos.kamerstuknummer}</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

  {/if}
</div>

<style>
  .r-commissie {
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
  .chips { display: flex; gap: 4px; }
  .afk-chip {
    display: inline-flex; align-items: center; height: 18px; padding: 0 7px;
    border-radius: var(--r-1); font-family: var(--font-sans); font-size: 9px;
    font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    border: 1px solid var(--rule); background: var(--paper-2); color: var(--ink-2);
  }

  .stats {
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: var(--s-2);
  }
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

  .status-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    margin-left: 5px; vertical-align: middle;
  }
  .status-dot--actief { background: var(--moss); }

  .sec-title--former { color: var(--ink-4); }
  .empty-note { font-family: var(--font-serif); font-style: italic; font-size: 12px; color: var(--ink-4); margin: 0; }

  .member-list { list-style: none; margin: 0; padding: 0; }
  .member-row { display: flex; align-items: center; gap: var(--s-2); padding: 4px 0; border-bottom: 1px dotted var(--rule); }
  .member-avatar {
    width: 24px; height: 24px; border-radius: 50%;
    background: var(--paper-3); border: 1px solid var(--rule);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-serif); font-size: 11px; color: var(--ink-3);
    flex-shrink: 0;
  }
  .member-name {
    flex: 1; min-width: 0; font-family: var(--font-serif); font-size: 13px;
    color: var(--ink-2); text-decoration: none;
    overflow-wrap: anywhere;
  }
  .member-name:hover { color: var(--spine); }
  .member-name--former { color: var(--ink-3); }
  .member-partij { font-family: var(--font-mono); font-size: 10px; color: var(--ink-3); }

  .doss-list { list-style: none; margin: 0; padding: 0; }
  .doss-item {
    display: flex; gap: var(--s-2); align-items: baseline;
    padding: 5px 0; border-bottom: 1px dotted var(--rule); font-size: 12px;
    flex-wrap: wrap;
  }
  .doss-name { display: flex; gap: 6px; flex: 1; min-width: 0; text-decoration: none; }
  .doss-num { font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); flex-shrink: 0; }
  .doss-titel {
    font-family: var(--font-serif); color: var(--ink-2);
    overflow-wrap: anywhere; line-height: 1.4;
  }
  .doss-name:hover .doss-titel { color: var(--spine); }
  .doss-item.is-closed { opacity: 0.65; }
  .doss-fase {
    font-family: var(--font-sans); font-size: 9px; color: var(--spine);
    text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0;
  }

  .more-note { font-family: var(--font-serif); font-style: italic; font-size: 11px; color: var(--ink-4); margin: 0; }
  .foot { border-top: 1px solid var(--rule); padding-top: var(--s-3); display: flex; }
  .full-link {
    font-family: var(--font-sans); font-size: 12px; color: var(--spine);
    text-decoration: none; border-bottom: 1px solid var(--spine-faint);
  }
  .full-link:hover { border-bottom-color: var(--spine); }
</style>
