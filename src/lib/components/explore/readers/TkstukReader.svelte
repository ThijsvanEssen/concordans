<script lang="ts">
  // Phase 4: standalone reader for parlementaire publicaties (MvT, Verslag,
  // Nota, Amendement). Reuses lib/api/mvt.ts to fetch the publication body
  // and renders it inline. The body is often long — we cap it visually with
  // a max-height + scroll, plus a "Open extern" link to the official source.
  import type { GraphNode } from '$lib/graph/types';
  import { getPublicationText, type PublicationTextResponse } from '$lib/api/mvt';
  import GlossaryPill from './GlossaryPill.svelte';
  import { formatDate } from './_shared';

  let { node }: { node: GraphNode } = $props();

  type State =
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'loaded'; pub: PublicationTextResponse };

  let view = $state<State>({ kind: 'loading' });
  let token = 0;

  $effect(() => {
    const n = node;
    const t = ++token;
    view = { kind: 'loading' };
    getPublicationText(n.key)
      .then((pub) => {
        if (t !== token) return;
        view = { kind: 'loaded', pub };
      })
      .catch(() => {
        if (t === token) view = { kind: 'error', message: 'Publicatie kon niet geladen worden.' };
      });
  });

  // Map the raw `soort` to a glossary term where one exists, so the kicker
  // stays clickable and self-explanatory.
  function soortGlossaryTerm(soort: string | null): string | null {
    if (!soort) return null;
    const s = soort.toLowerCase();
    if (s.includes('memorie') || s === 'mvt') return 'MvT';
    if (s.includes('verslag')) return 'Verslag';
    if (s.includes('nota')) return 'Nota';
    if (s.includes('amendement')) return 'Amendement';
    if (s.includes('motie')) return 'Motie';
    return null;
  }
</script>

<div class="r-tkstuk">
  {#if view.kind === 'loading'}
    <p class="loading">Laden…</p>
  {:else if view.kind === 'error'}
    <p class="error">{view.message}</p>
  {:else}
    {@const p = view.pub}
    {@const soortTerm = soortGlossaryTerm(p.soort)}
    <header class="head">
      <span class="kicker">
        {#if soortTerm}<GlossaryPill term={soortTerm} label={p.soort ?? soortTerm} />{:else}{p.soort ?? 'Publicatie'}{/if}
        {#if p.datum}<span class="dot">·</span>{formatDate(p.datum)}{/if}
      </span>
      <h2 class="title">{p.title ?? p.key}</h2>
      {#if p.external_id}
        <code class="ext-id">{p.external_id}</code>
      {/if}
    </header>

    {#if p.text}
      <div class="body">
        {#each p.text.split(/\n\n+/) as para, i (i)}
          {#if para.trim()}<p class="body-para">{para.trim()}</p>{/if}
        {/each}
      </div>
    {:else}
      <p class="empty">Tekst nog niet beschikbaar.</p>
    {/if}

    {#if p.tk_url}
      <footer class="foot">
        <a href={p.tk_url} target="_blank" rel="noopener noreferrer" class="full-link">
          Open op tweedekamer.nl →
        </a>
      </footer>
    {/if}
  {/if}
</div>

<style>
  .r-tkstuk {
    display: flex; flex-direction: column; gap: var(--s-3);
    padding: var(--s-5) var(--s-5) var(--s-6); color: var(--ink-2);
    height: 100%; overflow-y: auto;
  }
  .loading, .error, .empty {
    font-family: var(--font-serif); font-style: italic; color: var(--ink-4); margin: 0;
  }
  .head { display: flex; flex-direction: column; gap: 4px; }
  .kicker {
    font-family: var(--font-sans); font-size: 11px;
    color: var(--ink-4); display: flex; gap: 5px; align-items: baseline;
  }
  .dot { opacity: 0.6; }
  .title { font-family: var(--font-serif); font-size: 19px; font-weight: 400; color: var(--ink); margin: 0; line-height: 1.3; }
  .ext-id { font-family: var(--font-mono); font-size: 10px; color: var(--ink-4); }

  .body {
    font-family: var(--font-serif);
    font-size: 14px;
    line-height: 1.65;
    color: var(--ink-2);
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
    padding: var(--s-3) 0;
  }

  .body-para { margin: 0; }
  .body-para + .body-para { margin-top: var(--s-3); }
  .foot { display: flex; }
  .full-link {
    font-family: var(--font-sans); font-size: 12px; color: var(--spine);
    text-decoration: none; border-bottom: 1px solid var(--spine-faint);
  }
  .full-link:hover { border-bottom-color: var(--spine); }
</style>
