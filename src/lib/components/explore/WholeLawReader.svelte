<script lang="ts">
  import { getInstrumentReader, type ReaderArticle } from '$lib/api/nodes';
  import { recordInstrument, instrumentMetaStore } from '$lib/api/instrument-cache';
  import { compareArticleNumbers } from '$lib/util/sort';
  import LidText from '$lib/components/articles/LidText.svelte';

  let {
    bwbId,
    onNavigate
  }: {
    bwbId: string | null;
    onNavigate?: (collection: string, key: string) => void;
  } = $props();

  type State =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready'; articles: ReaderArticle[] }
    | { kind: 'error'; message: string };

  let view = $state<State>({ kind: 'idle' });
  let loadedBwb: string | null = null;

  // Friendly law name from the shared cache (filled by every endpoint that
  // returns instrument metadata). Avoid pinning this into the State so the
  // header updates live as the cache learns the real name.
  const prettyLawName = $derived.by(() => {
    if (!bwbId) return null;
    const meta = $instrumentMetaStore.get(bwbId);
    return meta?.citationTitle ?? meta?.title ?? meta?.shortTitle ?? bwbId;
  });

  $effect(() => {
    const bwb = bwbId;
    if (!bwb) { view = { kind: 'idle' }; return; }
    if (bwb === loadedBwb) return;

    view = { kind: 'loading' };
    getInstrumentReader(bwb)
      .then((resp) => {
        recordInstrument({
          ...resp.instrument,
          citation_title: resp.citation_title ?? resp.instrument.citation_title ?? null
        });

        const byId = new Map<string, ReaderArticle>();
        for (const a of resp.articles) {
          if (a.id && !byId.has(a.id)) byId.set(a.id, a);
        }
        const articles = [...byId.values()].sort((a, b) =>
          compareArticleNumbers(a.article_number, b.article_number)
        );
        view = { kind: 'ready', articles };
        loadedBwb = bwb;
      })
      .catch((err) => {
        console.warn('[whole-law] failed to load', bwb, err);
        view = { kind: 'error', message: 'Volledige wet kon niet geladen worden.' };
      });
  });

  function diffHeaders(prev: ReaderArticle | null, cur: ReaderArticle) {
    const prevBc = prev?.breadcrumb ?? [];
    const curBc = cur.breadcrumb ?? [];
    const out: { type: string; label: string; depth: number }[] = [];
    for (let i = 0; i < curBc.length; i++) {
      const cur = curBc[i];
      const prevCrumb = i < prevBc.length ? prevBc[i] : null;
      const same = prevCrumb && prevCrumb.label === cur.label && prevCrumb.type === cur.type;
      if (!same) out.push({ type: cur.type ?? '', label: cur.label ?? '', depth: i });
    }
    return out;
  }
</script>

