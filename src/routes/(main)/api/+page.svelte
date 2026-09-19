<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Friendly Dutch tag labels — shown in section headers and TOC.
  const TAG_LABEL: Record<string, string> = {
    articles:    'Wetsartikelen',
    judgments:   'Uitspraken',
    dossiers:    'Wetgevingsdossiers',
    commissies:  'Commissies',
    leden:       'Kamerleden',
    partijen:    'Partijen',
    publications:'Parlementaire publicaties',
    stemmingen:  'Stemmingen',
    instruments: 'Wetten',
    fracties:    'Fracties',
    parlement:   'Parlement',
    nodes:       'Bronnen (generiek)',
    graph:       'Netwerk-queries',
    search:      'Zoeken',
    stats:       'Statistieken',
    watches:     'Watch-abonnementen',
    root:        'Root',
    overig:      'Overig',
  };

  const TAG_DESC: Record<string, string> = {
    articles:    'Endpoints voor BWB-artikelen, hun parent-instrument en wetgevingsgeschiedenis.',
    judgments:   'Endpoints voor rechterlijke uitspraken op ECLI-basis.',
    dossiers:    'Wetgevingstrajecten met tijdlijn, fases, mutaties en gerelateerde publicaties.',
    commissies:  'Vaste en tijdelijke commissies van de Tweede Kamer.',
    leden:       'Kamerleden, hun fractie en activiteit.',
    partijen:    'Politieke partijen en hun visuele kleurcodes.',
    publications:'Memories van toelichting, voorstellen, amendementen, moties.',
    stemmingen:  'Plenaire stemmingen: uitslag, deelnemers en referentiedossiers.',
    instruments: 'Wettelijke regelingen op BWB-basis.',
    fracties:    'Fracties in de Tweede Kamer en hun activiteit per wet.',
    parlement:   'Actuele zetelverdeling van de Tweede Kamer.',
    nodes:       'Generieke bronnen en hun verbindingen, voor de netwerkverkenning.',
    graph:       'Subgraph-queries op dossier-, commissie- of artikelniveau.',
    search:      'Volledig-tekst-zoek over alle bronnen.',
    stats:       'Algemene statistieken en synchronisatiestatus.',
    watches:     'Bookmark- en notificatie-abonnementen.',
  };

  // Per-endpoint open/close — preserve user choice while scrolling.
  let openOps = $state<Record<string, boolean>>({});

  function toggleOp(opId: string) {
    openOps = { ...openOps, [opId]: !openOps[opId] };
  }

  function methodClass(method: string): string {
    return `method-${method.toLowerCase()}`;
  }

  function paramTypeLabel(p: { schema?: { type?: string; anyOf?: Array<{ type?: string }> } }): string {
    if (p.schema?.type) return p.schema.type;
    const types = p.schema?.anyOf?.map((a) => a.type).filter(Boolean) ?? [];
    if (types.length > 0) return types.join(' | ');
    return 'any';
  }
</script>

<svelte:head>
  <title>API-referentie. Concordans.</title>
</svelte:head>

