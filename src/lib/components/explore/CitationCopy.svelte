<script lang="ts">
  import type { GraphNode } from '$lib/graph/types';
  import { getArticleDetail } from '$lib/api/articles';
  import { recordInstrument } from '$lib/api/instrument-cache';

  let { node }: { node: GraphNode | null } = $props();

  type Format = 'verkort' | 'volledig' | 'vindplaats' | 'bibtex';
  let active = $state<Format>('verkort');
  let copiedFormat = $state<Format | null>(null);

  const nodeProps = $derived((node?.raw?.props ?? {}) as Record<string, unknown>);

  // Backend ships authoritative citation formats per article. Fetch and cache.
  const fmtCache = new Map<string, Partial<Record<Format, string>>>();
  let backendFormats = $state<Partial<Record<Format, string>> | null>(null);

  $effect(() => {
    backendFormats = null;
    if (!node || node.collection !== 'instrument_articles') return;
    const bwb = String(nodeProps['bwb_id'] ?? '');
    const art = String(nodeProps['article_number'] ?? '');
    if (!bwb || !art) return;
    const key = `${bwb}/${art}`;
    const cached = fmtCache.get(key);
    if (cached) { backendFormats = cached; return; }
    getArticleDetail(bwb, art)
      .then((d) => {
        const f = d.citation_formats ?? null;
        if (f) {
          fmtCache.set(key, f);
          // Sniff the short title out of the BibTeX entry so the breadcrumb
          // and other consumers can display "Sr" without an extra request.
          // (Backend doesn't expose it as a discrete field today.)
          const shortMatch = (f.bibtex ?? '').match(/shorttitle\s*=\s*\{([^}]+)\}/);
          const lawMatch = (f.bibtex ?? '').match(/\blaw\s*=\s*\{([^}]+)\}/);
          recordInstrument({
            bwb_id: bwb,
            short_title: shortMatch?.[1] ?? null,
            citation_title: lawMatch?.[1] ?? null,
            title: lawMatch?.[1] ?? null
          });
          if (String(nodeProps['bwb_id']) === bwb && String(nodeProps['article_number']) === art) {
            backendFormats = f;
          }
        }
      })
      .catch(() => { /* silent — fall back to client-side construction */ });
  });

  const formats = $derived.by<Record<Format, string> | null>(() => {
    if (!node) return null;

    if (node.collection === 'instrument_articles') {
      const bwb = String(nodeProps['bwb_id'] ?? '');
      const art = String(nodeProps['article_number'] ?? '');
      const fb = backendFormats ?? {};
      const verkort = fb.verkort ?? `Art. ${art}`;
      const volledig = fb.volledig ?? `Art. ${art}`;
      const vindplaats = fb.vindplaats ?? (bwb ? `wetten.overheid.nl/${bwb}/Artikel${art}` : `Art. ${art}`);
      const bibtex = fb.bibtex ?? `@legislation{${(bwb || 'art').toLowerCase()}_${art.toLowerCase()},\n  title = {Art. ${art}},\n  bwbid = {${bwb}},\n}`;
      return { verkort, volledig, vindplaats, bibtex };
    }

    if (node.collection === 'judgments') {
      const ecli = String(nodeProps['ecli'] ?? node.key ?? '');
      const fullEcli = ecli.startsWith('ECLI:') ? ecli : ecli ? `ECLI:${ecli}` : '';
      const m = fullEcli.match(/ECLI:NL:([^:]+):(\d{4}):(\d+)/);
      const court = m?.[1] ?? '';
      const year = m?.[2] ?? '';
      const num = m?.[3] ?? '';

      const verkort = court && year ? `${court} ${year}/${num}` : fullEcli;
      const volledig = fullEcli;
      const vindplaats = fullEcli ? `deeplink.rechtspraak.nl/uitspraak?id=${fullEcli}` : '';
      const bibtex = `@misc{${(court || 'uitspraak').toLowerCase()}_${year}_${num},\n  title = {${node.label}},\n  howpublished = {ECLI: ${fullEcli}},\n  year = {${year || ''}}\n}`;
      return { verkort, volledig, vindplaats, bibtex };
    }

    return null;
  });


  async function handleCopy() {
    if (!formats) return;
    const text = formats[active];
    try {
      await navigator.clipboard.writeText(text);
      copiedFormat = active;
      setTimeout(() => { if (copiedFormat === active) copiedFormat = null; }, 1600);
    } catch {
      // Clipboard may be unavailable in some contexts; do nothing.
    }
  }
</script>

{#if formats}
  <section class="cite-copy" aria-label="Citeer dit">
    <h3 class="cite-h">Citeer dit</h3>

    <div class="cite-tabs" role="tablist">
      {#each (['verkort', 'volledig', 'vindplaats', 'bibtex'] as const) as f, i (i)}
        <button
          type="button"
          role="tab"
          class="cite-tab"
          class:on={active === f}
          aria-selected={active === f}
          onclick={() => (active = f)}
        >{f.toUpperCase()}</button>
      {/each}
    </div>

    <pre class="cite-text">{formats[active]}</pre>

    <button type="button" class="cite-copy-btn" onclick={handleCopy}>
      {copiedFormat === active ? 'Gekopieerd' : 'Kopieer'}
    </button>
  </section>
{/if}

<style>
  .cite-copy {
    padding: var(--s-5) var(--s-5) var(--s-4);
    border-bottom: 1px solid var(--rule);
  }

  .cite-h {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--fg-3);
    margin: 0 0 var(--s-3);
  }

  .cite-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: var(--s-2);
  }

  .cite-tab {
    font-family: var(--font-sans);
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.08em;
    padding: 3px 7px;
    background: transparent;
    border: 1px solid var(--rule);
    border-radius: var(--r-1);
    color: var(--fg-3);
    cursor: pointer;
    transition: all var(--dur-1) var(--ease);
  }

  .cite-tab:hover { color: var(--ink); border-color: var(--rule-strong); }

  .cite-tab.on {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }

  .cite-text {
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
    color: var(--ink-2);
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--r-1);
    padding: var(--s-2) var(--s-3);
    margin: 0 0 var(--s-2);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 120px;
    overflow-y: auto;
  }

  .cite-copy-btn {
    font-family: var(--font-sans);
    font-size: 11px;
    padding: 4px 10px;
    background: var(--paper);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    color: var(--ink-2);
    cursor: pointer;
    transition: background var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
  }

  .cite-copy-btn:hover {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }
</style>