{#if view.kind === 'idle'}
  <div class="whole-empty">Selecteer een artikel om de wet te openen.</div>

{:else if view.kind === 'loading'}
  <div class="whole-loading">
    <div class="spinner" aria-hidden="true"></div>
    <span>Wet ophalen…</span>
  </div>

{:else if view.kind === 'error'}
  <div class="whole-error">{view.message}</div>

{:else}
  <article class="whole-law">
    <header class="whole-head">
      <span class="whole-kind">WETBOEK</span>
      <h1 class="whole-title">{prettyLawName ?? bwbId}</h1>
      <p class="whole-count">{view.articles.length} artikelen</p>
    </header>

    {#each view.articles as a, i (a.id)}
      {@const headers = diffHeaders(view.articles[i - 1] ?? null, a)}
      {#each headers as section, i (i)}
        <h2 class="whole-section whole-section--depth-{Math.min(section.depth, 3)}">
          <span class="whole-section-kind">{section.type}</span>
          <span class="whole-section-label">{section.label}</span>
        </h2>
      {/each}

      <section class="whole-article" id="article-{a.article_number}">
        <div class="whole-article-head">
          <button
            type="button"
            class="whole-article-jump"
            onclick={() => onNavigate?.('instrument_articles', a.key)}
            title="Open in detail"
          >
            <span class="whole-art-num">Art. {a.article_number}</span>
            {#if a.display_name && a.display_name !== `Art. ${a.article_number}`}
              <span class="whole-art-name">{a.display_name}</span>
            {/if}
          </button>
        </div>

        <div class="whole-article-body">
          {#if a.leden && a.leden.length > 0}
            <ol class="whole-leden">
              {#each a.leden as lid, i (i)}
                <li class="whole-lid">
                  <span class="whole-lid-num">{lid.number}</span>
                  <p class="whole-lid-text">
                    <LidText text={lid.text} citaties={lid.citaties ?? []} {onNavigate} />
                  </p>
                </li>
              {/each}
            </ol>
          {:else if a.text}
            <p class="whole-flat">{a.text}</p>
          {:else}
            <p class="whole-empty-text">Geen tekst beschikbaar.</p>
          {/if}
        </div>
      </section>
    {/each}
  </article>
{/if}

<style>
  .whole-empty,
  .whole-error {
    padding: var(--s-7);
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 16px;
    color: var(--fg-3);
    text-align: center;
  }

  .whole-error { color: var(--accent); font-style: normal; }

  .whole-loading {
    padding: var(--s-7);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    align-items: center;
    color: var(--fg-3);
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 14px;
  }

  .spinner {
    width: 26px;
    height: 26px;
    border: 2px solid var(--rule);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .whole-law {
    max-width: 900px;
    width: 100%;
    margin: 0 auto;
    padding: var(--s-7) var(--s-7) var(--s-8);
    box-sizing: border-box;
  }

  .whole-head {
    margin-bottom: var(--s-7);
    padding-bottom: var(--s-4);
    border-bottom: 1px solid var(--rule);
  }

  .whole-kind {
    display: block;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg-3);
    margin-bottom: 8px;
  }

  .whole-title {
    margin: 0 0 6px;
    font-family: var(--font-serif);
    font-weight: 500;
    font-size: 36px;
    line-height: 1.1;
    color: var(--ink);
  }

  .whole-count {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-3);
  }

  .whole-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: var(--s-7) 0 var(--s-3);
    padding-bottom: 6px;
    border-bottom: 1px solid var(--rule);
  }

  .whole-section--depth-0 { margin-top: var(--s-8); }

  .whole-section-kind {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg-4);
  }

  .whole-section-label {
    font-family: var(--font-serif);
    font-weight: 500;
    color: var(--ink);
    font-size: 18px;
    line-height: 1.25;
  }

  .whole-section--depth-0 .whole-section-label { font-size: 22px; }
  .whole-section--depth-2 .whole-section-label,
  .whole-section--depth-3 .whole-section-label { font-size: 15px; color: var(--ink-2); }

  .whole-article {
    margin: var(--s-5) 0;
  }

  .whole-article-head {
    margin-bottom: var(--s-2);
  }

  .whole-article-jump {
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: baseline;
    gap: var(--s-2);
    text-align: left;
  }

  .whole-art-num {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--accent);
    font-weight: 500;
  }

  .whole-art-name {
    font-family: var(--font-serif);
    font-size: 14px;
    color: var(--ink-3);
  }

  .whole-article-jump:hover .whole-art-num { text-decoration: underline; }

  .whole-leden { list-style: none; margin: 0; padding: 0; }

  .whole-lid {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: var(--s-3);
    margin-bottom: var(--s-3);
  }

  .whole-lid:last-child { margin-bottom: 0; }

  .whole-lid-num {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-4);
    line-height: 1.62;
    padding-top: 3px;
    text-align: right;
  }

  .whole-lid-text,
  .whole-flat {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 17px;
    line-height: 1.62;
    color: var(--ink);
  }

  .whole-empty-text {
    margin: 0;
    font-family: var(--font-serif);
    font-style: italic;
    color: var(--fg-3);
  }
</style>