<div class="page-wrap">
  <div class="container">

    <header class="page-header">
      <div class="eyebrow">DEVELOPER · OPENAPI v{data.version}</div>
      <h1 class="page-title">API-referentie</h1>
      <p class="page-lede">{data.description}</p>
      <div class="meta-strip">
        <span class="meta-pill">{data.totalEndpoints} endpoints</span>
        <span class="meta-pill">{data.tags.length} groepen</span>
        <span class="meta-note">Gegenereerd uit OpenAPI v{data.version}</span>
      </div>
    </header>

    <aside class="toc" aria-label="Inhoudsopgave">
      <div class="toc-title">Inhoud</div>
      <ul class="toc-list">
        {#each data.tags as t, i (i)}
          <li>
            <a href="#{t.tag}">
              <span class="toc-name">{TAG_LABEL[t.tag] ?? t.tag}</span>
              <span class="toc-count">{t.endpoints.length}</span>
            </a>
          </li>
        {/each}
      </ul>
    </aside>

    <div class="api-doc">
      {#each data.tags as t, i (i)}
        <section id={t.tag} class="api-tag">
          <header class="api-tag-head">
            <h2 class="api-tag-title">{TAG_LABEL[t.tag] ?? t.tag}</h2>
            <span class="api-tag-count">{t.endpoints.length} endpoint{t.endpoints.length === 1 ? '' : 's'}</span>
          </header>
          {#if TAG_DESC[t.tag]}
            <p class="api-tag-desc">{TAG_DESC[t.tag]}</p>
          {/if}

          <ul class="api-endpoints">
            {#each t.endpoints as ep (ep.operationId)}
              {@const opOpen = openOps[ep.operationId] ?? false}
              <li class="api-endpoint">
                <button
                  type="button"
                  class="api-endpoint-head"
                  aria-expanded={opOpen}
                  onclick={() => toggleOp(ep.operationId)}
                >
                  <span class="api-method {methodClass(ep.method)}">{ep.method}</span>
                  <code class="api-path">{ep.path}</code>
                  {#if ep.summary}
                    <span class="api-summary">{ep.summary}</span>
                  {/if}
                  <span class="api-chev" aria-hidden="true" class:open={opOpen}>▸</span>
                </button>

                {#if opOpen}
                  <div class="api-endpoint-body">
                    {#if ep.description}
                      <p class="api-desc">{ep.description}</p>
                    {/if}

                    {#if ep.parameters.length > 0}
                      <div class="api-block">
                        <div class="api-block-head">Parameters</div>
                        <table class="api-params">
                          <thead>
                            <tr>
                              <th>Naam</th>
                              <th>In</th>
                              <th>Type</th>
                              <th>Vereist</th>
                              <th>Beschrijving</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each ep.parameters as p, i (i)}
                              <tr>
                                <td><code>{p.name}</code></td>
                                <td><span class="api-in">{p.in}</span></td>
                                <td><code>{paramTypeLabel(p)}</code></td>
                                <td>{p.required ? 'ja' : 'nee'}</td>
                                <td>{p.description ?? p.schema?.description ?? ''}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {/if}

                    {#if ep.responses.length > 0}
                      <div class="api-block">
                        <div class="api-block-head">Responses</div>
                        <table class="api-responses">
                          <thead>
                            <tr><th>Status</th><th>Schema</th><th>Beschrijving</th></tr>
                          </thead>
                          <tbody>
                            {#each ep.responses as r, i (i)}
                              <tr>
                                <td><code class="api-status api-status-{r.status[0]}xx">{r.status}</code></td>
                                <td>{#if r.schemaRef}<code>{r.schemaRef}</code>{:else}—{/if}</td>
                                <td>{r.description}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {/if}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>

    <div class="api-footer">
      <p>
        Voor uitleg over de werkomgeving: zie de <a href="/docs">documentatie</a>. Voor de
        inhoudelijke verantwoording: <a href="/docs/methode">methode-bijlage</a>. Toegang voor
        grootschalig gebruik loopt via <a href="/contact">contact</a>.
      </p>
    </div>
  </div>
</div>


<style>
  .page-wrap { padding: 72px 0 96px; }
  .container {
    max-width: 1080px;
    margin: 0 auto;
    padding: 0 32px;
    display: grid;
    grid-template-columns: 220px 1fr;
    column-gap: 48px;
    row-gap: 48px;
  }

  .page-header {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--rule);
  }
  .eyebrow {
    font-family: var(--font-sans);
    font-size: 11px;
    letter-spacing: 0.1em;
    color: var(--ink-4);
    text-transform: uppercase;
  }
  .page-title {
    font-family: var(--font-serif);
    font-size: clamp(30px, 5vw, 44px);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
    line-height: 1.15;
  }
  .page-lede {
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.65;
    color: var(--ink-2);
    margin: 0;
    max-width: 64ch;
  }
  .meta-strip {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 6px;
    flex-wrap: wrap;
  }
  .meta-pill {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-3);
    background: var(--paper-2);
    border: 1px solid var(--rule);
    border-radius: var(--r-1);
    padding: 3px 9px;
  }
  .meta-note {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-4);
    font-style: italic;
  }

  /* ── TOC ──────────────────────────────────────────────────────────────── */
  .toc {
    grid-column: 1;
    grid-row: 2;
    align-self: start;
    position: sticky;
    top: 90px;
  }
  .toc-title {
    font-family: var(--font-sans);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-4);
    margin-bottom: 8px;
  }
  .toc-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  .toc-list a {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 5px 0;
    color: var(--ink-2);
    text-decoration: none;
    font-family: var(--font-sans);
    font-size: 13px;
    border-bottom: 1px dotted transparent;
  }
  .toc-list a:hover {
    color: var(--spine);
    border-bottom-color: var(--rule);
  }
  .toc-name { flex: 1; }
  .toc-count {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-4);
    margin-left: 8px;
  }

  /* ── Endpoint sections ────────────────────────────────────────────────── */
  .api-doc {
    grid-column: 2;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    gap: 56px;
  }

  .api-tag {
    display: flex;
    flex-direction: column;
    gap: 12px;
    scroll-margin-top: 90px;
  }
  .api-tag-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 8px;
  }
  .api-tag-title {
    font-family: var(--font-serif);
    font-size: 22px;
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }
  .api-tag-count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-4);
  }
  .api-tag-desc {
    font-family: var(--font-sans);
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink-3);
    margin: 0 0 8px;
    max-width: 60ch;
  }

  .api-endpoints {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--rule);
  }
  .api-endpoint {
    border-bottom: 1px solid var(--rule);
  }
  .api-endpoint-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    background: none;
    border: 0;
    cursor: pointer;
    text-align: left;
    transition: background 80ms;
  }
  .api-endpoint-head:hover { background: var(--paper-2); }

  .api-method {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 2px 7px;
    border-radius: var(--r-1);
    color: var(--paper);
    flex-shrink: 0;
    min-width: 48px;
    text-align: center;
  }
  .method-get    { background: var(--indigo, #2B3A5C); }
  .method-post   { background: #16a34a; }
  .method-put    { background: #d97706; }
  .method-delete { background: var(--spine, #7A1F1A); }
  .method-patch  { background: #6b21a8; }

  .api-path {
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--ink);
    flex-shrink: 0;
  }
  .api-summary {
    font-family: var(--font-serif);
    font-size: 13px;
    color: var(--ink-3);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .api-chev {
    color: var(--ink-4);
    font-size: 12px;
    transition: transform 120ms;
    margin-right: 4px;
  }
  .api-chev.open { transform: rotate(90deg); }

  .api-endpoint-body {
    padding: 4px 0 18px 60px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .api-desc {
    font-family: var(--font-sans);
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink-2);
    margin: 0;
    max-width: 60ch;
  }
  .api-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .api-block-head {
    font-family: var(--font-sans);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-4);
    font-weight: 500;
  }

  table.api-params, table.api-responses {
    border-collapse: collapse;
    font-family: var(--font-sans);
    font-size: 12px;
    width: 100%;
  }
  .api-params th, .api-params td,
  .api-responses th, .api-responses td {
    text-align: left;
    padding: 6px 10px 6px 0;
    border-bottom: 1px solid var(--rule);
    vertical-align: top;
  }
  .api-params th, .api-responses th {
    font-weight: 500;
    color: var(--ink-4);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .api-params code, .api-responses code {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink);
    background: var(--paper-2);
    padding: 1px 5px;
    border-radius: 2px;
  }
  .api-in {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-3);
    background: var(--paper-3);
    padding: 1px 6px;
    border-radius: 2px;
  }
  .api-status-2xx { color: #16a34a; }
  .api-status-3xx { color: #d97706; }
  .api-status-4xx { color: var(--spine); }
  .api-status-5xx { color: #dc2626; }

  .api-footer {
    grid-column: 1 / -1;
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--rule);
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink-3);
    line-height: 1.65;
  }
  .api-footer a {
    color: var(--ink-2);
    border-bottom: 1px solid var(--rule-strong);
    text-decoration: none;
  }
  .api-footer a:hover { color: var(--spine); border-bottom-color: var(--spine); }

  @media (max-width: 820px) {
    .container {
      grid-template-columns: 1fr;
    }
    .toc {
      position: static;
      grid-column: 1;
      grid-row: auto;
    }
    .api-doc {
      grid-column: 1;
      grid-row: auto;
    }
    .api-endpoint-body {
      padding-left: 0;
    }
    .api-summary { display: none; }
  }
</style>
