<script lang="ts">
  import type { TimelineEntryDTO } from '$lib/api/parliamentary';
  import SoortChipFilter from './SoortChipFilter.svelte';
  import { partyColor } from '$lib/utils/party-color';

  let {
    entries,
    initialSoortFilter = new Set<string>(),
    onSoortFilterChange,
    partyColors = {},
  }: {
    entries: TimelineEntryDTO[];
    initialSoortFilter?: Set<string>;
    onSoortFilterChange?: (next: Set<string>) => void;
    partyColors?: Record<string, string>;
  } = $props();

  function resolvePartyColor(abbr: string): string {
    return partyColors[abbr] ?? partyColors[abbr.toUpperCase()] ?? partyColor(abbr);
  }

  let soortFilter = $state<Set<string>>(initialSoortFilter);
  let newestFirst = $state(true);

  // Derive ordered unique soort values by frequency (most common first)
  const soorten = $derived.by(() => {
    const freq = new Map<string, number>();
    for (const e of entries) freq.set(e.soort, (freq.get(e.soort) ?? 0) + 1);
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s);
  });

  // entries arrive oldest-first (order=asc from backend); reverse for newest-first view
  const filtered = $derived.by(() => {
    let result = entries;
    if (soortFilter.size > 0) {
      result = result.filter((e) => soortFilter.has(e.soort));
    }
    return newestFirst ? [...result].reverse() : [...result];
  });

  function handleSoortChange(next: Set<string>) {
    soortFilter = next;
    onSoortFilterChange?.(next);
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function bodyStr(entry: TimelineEntryDTO, key: string): string {
    return String(entry.body[key] ?? '');
  }

  function bodyArr(entry: TimelineEntryDTO, key: string): Record<string, unknown>[] {
    const v = entry.body[key];
    return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
  }

  function seatTotal(rows: Record<string, unknown>[]): number {
    return rows.reduce((s, r) => s + (Number(r['aantal_zetels']) || 0), 0);
  }
</script>

<div class="timeline">
  <div class="timeline-toolbar">
    <SoortChipFilter soorten={soorten} selected={soortFilter} onChange={handleSoortChange} />
    <button
      type="button"
      class="order-btn"
      onclick={() => (newestFirst = !newestFirst)}
      aria-label={newestFirst ? 'Sorteer oud naar nieuw' : 'Sorteer nieuw naar oud'}
      title={newestFirst ? 'Sorteer oud naar nieuw' : 'Sorteer nieuw naar oud'}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        {#if newestFirst}
          <path d="M2 3h9M4 6.5h5M6 10h1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        {:else}
          <path d="M2 10h9M4 6.5h5M6 3h1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        {/if}
      </svg>
    </button>
  </div>

  {#if filtered.length === 0}
    <p class="timeline-empty">Geen items voor deze selectie.</p>
  {:else}
    <ol class="timeline-list">
      {#each filtered as entry (entry.node_id)}
        <li class="entry" data-kind={entry.node_type}>
          <div class="entry-meta">
            {#if entry.datum}
              <time class="entry-date" datetime={entry.datum}>{formatDate(entry.datum)}</time>
            {/if}
            <span class="entry-soort">{entry.soort}</span>
          </div>

          {#if entry.node_type === 'stemming'}
            {@const voor = bodyArr(entry, 'voor')}
            {@const tegen = bodyArr(entry, 'tegen')}
            {@const onthouding = bodyArr(entry, 'onthouding')}
            {@const aangenomen = !!entry.body['aangenomen']}
            {@const voorTotal = seatTotal(voor)}
            {@const tegenTotal = seatTotal(tegen)}
            {@const onthoudingTotal = seatTotal(onthouding)}
            {@const totalCast = voorTotal + tegenTotal}
            {@const voorPct = totalCast > 0 ? Math.round((voorTotal / totalCast) * 100) : 50}
            {@const stemmingKey = (entry.body['key'] as string | undefined) ?? null}
            <div class="entry-body">
              {#if entry.titel}<p class="entry-title">{entry.titel}</p>{/if}

              <!-- Vote bar: same layout as the StemmingReader detail view. -->
              <div class="stemming-bar" title="Voor: {voorTotal} · Tegen: {tegenTotal}">
                <div class="stemming-bar-voor" style="width: {voorPct}%"></div>
              </div>
              <div class="stemming-totals">
                <span class="stemming-total stemming-total--voor">{voorTotal} voor</span>
                <span class="stemming-total-sep">·</span>
                <span class="stemming-total stemming-total--tegen">{tegenTotal} tegen</span>
                {#if onthoudingTotal > 0}
                  <span class="stemming-total-sep">·</span>
                  <span class="stemming-total stemming-total--onthouding">{onthoudingTotal} onthouding</span>
                {/if}
                <span class="stemming-outcome" class:outcome--aangenomen={aangenomen} class:outcome--verworpen={!aangenomen}>
                  {aangenomen ? 'Aangenomen' : 'Verworpen'}
                </span>
              </div>

              <!-- Per-fractie breakdown — same columnar layout as the detail page -->
              <div class="stemming-cols">
                {#if voor.length > 0}
                  <div class="stemming-col">
                    <div class="stemming-col-head stemming-col-head--voor">Voor</div>
                    <ul class="stemming-col-list">
                      {#each [...voor].sort((a, b) => Number(b['aantal_zetels'] ?? 0) - Number(a['aantal_zetels'] ?? 0)) as p (p['partij'])}
                        <li class="stemming-col-row">
                          <span class="party-dot" style="background:{resolvePartyColor(String(p['partij'] ?? ''))}" aria-hidden="true"></span>
                          <span class="party-name">{p['partij']}</span>
                          <span class="party-zetels">{p['aantal_zetels']}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
                {#if tegen.length > 0}
                  <div class="stemming-col">
                    <div class="stemming-col-head stemming-col-head--tegen">Tegen</div>
                    <ul class="stemming-col-list">
                      {#each [...tegen].sort((a, b) => Number(b['aantal_zetels'] ?? 0) - Number(a['aantal_zetels'] ?? 0)) as p (p['partij'])}
                        <li class="stemming-col-row">
                          <span class="party-dot" style="background:{resolvePartyColor(String(p['partij'] ?? ''))}" aria-hidden="true"></span>
                          <span class="party-name">{p['partij']}</span>
                          <span class="party-zetels">{p['aantal_zetels']}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
                {#if onthouding.length > 0}
                  <div class="stemming-col">
                    <div class="stemming-col-head">Onthouding</div>
                    <ul class="stemming-col-list">
                      {#each [...onthouding].sort((a, b) => Number(b['aantal_zetels'] ?? 0) - Number(a['aantal_zetels'] ?? 0)) as p (p['partij'])}
                        <li class="stemming-col-row">
                          <span class="party-dot" style="background:{resolvePartyColor(String(p['partij'] ?? ''))}" aria-hidden="true"></span>
                          <span class="party-name">{p['partij']}</span>
                          <span class="party-zetels">{p['aantal_zetels']}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>

              {#if stemmingKey}
                <a class="stemming-detail-link" href="/explore?mode=split&focus=stemmingen/{stemmingKey}">Open stemming →</a>
              {/if}
            </div>

          {:else if entry.node_type === 'activiteit'}
            {@const videoUrl = bodyStr(entry, 'video_url')}
            {@const externalId = bodyStr(entry, 'external_id')}
            {@const rawTitel = bodyStr(entry, 'agenda_titel') || entry.titel || ''}
            <!-- Strip leading "YYYY-MM-DD — " date prefix — the date is already shown above -->
            {@const agendaTitel = rawTitel.replace(/^\d{4}-\d{2}-\d{2}\s*[–—-]+\s*/, '')}
            <div class="entry-body">
              {#if agendaTitel}<p class="entry-title">{agendaTitel}</p>{/if}
              {#if externalId && externalId.length > 0}
                <a
                  href="https://gegevens.tweedekamer.nl/Activiteit?$filter=Id%20eq%20%27{externalId}%27"
                  class="entry-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >Bekijk op tweedekamer.nl ↗</a>
              {/if}
              {#if videoUrl}
                <div class="video-wrap">
                  <button
                    type="button"
                    class="video-placeholder"
                    onclick={(e) => {
                      const btn = e.currentTarget as HTMLButtonElement;
                      const iframe = document.createElement('iframe');
                      iframe.src = videoUrl;
                      iframe.allow = 'autoplay; fullscreen';
                      iframe.allowFullscreen = true;
                      iframe.className = 'video-iframe';
                      btn.replaceWith(iframe);
                    }}
                    aria-label="Debat afspelen"
                  >
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                      <circle cx="16" cy="16" r="15" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M13 11l10 5-10 5V11z" fill="currentColor"/>
                    </svg>
                    <span>Debat bekijken</span>
                  </button>
                </div>
              {/if}
            </div>

          {:else if entry.node_type === 'toezegging'}
            {@const minister = bodyStr(entry, 'minister_naam')}
            {@const tekst = bodyStr(entry, 'tekst')}
            {@const status = bodyStr(entry, 'status') || 'open'}
            <div class="entry-body">
              {#if minister}<p class="entry-minister">{minister}</p>{/if}
              {#if tekst}<p class="entry-commitment">{tekst}</p>{/if}
              <span class="toezegging-status status--{status}">
                {status === 'open' ? 'Open' : status === 'nagekomen' ? 'Nagekomen' : 'Verlopen'}
              </span>
            </div>

          {:else}
            {@const externalId = bodyStr(entry, 'external_id')}
            <div class="entry-body">
              {#if entry.titel}<p class="entry-title">{entry.titel}</p>{/if}
              {#if externalId && externalId.length > 0}
                <a
                  href="https://zoek.officielebekendmakingen.nl/{externalId}"
                  class="entry-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Document openen →
                </a>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
  }

  .timeline-toolbar {
    display: flex;
    align-items: flex-start;
    gap: var(--s-3);
    flex-wrap: wrap;
  }

  .timeline-toolbar :global(.chip-row) {
    flex: 1;
  }

  .order-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--paper-2);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    color: var(--ink-3);
    cursor: pointer;
    transition: background 80ms, color 80ms;
  }

  .order-btn:hover {
    background: var(--paper-3);
    color: var(--ink);
  }

  .timeline-empty {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--t-body-2);
    color: var(--ink-4);
    padding: var(--s-5) 0;
  }

  .timeline-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    border-left: 1.5px solid var(--rule);
    padding-left: var(--s-5);
  }

  .entry {
    position: relative;
    padding: var(--s-4) 0 var(--s-5);
    border-bottom: 1px solid var(--rule);
  }

  .entry:last-child {
    border-bottom: none;
  }

  /* timeline dot */
  .entry::before {
    content: '';
    position: absolute;
    left: calc(-1 * var(--s-5) - 4px);
    top: calc(var(--s-4) + 5px);
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--rule-strong);
    border: 1.5px solid var(--paper);
  }

  .entry[data-kind="stemming"]::before { background: var(--spine); }
  .entry[data-kind="toezegging"]::before { background: var(--warn); }
  .entry[data-kind="activiteit"]::before { background: var(--indigo); }

  .entry-meta {
    display: flex;
    align-items: baseline;
    gap: var(--s-3);
    margin-bottom: var(--s-2);
  }

  .entry-date {
    font-family: var(--font-sans);
    font-size: var(--t-micro);
    color: var(--ink-4);
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  .entry-soort {
    font-family: var(--font-sans);
    font-size: var(--t-micro);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--ink-4);
    font-weight: 500;
  }

  .entry-body {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }

  .entry-title {
    font-family: var(--font-serif);
    font-size: var(--t-body-2);
    color: var(--ink);
    margin: 0;
    line-height: var(--lh-snug);
  }

  .entry-author {
    font-family: var(--font-sans);
    font-size: var(--t-meta);
    color: var(--ink-3);
    margin: 0;
  }

  .entry-summary {
    font-family: var(--font-sans);
    font-size: var(--t-meta);
    color: var(--ink-2);
    margin: 0;
    line-height: var(--lh-body);
  }

  .entry-targets {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    flex-wrap: wrap;
  }

  .entry-targets-label {
    font-family: var(--font-sans);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--track-caps);
    color: var(--ink-4);
  }

  .article-chip {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    background: var(--paper-3);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-2);
    text-decoration: none;
    transition: background 80ms, color 80ms;
  }

  .article-chip:hover {
    background: var(--spine-faint);
    color: var(--spine);
  }

  .entry-link {
    font-family: var(--font-sans);
    font-size: var(--t-meta);
    color: var(--spine);
    text-decoration: none;
    border-bottom: 1px solid var(--spine-faint);
    align-self: flex-start;
  }

  .entry-link:hover {
    border-bottom-color: var(--spine);
  }

  /* ── Stemming ─────────────────────────────────────────────────────────── */
  /* Mirrors StemmingReader: bar + totals + per-fractie columns. */
  .stemming-bar {
    height: 6px;
    background: color-mix(in srgb, var(--red, #dc2626) 18%, var(--paper-3));
    border-radius: 3px;
    overflow: hidden;
    margin-top: var(--s-2);
  }
  .stemming-bar-voor {
    height: 100%;
    background: var(--green, #16a34a);
    border-radius: 3px 0 0 3px;
    transition: width 200ms ease;
  }

  .stemming-totals {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
    font-family: var(--font-sans);
    font-size: 12px;
  }
  .stemming-total--voor       { color: var(--green, #16a34a); font-weight: 600; }
  .stemming-total--tegen      { color: var(--red,   #dc2626); font-weight: 600; }
  .stemming-total--onthouding { color: var(--ink-3); }
  .stemming-total-sep         { color: var(--ink-4); }

  .stemming-outcome {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: var(--r-1);
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    border: 1px solid var(--rule);
  }
  .outcome--aangenomen {
    background: color-mix(in srgb, var(--green, #16a34a) 8%, var(--paper));
    color: var(--green, #16a34a);
    border-color: color-mix(in srgb, var(--green, #16a34a) 22%, transparent);
  }
  .outcome--verworpen {
    background: color-mix(in srgb, var(--red, #dc2626) 8%, var(--paper));
    color: var(--red, #dc2626);
    border-color: color-mix(in srgb, var(--red, #dc2626) 22%, transparent);
  }

  .stemming-cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--s-4);
    margin-top: var(--s-3);
  }
  .stemming-col-head {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-3);
    padding-bottom: 4px;
    border-bottom: 2px solid var(--rule);
    margin-bottom: 4px;
  }
  .stemming-col-head--voor  { border-bottom-color: var(--green, #16a34a); color: var(--green, #16a34a); }
  .stemming-col-head--tegen { border-bottom-color: var(--red,   #dc2626); color: var(--red,   #dc2626); }

  .stemming-col-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .stemming-col-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
    border-bottom: 1px dotted var(--rule);
  }
  .stemming-col-row:last-child { border-bottom: none; }
  .party-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .party-name {
    flex: 1;
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .party-zetels {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-3);
    flex-shrink: 0;
  }

  .stemming-detail-link {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--spine);
    text-decoration: none;
    border-bottom: 1px solid var(--spine-faint);
    align-self: flex-start;
    margin-top: var(--s-2);
  }
  .stemming-detail-link:hover { border-bottom-color: var(--spine); }

  /* Activiteit */
  .video-wrap {
    margin-top: var(--s-2);
  }

  .video-placeholder {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    width: 100%;
    max-width: 360px;
    padding: var(--s-3) var(--s-4);
    background: var(--paper-3);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-2);
    color: var(--indigo);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: var(--t-meta);
    font-weight: 500;
    transition: background 80ms;
  }

  .video-placeholder:hover {
    background: var(--indigo-faint);
  }

  :global(.video-iframe) {
    width: 100%;
    max-width: 360px;
    aspect-ratio: 16 / 9;
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-2);
    display: block;
  }

  /* Toezegging */
  .entry-minister {
    font-family: var(--font-sans);
    font-size: var(--t-meta);
    font-weight: 600;
    color: var(--ink-2);
    margin: 0;
  }

  .entry-commitment {
    font-family: var(--font-sans);
    font-size: var(--t-meta);
    color: var(--ink-2);
    margin: 0;
    line-height: var(--lh-body);
  }

  .toezegging-status {
    align-self: flex-start;
    padding: 2px 8px;
    border-radius: var(--r-1);
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
  }

  .status--open {
    background: var(--paper-3);
    color: var(--ink-3);
  }

  .status--done {
    background: #E5EFE4;
    color: var(--positive);
  }

  .status--overdue {
    background: var(--warn-faint);
    color: var(--warn);
  }
</style>
